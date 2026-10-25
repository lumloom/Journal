# Lumloom 계정 동기화 설정

거인의기록은 기존 브라우저 저장소인 `giant-journal-v1`을 그대로 유지하고, 로그인한 경우에만 Supabase와 기록을 동기화합니다. Markdown, ZIP, Obsidian 저장 형식은 변경하지 않습니다.

## 1. Lumloom Supabase 프로젝트 만들기

Supabase에서 Lumloom 앱들이 함께 사용할 프로젝트를 하나 만듭니다. Journal, Yeoun, Leaf마다 프로젝트를 따로 만들지 않습니다.

## 2. 데이터베이스 만들기

Supabase Dashboard의 SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql)을 실행합니다. 이 SQL은 다음을 설정합니다.

- 사용자와 `lumloom_id` 조합을 기본 키로 사용하는 `journal_records`
- 로그인 사용자 본인의 행만 접근할 수 있는 RLS 정책
- 일일 기록과 주간 회고의 버전 번호 및 수정 시각
- 충돌 감지를 위한 낙관적 버전 필드

## 3. 이메일 로그인 설정

Authentication에서 이메일 로그인을 활성화하고 URL Configuration에 다음 주소를 등록합니다.

- Site URL: `https://lumloom.github.io/Journal/`
- Additional Redirect URL: `http://127.0.0.1:4188/**`
- Additional Redirect URL: `http://localhost:4188/**`

공개 회원가입을 원하지 않으면 Supabase에서 가입을 제한하거나 허용할 이메일만 초대합니다.

## 4. 웹앱 연결 정보 입력

Supabase의 Project URL과 **Publishable key**를 [`supabase-config.js`](./supabase-config.js)에 입력합니다.

```js
window.LUMLOOM_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  publishableKey: "sb_publishable_..."
};
```

Publishable key는 브라우저용 공개 키입니다. `secret` 또는 `service_role` 키는 절대로 이 저장소나 브라우저 코드에 넣지 않습니다.

## 5. 첫 기록 업로드

1. 변경 전 `JSON 백업`으로 이 기기 기록을 보관합니다.
2. Lumloom 계정에서 이메일 로그인 링크를 요청합니다.
3. 이메일 링크로 로그인합니다.
4. 계정 창의 로컬·클라우드 기록 수를 확인합니다.
5. `이 기기 기록 올리기`를 눌러 기존 기록을 처음 업로드합니다.

같은 `lumloom_id`가 이 기기와 클라우드에서 서로 다르게 수정된 경우 자동으로 덮어쓰지 않습니다. 계정 창에서 `이 기기 내용 사용` 또는 `클라우드 내용 사용`을 선택해야 합니다.

## 데이터 경계

- 앱 원본: 브라우저 `giant-journal-v1`
- 동기화 상태: 브라우저 `lumloom-journal-sync-v1`
- 클라우드 원본: Supabase `public.journal_records`
- 장기 보관: 기존 Markdown/ZIP 내보내기
- Obsidian: 기존 단방향 직접 저장이며 Supabase 동기화와 별개
