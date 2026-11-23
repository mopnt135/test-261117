# CLAUDE.md

AI 코딩 에이전트가 이 저장소에서 일할 때 가장 먼저 읽는 규칙 문서입니다.
기준일: 2026-11-17 (KST)

## 이 프로젝트

**삼색펜**: AIPM 수업 복습 노트를 올리는 블로그입니다.
- 글은 **관리자 1명만** 씁니다. 회원은 읽기와 댓글만, 방문자는 읽기만 합니다.
- GitHub Pages로 배포하는 HTML 파일 1개와 Supabase(로그인, 데이터, 파일)로 이루어집니다.

더 읽을 문서:
| 문서 | 내용 |
| --- | --- |
| `docs/PRD.md` | 누가 무엇을 할 수 있나, 사용자 스토리, 인수 조건, 결정 사항 |
| `docs/ARCHITECTURE.md` | 파일 구조, 데이터 표, 권한 규칙, 화면 흐름 |
| `docs/TASKS.md` | 끝낸 일, 남은 일, 알려진 문제 |
| `docs/ANALYTICS.md` | GA4 방문 통계, 이벤트 택소노미, ASIS → TOBE |
| `README.md` | 사람을 위한 짧은 소개와 실행 방법 |

## 파일 지도

| 파일 | 역할 |
| --- | --- |
| `index.html` | 블로그 전체. CSS, 화면, 로직이 한 파일에 있음 |
| `scripts/build-pages.js` | 글마다 검색·공유용 정적 페이지 `p/<글번호>/` 와 썸네일, 사이트맵을 만드는 생성기 |
| `p/`, `og/`, `sitemap.xml`, `robots.txt` | 생성기 결과물. **손으로 고치지 않는다** |
| `.github/workflows/seo-pages.yml` | 생성기를 하루 2번 돌려 커밋하는 GitHub Actions |
| `supabase-setup.sql` | 서버 표, 권한 규칙(RLS), 파일 보관함 설정. 여러 번 실행해도 안전해야 함 |
| `tests/e2e.js` | 화면 테스트 73건 (Playwright, 체험 모드, 측정 ID 를 비운 복사본으로 실행) |
| `tests/rls_test.py` | 서버 권한 테스트 25건 (로컬 PostgreSQL) |
| `tests/pages_test.js` | 검색·공유 페이지 생성기 테스트 18건 |
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
10. **방문 통계 이벤트는 `analytics.track()` 으로만 보낸다.** 예외는 생성기가 만드는 정적 페이지의 GA 코드 하나다(`scripts/build-pages.js`). 둘 다 이름과 값은 `docs/ANALYTICS.md` 를 따르고, 글 주소는 `p/<글번호>/` 로 맞춘다. 이메일, 댓글 본문, 비밀번호는 절대 보내지 않는다.

## 디자인 규칙

- 기본 색 5가지(2026-11-23 변경): **파랑 `#005A9C`, 남색 `#003153`, 연파랑 `#D9E6F0`, 검정 `#1C1C1C`, 흰색 `#FFFFFF`**.
  - 강조 3단계: **파랑(1순위) > 남색(2순위) > 연파랑(3순위)**. CSS 변수 이름은 예전 이름 그대로다: `--red`=1순위, `--orange`/`--orange-fill`=2순위, `--mint`/`--mint-fill`=3순위.
  - 보조 회색 `--muted #4A5866`, `--line #B9C9D8`, `--soft #EEF3F8` 은 기본 색에서 만든 색이다.
  - 다크모드: 바탕 `#1C1C1C`, 글자 `#D9E6F0`, 파랑 대신 밝은 파랑 `#5CAEEA`(파랑 `#005A9C` 는 어두운 바탕에서 대비 2.4:1 이라 글자로 못 쓴다).
  - **파랑 글자를 남색이나 검정 바탕에 올리지 않는다** (대비 1.9:1, 2.4:1).
- 푸터는 남색 `#003153` 바탕에 흰 글자(다크모드는 연파랑 글자). 남색 위에는 파랑 글자나 파랑 테두리를 쓰지 않는다.
- **위험 색 `--danger` (빨강 `#B42318`, 다크모드 `#FF7A6E`) 은 되돌릴 수 없는 조치에만 쓴다**: 지우기, 추방을 한 번 눌러 확인을 기다리는 상태, 오류 문구, 추방 배지. 다른 곳에는 쓰지 않는다.
- 밝은 색(연파랑)으로 칠한 바탕 위 글자는 검정이나 남색으로, 진한 색(파랑, 남색) 바탕 위 글자는 흰색으로 쓴다.
- 색은 CSS 변수(`--red`, `--orange-fill`, `--mint-fill`, `--danger` 등)로만 쓴다. 다크모드 값도 같이 정한다.
- 글꼴: 제목 Gothic A1, 본문 IBM Plex Sans KR, 숫자 IBM Plex Mono.
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
- `e2e.js` 는 `require('playwright')` 가 되는 환경이 필요하다. Supabase 연결 없이 체험 모드로 돌아간다.
- `rls_test.py` 는 로컬 PostgreSQL 16 과 `psql` 이 필요하다. 임시 데이터베이스를 만들고 끝나면 지운다.
- 세 테스트 모두 통과해야 배포한다.
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
  - 스크립트 없이 주소로 데이터만 받는 외부 API 는 두 개다: The Cat API, PokéAPI (첫 화면 "쉬어가기"). 방문자가 누를 때만 부르고, 받은 글자는 `esc()`, 그림 주소는 정해진 https 주소만 쓴다. 테스트는 가짜 응답으로 돈다.
- 테스트를 통과시키려고 테스트 기대값을 바꾸지 않는다. 기능이 바뀌었으면 그 이유를 커밋에 적는다.
