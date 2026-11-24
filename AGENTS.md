# AGENTS.md

AI 코딩 에이전트가 이 저장소에서 일할 때 가장 먼저 읽는 규칙 문서입니다.
기준일: 2026-11-17 (KST)

> `CLAUDE.md` 와 `AGENTS.md` 는 같은 규칙이다. Claude Code 는 `CLAUDE.md` 를, 다른 AI 코딩 도구(Codex, Cursor 등)는 `AGENTS.md` 를 읽는다. **한쪽을 고치면 다른 쪽도 똑같이 고친다.**

## 이 프로젝트

**생각하는 공방**(2026-11-24 확정, 예전 가제 삼색펜): AIPM 수업 복습 노트를 올리는 블로그입니다.
- 글은 **관리자 1명만** 씁니다. 회원은 읽기와 댓글만, 방문자는 읽기만 합니다.
- GitHub Pages로 배포하는 HTML 파일 1개와 Supabase(로그인, 데이터, 파일)로 이루어집니다.

더 읽을 문서:
| 문서 | 내용 |
| --- | --- |
| `docs/PRD.md` | 누가 무엇을 할 수 있나, 사용자 스토리, 인수 조건, 결정 사항 |
| `docs/PRD-ai-assist.md` | AI 도우미 과제 기획서 (Claude Docs 원본을 옮긴 것, 2쪽 분량) |
| `docs/ARCHITECTURE.md` | 파일 구조, 데이터 표, 권한 규칙, 화면 흐름 |
| `docs/TASKS.md` | 끝낸 일, 남은 일, 알려진 문제 |
| `docs/ANALYTICS.md` | GA4 방문 통계, 이벤트 택소노미, ASIS → TOBE |
| `CLAUDE.md` | 이 문서와 같은 규칙. Claude Code 용 |
| `README.md` | 사람을 위한 짧은 소개와 실행 방법 |
| `docs/HANDOFF-ai-assist.md` | claude.ai 채팅에서 넘어온 AI 자동화 과제 인수인계. 대화 규칙, 결정, 남은 일 |

## 파일 지도

| 파일 | 역할 |
| --- | --- |
| `index.html` | 블로그 전체. CSS, 화면, 로직이 한 파일에 있음 |
| `assets/` | 그림 파일(사용자 제공, 줄여 넣음). `hero-1408.jpg`, `hero-800.jpg` 는 첫 화면 맨 위 메인 사진, `notice-card.jpg` 는 공지 글 카드의 사진, `logo.png` 는 로고(전구와 톱니, 배경 투명), `logo-footer.png` 는 푸터용(전구 흰색, 톱니 금색), `favicon*`, `apple-touch-icon.png` 은 로고로 만든 파비콘, `portfolio/` 는 챗봇 답 아래에 붙는 예시 작품 그림(실제 포트폴리오 아님, 영상은 한 장면 jpg 만 보이고 재생하지 않는다) |
| `scripts/build-pages.js` | 글마다 검색·공유용 정적 페이지 `p/<글번호>/` 와 썸네일, 사이트맵을 만드는 생성기 |
| `p/`, `og/`, `sitemap.xml`, `robots.txt` | 생성기 결과물. **손으로 고치지 않는다** |
| `.github/workflows/seo-pages.yml` | 생성기를 하루 2번 돌려 커밋하는 GitHub Actions |
| `.github/workflows/docs-check.yml` | `CLAUDE.md`, `AGENTS.md` 가 바뀔 때만 `docs_test.js` 를 돌리는 GitHub Actions |
| `supabase-setup.sql` | 서버 표, 권한 규칙(RLS), 파일 보관함 설정. 여러 번 실행해도 안전해야 함 |
| `tests/e2e.js` | 화면 테스트 78건 (Playwright, 체험 모드, 측정 ID 를 비운 복사본으로 실행) |
| `tests/rls_test.py` | 서버 권한 테스트 25건 (로컬 PostgreSQL) |
| `tests/pages_test.js` | 검색·공유 페이지 생성기 테스트 20건 |
| `scripts/ai-assist.js` | 공개글마다 AI 결과(요약, 제목 후보, 태그, 홍보 문구)를 `ai/<글번호>.json` 에 미리 만드는 AI 도우미 |
| `ai/` | AI 도우미 결과물과 관리자 보고서, 챗봇 답(`ai/chatbot/qa.json`, 화면이 읽는 `qa.js`). **손으로 고치지 않는다** |
| `portfolio/profile.md` | 포트폴리오 안내 챗봇의 자료(사람이 쓴다). `[작성 필요]` 가 남아 있으면 챗봇이 화면에 안 나온다. 공개해도 되는 정보만 쓴다 |
| `demo/posts.json` | Supabase 미연결 때 쓰는 시연용 글 |
| `tests/ai_test.js` | AI 도우미와 챗봇 테스트 28건 (가짜 AI 서버, 돈 들지 않음) |
| `tests/docs_test.js` | `CLAUDE.md` 와 `AGENTS.md` 가 같은 규칙인지 확인하는 테스트 6건 |
| `tests/stub_supabase.sql` | 로컬에서 Supabase 를 흉내 내는 준비 파일 |
| `tests/fixtures/` | 첨부 테스트용 파일 |
| `docs/reports/` | 테스트 보고서 PDF |

## 꼭 지킬 규칙

1. **권한은 서버에서 막는다.** 화면에서 버튼을 숨기는 것만으로 끝내지 않는다. 권한이 바뀌면 `supabase-setup.sql` 의 정책도 같이 바꾼다.
2. **비밀 키를 코드에 넣지 않는다.** `index.html` 에는 Supabase 공개용(anon, publishable) 키만 넣는다. service_role, secret 키는 절대 넣지 않는다.
3. **사용자가 쓴 글자는 반드시 `esc()` 를 거쳐 화면에 넣는다.** 제목, 본문, 댓글, 파일 이름 모두 해당한다.
4. **SQL 은 다시 실행해도 안전하게 쓴다.** `create ... if not exists`, `drop policy if exists` 뒤 `create policy` 형식을 지킨다.
5. **첨부 파일은 JPG, PNG, GIF, PDF 만.** 화면(확장자, 실제 내용, 크기)과 서버(보관함 형식, 10MB) 두 곳에서 모두 막는다.
6. **시간은 한국 시간(KST)으로 보여준다.** `fmt()`, `fmtTime()` 을 쓴다.
7. **화면 글자는 한국어, 쉬운 말로 쓴다.** 오류 문구는 무엇이 잘못됐고 어떻게 고치는지 말한다.
8. **공지 내용은 마음대로 바꾸지 않는다.** `NOTICE`, `NOTICE_RULES` 는 운영 정책이다. 바꿀 때는 사람의 확인을 받는다.
9. **글별 검색 정보는 생성기로만 만든다.** 글 제목, 설명, 썸네일이 바뀌는 기능을 고치면 `scripts/build-pages.js` 와 `tests/pages_test.js` 도 같이 고친다. 생성 페이지에도 `esc()` 와 같은 처리를 한다.
11. **AI 키는 GitHub Secrets(`AI_API_KEY`)에만 둔다.** 화면 코드, 커밋, 실행 기록에 남기지 않는다. 독자가 글을 열 때 AI 를 부르는 기능은 만들지 않는다. 포트폴리오 안내 챗봇(오른쪽 아래 말풍선)도 방문자가 물을 때 AI 를 부르지 않고, 자동 실행이 미리 만든 `ai/chatbot/qa.js` 만 읽는다. AI 결과는 `scripts/ai-assist.js` 로만 만들고, 고치면 `tests/ai_test.js` 도 같이 고친다.
10. **방문 통계 이벤트는 `analytics.track()` 으로만 보낸다.** 예외는 생성기가 만드는 정적 페이지의 GA 코드 하나다(`scripts/build-pages.js`). 둘 다 이름과 값은 `docs/ANALYTICS.md` 를 따르고, 글 주소는 `p/<글번호>/` 로 맞춘다. 이메일, 댓글 본문, 비밀번호는 절대 보내지 않는다.

## 디자인 규칙

- 색 (2026-11-24 변경, 예전 파랑·남색·연파랑·빨강은 모두 없앴다):

  | 쓰임 | 밝은 모드 | 다크 모드 | CSS 변수 |
  | --- | --- | --- | --- |
  | 베이스(바탕) | `#FFFFF0` | `#353839` | `--bg` |
  | 글자 | `#2B2622` | `#FFFFFF` | `--fg` |
  | 문양 | `#2F3E63` | `#D5E8F5` | `--orange`, `--orange-fill`, `--mint` |
  | 강조 | `#E5584B` | `#C2185B` | `--red`, `--danger` |

  - CSS 변수 이름은 예전 이름 그대로다: `--red`=강조색, `--orange`/`--mint`=문양색.
  - 보조 색은 위 색을 섞어 만든다: `--muted`(흐린 글자), `--line`(선), `--soft`(옅은 바탕), `--mint-fill`(문양색을 옅게 깐 바탕).
- **강조색은 칠하는 곳에만 쓴다**: 버튼 바탕, 배지, 제목 밑줄 표시, 푸터 위 띠. 글자색으로 쓰지 않는다(바탕 대비 3.6:1, 2.0:1 이라 글자로 읽기 어렵다).
- **문양색은 제목, 링크, 테두리, 포커스 표시, 푸터에 쓴다.**
- 강조색 바탕 위 글자: 밝은 모드는 `#2B2622`, 다크 모드는 `#FFFFFF`.
- 푸터는 두 모드 모두 `#2F3E63` 바탕, 위에 강조색 띠 4px. 글자는 밝은 모드 `#FFFFF0`, 다크 모드 `#FFFFFF`(로고 이름은 두 모드 모두 `#FFFFFF`).
- 위험 표시(지우기, 추방을 한 번 눌러 확인을 기다리는 상태, 추방 배지)는 강조색 바탕 + "한 번 더 누르면…" 글자로 알린다. 오류 문구는 글자색에 강조색 왼쪽 띠를 붙인다.
- 색은 CSS 변수로만 쓴다. 다크 모드 값도 같이 정한다.
- 로고는 그림 파일 `assets/logo.png`(사용자 제공, 11-24) 하나를 밝은·다크 모드에 같이 쓴다. 블로그 헤더, 검색 페이지 머리, 공유 썸네일에 들어간다. 로고 속 파랑 `#5B8DB8`, 금색 `#B8862B` 는 그림의 색이라 기본 색 규칙 밖이다.
- 로고 글자: 이름 아래 'THINK & MAKE'를 금색 `#B8862B` 로(헤더, 푸터). 푸터는 왼쪽에 흰 전구 로고와 흰색 이름, 오른쪽에 저작권과 링크.
- 글꼴: 제목 Gothic A1, 본문 IBM Plex Sans KR, 숫자 IBM Plex Mono.
- 첫 화면 레이아웃(11-24): 맨 위 메인 사진 띠(글자 없음) → 가운데 한 줄 글 카드(왼쪽 사진: 공지는 `assets/notice-card.jpg`, 나머지는 `p/<글번호>/og.png`, 오른쪽 글) → "전체 글 보기". 옆 칸은 없다. 계정 상자는 헤더 "내 계정" 메뉴 안.
- 누르는 곳은 높이 44px 이상. 휴대폰 너비(390px)에서 옆으로 넘치면 안 된다.
- 지우기, 추방, 세 번째 경고는 두 번 눌러야 실행한다. `confirm()` 은 쓰지 않는다.

## 작업 순서

1. `docs/TASKS.md` 에서 할 일을 고른다.
2. 코드를 고친다. 권한이 걸리면 `supabase-setup.sql` 도 고친다.
3. 테스트를 돌린다. 새 기능이면 테스트 항목도 추가한다.
4. 관련 문서를 고친다: 정책이면 `docs/PRD.md`, 구조면 `docs/ARCHITECTURE.md`, 진행 상황은 `docs/TASKS.md`.
5. 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 쓴다.

## 테스트 실행

```bash
node tests/e2e.js
```
```bash
python3 tests/rls_test.py
```
```bash
node tests/pages_test.js
```
```bash
node tests/ai_test.js
```
```bash
node tests/docs_test.js
```
- `e2e.js` 는 `require('playwright')` 가 되는 환경이 필요하다. Supabase 연결 없이 체험 모드로 돌아간다.
- `rls_test.py` 는 로컬 PostgreSQL 16 과 `psql` 이 필요하다. 임시 데이터베이스를 만들고 끝나면 지운다.
- 세 테스트 모두 통과해야 배포한다.
- `CLAUDE.md` 나 `AGENTS.md` 를 고쳤으면 `docs_test.js` 를 돌린다. 한쪽만 고치면 실패한다.
- 공지를 고쳤으면 `node scripts/build-pages.js` 를 돌려 `p/notice*` 를 다시 만든다. 썸네일에 한글 글꼴이 필요하다.

## 체험 모드

`index.html` 의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 가 비어 있으면 체험 모드다.
- 로그인, 글, 댓글, 첨부가 브라우저(localStorage)에만 저장된다.
- 처음 로그인한 이메일이 관리자가 된다.
- 첨부 파일은 1MB 까지만 된다. 브라우저 저장 공간이 작기 때문이다.

## 하지 말 것

- 빌드 도구나 프레임워크를 들이지 않는다. GitHub Pages 에 파일 그대로 올라가야 한다.
  - 예외는 `scripts/build-pages.js` 하나. 사이트를 바꾸지 않고 검색용 페이지만 덧붙이며, 이 스크립트가 없어도 블로그는 그대로 돈다. package.json 은 만들지 않는다.
- 외부 스크립트를 늘리지 않는다. 지금은 Supabase JS 와 Google 태그(gtag.js) 두 개뿐이다. gtag.js 는 측정 ID 가 있을 때만 불러온다.
  - 블로그가 스스로 불러오는 파일은 저장소 안의 `ai/chatbot/qa.js`(챗봇 답 데이터) 하나다. 외부 스크립트가 아니다.
  - 주소로 데이터만 받는 외부 API 도 없다(고양이, 포켓몬 "쉬어가기"는 11-24 에 없앴다). 새로 넣으려면 사람의 확인을 받는다.
- 테스트를 통과시키려고 테스트 기대값을 바꾸지 않는다. 기능이 바뀌었으면 그 이유를 커밋에 적는다.
