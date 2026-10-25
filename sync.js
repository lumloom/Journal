(() => {
  "use strict";

  const META_KEY = "lumloom-journal-sync-v1";
  const config = window.LUMLOOM_SUPABASE_CONFIG || {};
  const journal = window.LumloomJournal;
  const $ = selector => document.querySelector(selector);
  const accountDialog = $("#accountDialog");
  const setupPanel = $("#syncSetupPanel");
  const authForm = $("#authForm");
  const accountSession = $("#accountSession");
  const syncMessage = $("#syncMessage");
  const conflictList = $("#conflictList");
  const accountButtonStatus = $("#accountButtonStatus");
  const configured = Boolean(config.url && config.publishableKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.url, config.publishableKey, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  }) : null;

  let user = null;
  let meta = loadMeta();
  let lastRemoteCount = 0;
  let syncing = false;
  let queued = false;
  let syncTimer;

  function loadMeta() {
    try {
      const parsed = JSON.parse(localStorage.getItem(META_KEY));
      return parsed && parsed.records && parsed.conflicts ? parsed : {userId:null,records:{},conflicts:{}};
    } catch {
      return {userId:null,records:{},conflicts:{}};
    }
  }

  function saveMeta() {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function samePayload(a,b) {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
  }

  function escapeHtml(value="") {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  function setMessage(message, isError=false) {
    syncMessage.textContent = message;
    syncMessage.classList.toggle("error", isError);
  }

  function recordLabel(record) {
    const kind = record.record_type === "weekly-review" ? "주간 회고" : "일일 기록";
    return `${record.record_date} ${kind}`;
  }

  function render() {
    setupPanel.hidden = configured;
    authForm.hidden = !configured || Boolean(user);
    accountSession.hidden = !user;

    document.querySelectorAll(".account-dot").forEach(dot => dot.classList.toggle("online", Boolean(user)));
    if (!configured) accountButtonStatus.textContent = "동기화 연결 준비 중";
    else if (!user) accountButtonStatus.textContent = "로그인하지 않음";
    else accountButtonStatus.textContent = user.email || "동기화 연결됨";

    if (!user) return;
    $("#accountEmail").textContent = user.email || user.id;
    const localRecords = journal.listSyncRecords();
    const syncedCount = localRecords.filter(record => meta.records[record.lumloom_id]?.remoteVersion).length;
    const conflicts = Object.values(meta.conflicts);
    $("#syncSummary").innerHTML = [
      [localRecords.length,"이 기기 기록"],
      [lastRemoteCount,"클라우드 기록"],
      [conflicts.length,"확인할 충돌"]
    ].map(([count,label]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join("");
    const uploadButton = $("#uploadLocalButton");
    const hasLocalRecords = localRecords.length > 0;
    const allLocalRecordsSynced = hasLocalRecords && localRecords.length === syncedCount;
    uploadButton.disabled = !hasLocalRecords || allLocalRecordsSynced;
    if (!hasLocalRecords) {
      uploadButton.textContent = "올릴 기록 없음";
      uploadButton.title = "이 기기에 아직 저장된 기록이 없습니다.";
    } else if (allLocalRecordsSynced) {
      uploadButton.textContent = "모두 업로드됨";
      uploadButton.title = "이 기기의 기록이 모두 클라우드에 저장되었습니다.";
    } else {
      uploadButton.textContent = "이 기기 기록 올리기";
      uploadButton.removeAttribute("title");
    }

    conflictList.innerHTML = conflicts.map(conflict => {
      const id = encodeURIComponent(conflict.remote.lumloom_id);
      return `<article class="conflict-card" data-conflict-id="${id}"><strong>${escapeHtml(recordLabel(conflict.remote))}</strong><p>이 기기와 클라우드에서 모두 수정되었습니다. 사용할 내용을 선택해주세요.</p><div><button type="button" data-resolution="local">이 기기 내용 사용</button><button type="button" data-resolution="remote">클라우드 내용 사용</button></div></article>`;
    }).join("");
  }

  function openAccount() {
    render();
    accountDialog.showModal();
  }

  async function fetchRemoteRecords() {
    const {data,error} = await client.from("journal_records").select("*").order("record_date", {ascending:true});
    if (error) throw error;
    lastRemoteCount = data.length;
    return data;
  }

  function trackRemote(record, dirty=false) {
    meta.records[record.lumloom_id] = {
      remoteVersion:record.version,
      dirty,
      lastSyncedAt:new Date().toISOString()
    };
  }

  function addConflict(localRecord, remoteRecord) {
    meta.conflicts[remoteRecord.lumloom_id] = {
      localUpdatedAt:localRecord?.client_updated_at || null,
      remote:remoteRecord
    };
  }

  async function pushRecord(record) {
    const tracked = meta.records[record.lumloom_id] || {remoteVersion:null,dirty:true};
    const values = {
      user_id:user.id,
      lumloom_id:record.lumloom_id,
      record_type:record.record_type,
      record_date:record.record_date,
      payload:record.payload,
      status:"active",
      client_updated_at:record.client_updated_at,
      version:(tracked.remoteVersion || 0) + 1
    };

    if (tracked.remoteVersion === null) {
      const {data,error} = await client.from("journal_records").insert(values).select().single();
      if (error) {
        if (error.code === "23505") return false;
        throw error;
      }
      trackRemote(data);
      delete meta.conflicts[record.lumloom_id];
      return true;
    }

    const {data,error} = await client.from("journal_records")
      .update(values)
      .eq("lumloom_id", record.lumloom_id)
      .eq("version", tracked.remoteVersion)
      .select();
    if (error) throw error;
    if (!data.length) return false;
    trackRemote(data[0]);
    delete meta.conflicts[record.lumloom_id];
    return true;
  }

  async function runSync(includeUntracked=false) {
    if (!user || !navigator.onLine) {
      if (user) setMessage("오프라인입니다. 연결되면 다시 동기화합니다.");
      return;
    }
    if (syncing) {
      queued = true;
      return;
    }
    syncing = true;
    setMessage("기록을 확인하고 있습니다…");

    try {
      const remoteRecords = await fetchRemoteRecords();
      const remoteById = Object.fromEntries(remoteRecords.map(record => [record.lumloom_id,record]));
      let localRecords = journal.listSyncRecords();
      const localById = Object.fromEntries(localRecords.map(record => [record.lumloom_id,record]));

      for (const remote of remoteRecords) {
        const local = localById[remote.lumloom_id];
        const tracked = meta.records[remote.lumloom_id];
        if (!local) {
          journal.applySyncRecord(remote);
          trackRemote(remote);
        } else if (!tracked) {
          if (samePayload(local.payload,remote.payload)) trackRemote(remote);
          else if (includeUntracked) addConflict(local,remote);
        } else if (tracked.dirty) {
          if (tracked.remoteVersion !== remote.version && !samePayload(local.payload,remote.payload)) addConflict(local,remote);
        } else if (tracked.remoteVersion !== remote.version) {
          journal.applySyncRecord(remote);
          trackRemote(remote);
        }
      }

      localRecords = journal.listSyncRecords();
      if (includeUntracked) {
        for (const local of localRecords) {
          if (meta.records[local.lumloom_id]) continue;
          const remote = remoteById[local.lumloom_id];
          if (remote) {
            if (samePayload(local.payload,remote.payload)) trackRemote(remote);
            else addConflict(local,remote);
          } else {
            meta.records[local.lumloom_id] = {remoteVersion:null,dirty:true,lastSyncedAt:null};
          }
        }
      }

      for (const local of localRecords) {
        const tracked = meta.records[local.lumloom_id];
        if (!tracked?.dirty || meta.conflicts[local.lumloom_id]) continue;
        const pushed = await pushRecord(local);
        if (!pushed) {
          const latest = (await fetchRemoteRecords()).find(record => record.lumloom_id === local.lumloom_id);
          if (latest) addConflict(local,latest);
        }
      }

      saveMeta();
      render();
      const conflictCount = Object.keys(meta.conflicts).length;
      setMessage(conflictCount ? `${conflictCount}개의 기록은 사용할 내용을 확인해야 합니다.` : `동기화 완료 · ${new Intl.DateTimeFormat("ko-KR",{hour:"numeric",minute:"2-digit"}).format(new Date())}`);
    } catch (error) {
      console.error("Lumloom sync failed", error);
      setMessage(`동기화하지 못했습니다. ${error.message || "잠시 후 다시 시도해주세요."}`, true);
    } finally {
      syncing = false;
      if (queued) {
        queued = false;
        runSync(false);
      }
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => runSync(false), 900);
  }

  async function setUser(nextUser) {
    user = nextUser;
    if (user && meta.userId !== user.id) {
      meta = {userId:user.id,records:{},conflicts:{}};
      saveMeta();
    }
    render();
    if (user) await runSync(false);
  }

  async function resolveConflict(lumloomId,resolution) {
    const conflict = meta.conflicts[lumloomId];
    if (!conflict) return;
    if (resolution === "remote") {
      journal.applySyncRecord(conflict.remote);
      trackRemote(conflict.remote);
      delete meta.conflicts[lumloomId];
      saveMeta();
      render();
      setMessage("클라우드의 기록을 이 기기에 적용했습니다.");
      return;
    }
    meta.records[lumloomId] = {remoteVersion:conflict.remote.version,dirty:true,lastSyncedAt:null};
    delete meta.conflicts[lumloomId];
    saveMeta();
    await runSync(false);
  }

  $("#accountButton").addEventListener("click",openAccount);
  $("#mobileAccountButton").addEventListener("click",openAccount);
  $("#accountDialogClose").addEventListener("click",() => accountDialog.close());
  accountDialog.addEventListener("click",event => { if (event.target === accountDialog) accountDialog.close(); });
  $("#downloadLocalBackupButton").addEventListener("click",journal.downloadLocalBackup);
  $("#syncNowButton").addEventListener("click",() => runSync(false));
  $("#uploadLocalButton").addEventListener("click",() => runSync(true));
  conflictList.addEventListener("click",event => {
    const button = event.target.closest("[data-resolution]");
    const card = event.target.closest("[data-conflict-id]");
    if (button && card) resolveConflict(decodeURIComponent(card.dataset.conflictId),button.dataset.resolution);
  });

  document.addEventListener("lumloom:record-changed",event => {
    const lumloomId = event.detail?.lumloomId;
    if (!lumloomId) return;
    if (!user && !meta.userId) return;
    const existing = meta.records[lumloomId] || {remoteVersion:null,lastSyncedAt:null};
    meta.records[lumloomId] = {...existing,dirty:true};
    saveMeta();
    render();
    if (user) scheduleSync();
  });

  window.addEventListener("online",() => runSync(false));
  document.addEventListener("visibilitychange",() => { if (!document.hidden) runSync(false); });

  if (!configured) {
    render();
    return;
  }

  authForm.addEventListener("submit",async event => {
    event.preventDefault();
    const email = $("#authEmail").value.trim();
    if (!email) return;
    const submit = authForm.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "보내는 중…";
    const redirectTo = `${location.origin}${location.pathname}`;
    const {error} = await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
    submit.disabled = false;
    submit.textContent = "로그인 링크 받기";
    if (error) journal.showToast(`로그인 링크를 보내지 못했습니다: ${error.message}`);
    else {
      journal.showToast("로그인 링크를 이메일로 보냈습니다");
      setMessage("메일함에서 Lumloom 로그인 링크를 눌러주세요.");
    }
  });

  $("#signOutButton").addEventListener("click",async () => {
    const {error} = await client.auth.signOut({scope:"local"});
    if (error) setMessage(error.message,true);
  });

  client.auth.onAuthStateChange((_event,session) => {
    setTimeout(() => setUser(session?.user || null),0);
  });
  client.auth.getSession().then(({data}) => setUser(data.session?.user || null));
})();
