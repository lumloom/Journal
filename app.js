const STORAGE_KEY = "giant-journal-v1";
const TIME_SLOTS = ["06–09", "09–12", "12–15", "15–18", "18–21", "21–24"];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = loadState();
let currentDate = todayKey();
let archiveFilter = "all";
let saveTimer;

const els = {
  dateInput: $("#dateInput"), displayDate: $("#displayDate"), displayWeekday: $("#displayWeekday"),
  focus: $("#focusInput"), workTasks: $("#workTasks"), personalTasks: $("#personalTasks"),
  taskProgress: $("#taskProgress"), timeline: $("#timeline"), memo: $("#memoInput"),
  summary: $("#summaryInput"), keepsake: $("#keepsakeInput"), keep: $("#keepToggle"),
  peopleLogList: $("#peopleLogList"), addPersonLog: $("#addPersonLogBtn"),
  saveIndicator: $("#saveIndicator"), recordGrid: $("#recordGrid"), archiveCount: $("#archiveCount"),
  search: $("#searchInput"), peopleSearch: $("#peopleSearchInput"), peopleGrid: $("#peopleGrid"), peopleSummary: $("#peopleSummary"),
  weekRange: $("#weekRange"), weekDays: $("#weekDays"),
  weeklyGems: $("#weeklyGems"), weeklyPattern: $("#weeklyPattern"), weeklyEnergy: $("#weeklyEnergy"),
  weeklyFocus: $("#weeklyFocus"), weeklyAction: $("#weeklyAction"), toast: $("#toast"),
  dialog: $("#recordDialog"), dialogContent: $("#dialogContent")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.entries && saved.weekly ? saved : { entries: {}, weekly: {} };
  } catch { return { entries: {}, weekly: {} }; }
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function blankEntry() {
  return { focus:"", tasks:{work:[],personal:[]}, timeline:TIME_SLOTS.map(() => ""), memo:"", people:[], summary:"", keepsake:"", keep:false, updatedAt:null };
}

function entryFor(date) {
  if (!state.entries[date]) state.entries[date] = blankEntry();
  const entry = state.entries[date];
  entry.tasks ||= { work:[], personal:[] };
  entry.timeline ||= TIME_SLOTS.map(() => "");
  entry.people ||= [];
  return entry;
}

function hasContent(entry) {
  return Boolean(entry.focus || entry.memo || entry.summary || entry.keepsake || entry.keep || entry.timeline.some(Boolean) || entry.people?.some(person => person.name || person.conversation || person.followUp) || [...entry.tasks.work,...entry.tasks.personal].some(t => t.text));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveIndicator.textContent = "방금 자동 저장했습니다";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => els.saveIndicator.textContent = "이 기기에 자동 저장됩니다", 1600);
}

function updateEntry(mutator) {
  const entry = entryFor(currentDate);
  mutator(entry);
  entry.updatedAt = new Date().toISOString();
  saveState();
}

function formatDate(dateKey, options = {year:"numeric",month:"long",day:"numeric"}) {
  return new Intl.DateTimeFormat("ko-KR", options).format(new Date(`${dateKey}T12:00:00`));
}

function renderToday() {
  const entry = entryFor(currentDate);
  els.dateInput.value = currentDate;
  els.displayDate.textContent = formatDate(currentDate);
  els.displayWeekday.textContent = formatDate(currentDate, {weekday:"long"});
  els.focus.value = entry.focus;
  els.memo.value = entry.memo;
  els.summary.value = entry.summary;
  els.keepsake.value = entry.keepsake;
  els.keep.setAttribute("aria-pressed", String(entry.keep));
  renderTasks("work", entry.tasks.work);
  renderTasks("personal", entry.tasks.personal);
  renderTimeline(entry.timeline);
  renderPeopleLogs(entry.people);
  updateProgress();
}

function renderTasks(type, tasks) {
  const container = type === "work" ? els.workTasks : els.personalTasks;
  container.innerHTML = "";
  tasks.forEach((task, index) => {
    const row = document.createElement("div");
    row.className = `task-row${task.done ? " done" : ""}`;
    row.innerHTML = `<input type="checkbox" ${task.done ? "checked" : ""} aria-label="할 일 완료"><input type="text" maxlength="120" placeholder="할 일을 적어주세요"><button class="delete-task" type="button" aria-label="할 일 삭제">×</button>`;
    const checkbox = $("input[type=checkbox]", row);
    const input = $("input[type=text]", row);
    input.value = task.text || "";
    checkbox.addEventListener("change", () => { updateEntry(e => e.tasks[type][index].done = checkbox.checked); row.classList.toggle("done", checkbox.checked); updateProgress(); });
    input.addEventListener("input", () => updateEntry(e => e.tasks[type][index].text = input.value));
    $("button", row).addEventListener("click", () => { updateEntry(e => e.tasks[type].splice(index,1)); renderToday(); });
    container.append(row);
  });
}

function addTask(type) {
  updateEntry(entry => entry.tasks[type].push({text:"",done:false}));
  renderTasks(type, entryFor(currentDate).tasks[type]);
  updateProgress();
  const inputs = $$(`#${type === "work" ? "workTasks" : "personalTasks"} input[type=text]`);
  inputs.at(-1)?.focus();
}

function updateProgress() {
  const tasks = [...entryFor(currentDate).tasks.work,...entryFor(currentDate).tasks.personal].filter(t => t.text);
  els.taskProgress.textContent = `${tasks.filter(t => t.done).length} / ${tasks.length} 완료`;
}

function renderTimeline(values) {
  els.timeline.innerHTML = "";
  TIME_SLOTS.forEach((slot,index) => {
    const row = document.createElement("label");
    row.className = "time-row";
    row.innerHTML = `<span class="time-label">${slot}</span><span class="time-marker"></span><textarea rows="1" aria-label="${slot} 시간 기록" placeholder="무엇을 했나요?"></textarea>`;
    const textarea = $("textarea", row);
    textarea.value = values[index] || "";
    textarea.addEventListener("input", () => updateEntry(e => e.timeline[index] = textarea.value));
    els.timeline.append(row);
  });
}

function renderPeopleLogs(people) {
  els.peopleLogList.innerHTML = "";
  if (!people.length) {
    els.peopleLogList.innerHTML = `<div class="people-log-empty">오늘 나눈 대화 중 오래 기억하고 싶은 사람이 있다면 남겨보세요.</div>`;
    return;
  }
  people.forEach((person,index) => {
    const row = document.createElement("div");
    row.className = "person-log-row";
    row.innerHTML = `<label><span>이름</span><input type="text" maxlength="60" placeholder="누구를 만났나요?"></label><label><span>대화 핵심</span><textarea placeholder="기억할 말, 결정, 느낀 점"></textarea></label><label><span>다음 행동</span><textarea placeholder="약속, 확인할 일, 다시 연락할 내용"></textarea></label><button class="delete-person-log" type="button" aria-label="사람 기록 삭제">×</button>`;
    const fields = $$("input, textarea", row);
    fields[0].value = person.name || "";
    fields[1].value = person.conversation || "";
    fields[2].value = person.followUp || "";
    fields[0].addEventListener("input", () => updateEntry(entry => entry.people[index].name = fields[0].value));
    fields[1].addEventListener("input", () => updateEntry(entry => entry.people[index].conversation = fields[1].value));
    fields[2].addEventListener("input", () => updateEntry(entry => entry.people[index].followUp = fields[2].value));
    $("button", row).addEventListener("click", () => { updateEntry(entry => entry.people.splice(index,1)); renderPeopleLogs(entryFor(currentDate).people); });
    els.peopleLogList.append(row);
  });
}

function addPersonLog() {
  updateEntry(entry => entry.people.push({name:"",conversation:"",followUp:""}));
  renderPeopleLogs(entryFor(currentDate).people);
  els.peopleLogList.querySelector(".person-log-row:last-child input")?.focus();
}

function switchView(view) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === `${view}View`));
  $$('[data-view]').forEach(el => el.classList.toggle("active", el.dataset.view === view));
  if (view === "archive") renderArchive();
  if (view === "people") renderPeople();
  if (view === "weekly") renderWeekly();
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderArchive() {
  const query = els.search.value.trim().toLowerCase();
  const records = Object.entries(state.entries)
    .filter(([,entry]) => hasContent(entry))
    .filter(([,entry]) => archiveFilter !== "kept" || entry.keep)
    .filter(([,entry]) => !query || JSON.stringify(entry).toLowerCase().includes(query))
    .sort(([a],[b]) => b.localeCompare(a));
  els.archiveCount.textContent = `${records.length}일의 기록`;
  els.recordGrid.innerHTML = "";
  if (!records.length) {
    els.recordGrid.innerHTML = `<div class="empty-state"><strong>아직 보이는 기록이 없어요.</strong>오늘의 핵심 한 줄부터 남겨보세요.</div>`;
    return;
  }
  records.forEach(([date,entry]) => {
    const card = document.createElement("button");
    card.className = "record-card";
    const taskCount = [...entry.tasks.work,...entry.tasks.personal].filter(t => t.text).length;
    const peopleCount = entry.people.filter(person => person.name || person.conversation).length;
    const meta = [taskCount ? `할 일 ${taskCount}개` : "", peopleCount ? `사람 ${peopleCount}명` : ""].filter(Boolean).join(" · ") || "하루 기록";
    card.innerHTML = `<time>${formatDate(date,{month:"long",day:"numeric",weekday:"short"})}</time><h3>${escapeHtml(entry.summary || entry.focus || "기록한 하루")}</h3><p>${escapeHtml(entry.keepsake || entry.memo || "할 일과 시간의 흐름을 기록했습니다.")}</p><footer><span>${meta}</span><span class="${entry.keep ? "gem" : ""}">${entry.keep ? "◆ 보석" : "◇"}</span></footer>`;
    card.addEventListener("click", () => openRecord(date,entry));
    els.recordGrid.append(card);
  });
}

function openRecord(date, entry) {
  const tasks = (type) => entry.tasks[type].filter(t=>t.text).map(t=>`<li>${t.done ? "✓ " : ""}${escapeHtml(t.text)}</li>`).join("") || "<li>기록 없음</li>";
  const timeline = entry.timeline.map((text,i) => text ? `<p><strong>${TIME_SLOTS[i]}</strong> ${escapeHtml(text)}</p>` : "").join("");
  const people = entry.people.filter(person => person.name || person.conversation || person.followUp).map(person => `<article><h4>${escapeHtml(person.name || "이름 미입력")}</h4><p>${escapeHtml(person.conversation || "대화 내용 없음")}</p>${person.followUp ? `<p class="follow-up"><strong>다음 행동</strong><br>${escapeHtml(person.followUp)}</p>` : ""}</article>`).join("");
  els.dialogContent.innerHTML = `<span class="dialog-date">${formatDate(date,{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</span><h2>${escapeHtml(entry.summary || entry.focus || "기록한 하루")} ${entry.keep ? '<span class="gem">◆</span>' : ""}</h2><div class="dialog-section"><h3>오늘의 핵심</h3><p>${escapeHtml(entry.focus || "—")}</p></div><div class="dialog-section dialog-tasks"><div><h3>업무</h3><ul>${tasks("work")}</ul></div><div><h3>개인</h3><ul>${tasks("personal")}</ul></div></div>${timeline ? `<div class="dialog-section"><h3>시간 기록</h3>${timeline}</div>` : ""}<div class="dialog-section"><h3>메모</h3><p>${escapeHtml(entry.memo || "—")}</p></div>${people ? `<div class="dialog-section person-history"><h3>만난 사람</h3>${people}</div>` : ""}<div class="dialog-section"><h3>남길 내용</h3><p>${escapeHtml(entry.keepsake || "—")}</p></div><div class="dialog-actions"><button class="primary-button" id="editRecordBtn" type="button">이 날 기록 수정하기</button><button class="icon-button" id="exportRecordBtn" type="button">MD 저장</button></div>`;
  $("#editRecordBtn").addEventListener("click", () => { currentDate = date; els.dialog.close(); renderToday(); switchView("today"); });
  $("#exportRecordBtn").addEventListener("click", () => exportEntryMarkdown(date,entry));
  els.dialog.showModal();
}

function collectPeople() {
  const groups = new Map();
  Object.entries(state.entries).forEach(([date,entry]) => {
    (entry.people || []).forEach(person => {
      const name = person.name.trim();
      if (!name) return;
      const key = name.toLocaleLowerCase("ko-KR");
      if (!groups.has(key)) groups.set(key,{name,records:[]});
      groups.get(key).records.push({date,conversation:person.conversation.trim(),followUp:person.followUp.trim()});
    });
  });
  return [...groups.values()].map(group => ({...group,records:group.records.sort((a,b)=>b.date.localeCompare(a.date))})).sort((a,b) => b.records[0].date.localeCompare(a.records[0].date));
}

function renderPeople() {
  const query = els.peopleSearch.value.trim().toLocaleLowerCase("ko-KR");
  const people = collectPeople().filter(person => !query || person.name.toLocaleLowerCase("ko-KR").includes(query) || person.records.some(record => `${record.conversation} ${record.followUp}`.toLocaleLowerCase("ko-KR").includes(query)));
  els.peopleSummary.textContent = `${people.length}명의 사람 · ${people.reduce((sum,person)=>sum+person.records.length,0)}개의 대화 기록`;
  els.peopleGrid.innerHTML = "";
  if (!people.length) {
    els.peopleGrid.innerHTML = `<div class="empty-state"><strong>아직 사람 기록이 없어요.</strong>오늘 화면에서 만난 사람과 대화의 핵심을 남겨보세요.</div>`;
    return;
  }
  people.forEach(person => {
    const card = document.createElement("button");
    card.className = "person-card";
    const latest = person.records[0];
    card.innerHTML = `<span class="person-avatar">${escapeHtml(person.name.slice(0,1))}</span><h3>${escapeHtml(person.name)}</h3><span class="person-meta">최근 ${formatDate(latest.date,{year:"numeric",month:"short",day:"numeric"})}</span><p>${escapeHtml(latest.conversation || latest.followUp || "대화의 핵심을 기록했습니다.")}</p><footer><span>${person.records.length}번의 만남</span><span>모아보기 →</span></footer>`;
    card.addEventListener("click", () => openPerson(person));
    els.peopleGrid.append(card);
  });
}

function openPerson(person) {
  const history = person.records.map(record => `<article><time>${formatDate(record.date,{year:"numeric",month:"long",day:"numeric",weekday:"short"})}</time><h4>대화 핵심</h4><p>${escapeHtml(record.conversation || "—")}</p>${record.followUp ? `<p class="follow-up"><strong>다음 행동</strong><br>${escapeHtml(record.followUp)}</p>` : ""}</article>`).join("");
  els.dialogContent.innerHTML = `<span class="dialog-date">PEOPLE NOTE</span><h2>${escapeHtml(person.name)}</h2><div class="person-history">${history}</div><div class="dialog-actions"><button class="primary-button" id="exportPersonBtn" type="button">사람 기록 MD</button></div>`;
  $("#exportPersonBtn").addEventListener("click", () => exportPersonMarkdown(person));
  els.dialog.showModal();
}

function weekStartKey(dateKey = todayKey()) {
  const date = new Date(`${dateKey}T12:00:00`);
  const day = (date.getDay()+6)%7;
  date.setDate(date.getDate()-day);
  return localKey(date);
}

function localKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }

function renderWeekly() {
  const startKey = weekStartKey();
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(start); end.setDate(end.getDate()+6);
  els.weekRange.textContent = `${formatDate(startKey,{month:"long",day:"numeric"})} – ${formatDate(localKey(end),{month:"long",day:"numeric"})}`;
  els.weekDays.innerHTML = "";
  for (let i=0;i<7;i++) {
    const date = new Date(start); date.setDate(date.getDate()+i);
    const key = localKey(date); const entry = state.entries[key];
    const row = document.createElement("div"); row.className="week-day";
    row.innerHTML = `<strong>${formatDate(key,{weekday:"short",day:"numeric"})}</strong><p>${escapeHtml(entry?.summary || entry?.focus || "기록 없음")}</p><span class="gem">${entry?.keep ? "◆" : ""}</span>`;
    els.weekDays.append(row);
  }
  const review = state.weekly[startKey] || {};
  els.weeklyGems.value = review.gems || ""; els.weeklyPattern.value = review.pattern || "";
  els.weeklyEnergy.value = review.energy || ""; els.weeklyFocus.value = review.focus || ""; els.weeklyAction.value = review.action || "";
}

function saveWeekly() {
  const key = weekStartKey();
  state.weekly[key] = {gems:els.weeklyGems.value, pattern:els.weeklyPattern.value, energy:els.weeklyEnergy.value, focus:els.weeklyFocus.value, action:els.weeklyAction.value, updatedAt:new Date().toISOString()};
  saveState(); showToast("이번 주 회고를 저장했습니다");
}

function yamlQuote(value="") { return `"${String(value).replaceAll("\\","\\\\").replaceAll('"','\\"').replaceAll("\n"," ")}"`; }
function safeFilename(value="기록") { return value.replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim() || "기록"; }
function personLinks(entry) { return [...new Set((entry.people || []).map(person=>person.name.trim()).filter(Boolean))]; }

function entryMarkdown(date,entry,{frontmatter=true,headingLevel=1}={}) {
  const people = personLinks(entry);
  const lines = [];
  if (frontmatter) {
    lines.push("---",`type: daily`,`date: ${date}`,`summary: ${yamlQuote(entry.summary || entry.focus)}`,`keep: ${entry.keep ? "true" : "false"}`,`people: [${people.map(name=>yamlQuote(`[[${name}]]`)).join(", ")}]`,"---","");
  }
  const prefix = "#".repeat(headingLevel);
  lines.push(`${prefix} ${date} ${entry.summary || entry.focus || "하루 기록"}`,"");
  if (entry.focus) lines.push(`${prefix}# 오늘의 핵심`,"",entry.focus,"");
  const tasks = (type,label) => {
    const items = entry.tasks[type].filter(task=>task.text);
    if (!items.length) return;
    lines.push(`${prefix}# ${label}`,"",...items.map(task=>`- [${task.done ? "x" : " "}] ${task.text}`),"");
  };
  tasks("work","업무"); tasks("personal","개인");
  const timeItems = entry.timeline.map((text,index)=>text ? `- **${TIME_SLOTS[index]}** ${text}` : "").filter(Boolean);
  if (timeItems.length) lines.push(`${prefix}# 시간 기록`,"",...timeItems,"");
  if (entry.memo) lines.push(`${prefix}# 메모`,"",entry.memo,"");
  const peopleItems = (entry.people || []).filter(person=>person.name || person.conversation || person.followUp);
  if (peopleItems.length) {
    lines.push(`${prefix}# 만난 사람`,"");
    peopleItems.forEach(person => {
      lines.push(`${prefix}## [[${person.name.trim() || "이름 미입력"}]]`,"");
      if (person.conversation) lines.push("**대화 핵심**",person.conversation,"");
      if (person.followUp) lines.push("**다음 행동**",`- [ ] ${person.followUp}`,"");
    });
  }
  if (entry.keepsake) lines.push(`${prefix}# 남길 내용`,"",entry.keepsake,"");
  return lines.join("\n").trim();
}

function downloadMarkdown(filename,content) {
  const blob = new Blob([content],{type:"text/markdown;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast(`${filename} 파일을 만들었습니다`);
}

function exportEntryMarkdown(date,entry=entryFor(date)) {
  if (!hasContent(entry)) { showToast("내보낼 기록이 아직 없어요"); return; }
  downloadMarkdown(`${date}.md`,entryMarkdown(date,entry));
}

function exportAllMarkdown() {
  const records = Object.entries(state.entries).filter(([,entry])=>hasContent(entry)).sort(([a],[b])=>a.localeCompare(b));
  if (!records.length) { showToast("내보낼 기록이 아직 없어요"); return; }
  const allPeople = [...new Set(records.flatMap(([,entry])=>personLinks(entry)))];
  const lines = ["---","type: journal-export",`exported: ${todayKey()}`,`people: [${allPeople.map(name=>yamlQuote(`[[${name}]]`)).join(", ")}]`,"---","","# 기록 모음",""];
  records.forEach(([date,entry]) => lines.push(entryMarkdown(date,entry,{frontmatter:false,headingLevel:2}),"","---",""));
  const weekly = Object.entries(state.weekly).sort(([a],[b])=>a.localeCompare(b));
  if (weekly.length) {
    lines.push("# 주간 회고","");
    weekly.forEach(([date,review]) => lines.push(`## ${date} 주간`,"",review.gems ? `### 세 가지 보석\n\n${review.gems}\n` : "",review.pattern ? `### 반복한 패턴\n\n${review.pattern}\n` : "",review.energy ? `### 에너지\n\n${review.energy}\n` : "",review.focus ? `### 다음 주 중심\n\n${review.focus}\n` : "",review.action ? `### 첫 행동\n\n- [ ] ${review.action}\n` : ""));
  }
  downloadMarkdown(`Journal-${todayKey()}.md`,lines.filter(line=>line!==undefined).join("\n").trim());
}

function exportPersonMarkdown(person) {
  const lines = ["---","type: person",`name: ${yamlQuote(person.name)}`,`aliases: [${yamlQuote(person.name)}]`,`updated: ${person.records[0]?.date || todayKey()}`,"---","",`# ${person.name}`,""];
  person.records.slice().reverse().forEach(record => lines.push(`## [[${record.date}]]`,"",record.conversation || "대화 내용 없음","",record.followUp ? `**다음 행동**\n\n- [ ] ${record.followUp}\n` : ""));
  downloadMarkdown(`${safeFilename(person.name)}.md`,lines.join("\n").trim());
}

function escapeHtml(value="") { const div=document.createElement("div"); div.textContent=value; return div.innerHTML; }
function showToast(message) { els.toast.textContent=message; els.toast.classList.add("show"); setTimeout(()=>els.toast.classList.remove("show"),1800); }

$$('[data-view]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
$$('[data-task-type]').forEach(button => button.addEventListener("click", () => addTask(button.dataset.taskType)));
els.addPersonLog.addEventListener("click",addPersonLog);
els.dateInput.addEventListener("change", () => { if(els.dateInput.value){currentDate=els.dateInput.value;renderToday();} });
$("#goTodayBtn").addEventListener("click", () => {currentDate=todayKey();renderToday();});
$("#exportTodayBtn").addEventListener("click", () => exportEntryMarkdown(currentDate));
$("#exportAllBtn").addEventListener("click", exportAllMarkdown);
els.focus.addEventListener("input",()=>updateEntry(e=>e.focus=els.focus.value));
els.memo.addEventListener("input",()=>updateEntry(e=>e.memo=els.memo.value));
els.summary.addEventListener("input",()=>updateEntry(e=>e.summary=els.summary.value));
els.keepsake.addEventListener("input",()=>updateEntry(e=>e.keepsake=els.keepsake.value));
els.keep.addEventListener("click",()=>{updateEntry(e=>e.keep=!e.keep);els.keep.setAttribute("aria-pressed",String(entryFor(currentDate).keep));showToast(entryFor(currentDate).keep?"보석으로 남겼습니다":"보석 표시를 해제했습니다");});
els.search.addEventListener("input",renderArchive);
els.peopleSearch.addEventListener("input",renderPeople);
$$('[data-filter]').forEach(button=>button.addEventListener("click",()=>{archiveFilter=button.dataset.filter;$$('[data-filter]').forEach(el=>el.classList.toggle("active",el===button));renderArchive();}));
$("#saveWeeklyBtn").addEventListener("click",saveWeekly);
$("#dialogClose").addEventListener("click",()=>els.dialog.close());
els.dialog.addEventListener("click",event=>{if(event.target===els.dialog)els.dialog.close();});
window.addEventListener("storage",event=>{if(event.key===STORAGE_KEY)location.reload();});

renderToday();
