# 거인의기록 (Journal)

노션이나 옵시디언 없이도 브라우저에서 바로 기록하고, 필요할 때 Lumloom Vault로 옮길 수 있는 개인 기록 웹앱입니다.

**서비스:** https://lumloom.github.io/Journal/

## 기능

- 날짜별 오늘의 핵심
- 업무·개인 할 일과 완료 상태
- 6개 시간대 기록
- 자유 메모, 하루 한 문장, 남길 내용
- 만난 사람별 대화 핵심과 다음 행동 기록
- 같은 사람의 대화 기록을 날짜순으로 모아보기
- 날짜별 기록 삭제 및 다른 기기로 삭제 상태 동기화
- 월간 달력에서 기록일·보석·사람 대화 수 확인 및 날짜별 기록 열기
- 다시 볼 기록을 보석으로 선별
- 지난 기록 검색 및 보석 필터
- 최근 7일을 바탕으로 한 주간 회고
- 오늘·전체·사람별 Obsidian용 Markdown 내보내기와 전체 ZIP 저장
- 현재 날짜 기록을 `Lumloom` Vault의 `01. 수집함/Journal`로 보내는 `Obsidian에 저장`
- 브라우저 `localStorage` 자동 저장
- Lumloom 계정 기반 Supabase 기기간 동기화
- 아이패드 세로·가로 및 홈 화면 웹앱 대응

## 실행

PowerShell에서 다음 명령을 실행합니다.

```powershell
cd C:\Users\lmj89\Documents\Codex\Journal-deploy
python -m http.server 4188
```

브라우저에서 `http://127.0.0.1:4188/`을 엽니다.

현재 기록은 사용 중인 브라우저와 사이트 주소에 저장됩니다. 브라우저 데이터를 지우면 기록도 삭제될 수 있습니다.

Supabase 연결 전에는 기존과 동일하게 브라우저에만 저장됩니다. Lumloom 계정 동기화를 활성화하려면 [`SYNC_SETUP.md`](./SYNC_SETUP.md)의 순서대로 프로젝트와 데이터베이스를 설정합니다. 기존 `giant-journal-v1` 데이터는 자동으로 변경되거나 업로드되지 않으며, 로그인 후 사용자가 `이 기기 기록 올리기`를 눌러야 첫 업로드가 시작됩니다.

## Markdown과 Obsidian 저장

내보낸 Markdown은 공통 `lumloom-record/v1` frontmatter를 사용합니다. 날짜와 사람 속성, 할 일 체크박스, `[[사람 이름]]`과 `[[날짜]]` 형태의 Obsidian 내부 링크가 포함되며, 같은 기록은 `lumloom_id: journal-daily-<날짜>`로 식별합니다.

`Obsidian에 저장`은 `Lumloom` Vault의 `01. 수집함/Journal`에 새 파일을 요청합니다. 짧은 기록은 URI 내용으로 전달하고, URI가 길어지면 공식 `clipboard` 매개변수 방식으로 자동 전환합니다. 긴 기록에서 브라우저가 클립보드 권한을 요청하면 허용해야 하며, 권한을 사용할 수 없는 환경에서는 기존 `MD 저장`을 이용할 수 있습니다.

저장 요청에는 Obsidian `x-success` 콜백을 붙입니다. 성공 콜백이 돌아오면 저장 완료를 알리고, 콜백 없이 앱으로 돌아오거나 URI 호출이 차단되면 `Lumloom` Vault가 없거나 이름이 다를 가능성과 `MD 저장` 대안을 안내합니다. 웹앱은 Vault 부재 원인을 직접 판별할 수 없으므로 실패 원인을 단정하지 않습니다.

수집함에 들어온 기록의 최종 분류와 사람 페이지 갱신은 웹앱이 아니라 별도의 Lumloom Bridge가 담당합니다. 웹앱 자체는 Vault 폴더를 검색하거나 다른 Vault를 임의로 선택하지 않습니다.
