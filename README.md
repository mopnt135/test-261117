# 생각하는 공방 블로그

AIPM 수업에서 생각하고 만든 것을 기록하는 복습 노트 블로그입니다. 영어 이름은 THINK & MAKE 입니다.
글은 관리자만 쓰고, 회원은 읽고 댓글을 달 수 있습니다.

- 주소: https://mopnt135.github.io/thinkandmake/
- 구성: `index.html` 하나 + Supabase(로그인, 데이터, 첨부 파일). 빌드 도구 없이 GitHub Pages 에 파일 그대로 올라갑니다.
- 지금은 Supabase 를 연결하지 않은 **체험 모드**입니다. 아래 [체험 모드](#체험-모드) 를 봅니다.

## 무엇이 있나

| 기능 | 설명 |
| --- | --- |
| 글과 공지 | 공지 2편, 글 카드(왼쪽 사진, 오른쪽 글), 분류 버튼, 검색 |
| 글 메뉴 | 헤더 "글 목록" 소메뉴와 첫 화면 글씨 카드: 기획, 이미지, 오늘의 프롬프트 |
| 파일 글 | 소개 글, 기획 PDF 2편(내려받기), 오늘의 프롬프트 1편(복사 버튼), 이미지 3편. `index.html` 안에 있어 모든 방문자에게 보입니다 |
| 댓글과 관리 | 답글, 관리자 삭제, 경고 3회면 자동 추방, 관리자 댓글 현황과 회원 관리 |
| AI 3줄 요약 | 글마다 AI 가 미리 만든 요약. 관리자용 제목 후보, 태그, SNS 문구 보고서 |
| 포트폴리오 챗봇 | 오른쪽 아래 블로그 로고와 "질문해주세요" 버튼. 미리 만든 답(30여 개)으로 블로그와 포트폴리오 질문에 답합니다 |
| 검색·공유 페이지 | 글마다 `p/글번호/` 정적 페이지와 1200×630 썸네일, 사이트맵 |
| 디자인 | 밝은·다크 모드, 휴대폰 390px, 누르는 곳 44px 이상 |

## 문서

| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | AI 코딩 에이전트 작업 규칙 (Claude Code 용) |
| [AGENTS.md](AGENTS.md) | 같은 규칙 (Codex, Cursor 등 다른 AI 코딩 도구용) |
| [docs/PRD.md](docs/PRD.md) | 블로그 전체: 권한, 사용자 스토리, 결정 사항 (11-25 최신) |
| [docs/PRD-thinkandmake.md](docs/PRD-thinkandmake.md) | 블로그 과제 기획서 v1.0 ([PDF](docs/PRD-thinkandmake.pdf), 약 2.5쪽) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조, 데이터 표, 권한 규칙, 화면 흐름 |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | GA4 방문 통계와 이벤트 |
| [docs/TASKS.md](docs/TASKS.md) | 끝낸 일과 남은 일 |
| [docs/reports/2026-11-25-test-report.pdf](docs/reports/2026-11-25-test-report.pdf) | 최신 테스트 보고서 (2쪽, 177건 통과). [지난 보고서](docs/reports/) |

## 체험 모드

`index.html` 의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 가 비어 있으면 체험 모드입니다.

- 로그인, 글, 댓글, 첨부가 **방문자 각자의 브라우저에만** 저장됩니다. 다른 방문자에게는 보이지 않습니다.
- 모두에게 보여야 하는 글은 `index.html` 안의 파일 글(`ABOUT`, `PLAN_1~2`, `PROMPT_1`, `IMAGE_1~3`)로 둡니다. 고치면 `node scripts/build-pages.js` 로 검색 페이지도 다시 만듭니다. 내용은 사람의 확인을 받고 고칩니다.
- 관리자는 화면 아래 "관리자 로그인"에서 **비밀번호만** 넣어 들어옵니다. 비밀번호는 관리자에게 물어봅니다. 코드에는 비밀번호 대신 SHA-256 값만 있습니다. 이메일로 로그인하면 모두 회원입니다.
- 처음 열면 예시 회원 6명과 예시 댓글 12개가 들어갑니다. 화면에 "예시" 표시가 붙고, 이메일은 example.com 주소만 씁니다.
- 첨부 파일은 1MB 까지만 됩니다.

## AI 도우미와 챗봇

글마다 AI 가 3줄 요약(독자용)과 제목 후보, 태그, SNS 홍보 문구(관리자용)를 미리 만듭니다. 챗봇 답도 같은 자동 실행이 `portfolio/profile.md` 와 공개글로 미리 만듭니다.
독자가 글을 보거나 챗봇에 물을 때는 AI 를 부르지 않아 비용이 들지 않고 키도 드러나지 않습니다.

- 관리자 보고서: https://mopnt135.github.io/thinkandmake/ai/
- 진짜 AI 를 쓰려면 저장소 Settings > Secrets and variables > Actions 에서 `AI_API_KEY` 를 등록합니다. 기본은 Claude 키(모델 `claude-opus-5-5`)이고, 공식 SDK `@anthropic-ai/sdk` 는 자동 실행이 설치합니다.
- 키가 없거나 끝나면 새 글은 시연용 가짜 AI 결과로 만들고 "시연용"이라고 표시합니다. 이미 만든 진짜 결과와 챗봇 답은 지우지 않습니다.
- 지금 키는 수업에서 받은 무료 키로 **2026-11-25 18:00 KST 에 끝납니다.** 끝나면 Secrets 에서 `AI_API_KEY` 를 지웁니다. 새 키가 생기면 다시 등록합니다.
- 모델 이름은 Variables 의 `AI_MODEL`, Gemini 키를 쓰려면 Variables 의 `AI_PROVIDER` 를 `gemini` 로 둡니다.
- 챗봇 자료는 `portfolio/profile.md` 를 고칩니다. `[작성 필요]` 가 남아 있으면 챗봇 버튼이 보이지 않습니다. 공개해도 되는 정보만 씁니다.
- Supabase 를 연결하기 전에는 `demo/posts.json` 의 시연용 글로 돕니다.

## 자동 실행 (GitHub Actions)

저장소에는 자동으로 도는 작업이 두 개 있습니다. 결과는 저장소의 Actions 탭에서 봅니다. 초록 체크는 성공, 빨간 X 는 실패입니다.

| 이름 | 파일 | 언제 도나 | 하는 일 |
| --- | --- | --- | --- |
| 검색·공유 페이지 만들기 | `.github/workflows/seo-pages.yml` | 매일 06:17, 18:17 KST. `index.html`, 생성기, AI 도우미, 시연용 글, 챗봇 자료가 바뀔 때 | AI 테스트 → AI 결과(먼저 올림) → 글꼴 설치 → 글별 정적 페이지, 썸네일, 사이트맵을 만들고 저장소에 올림. 제한 시간 40분 |
| 규칙 문서 확인 | `.github/workflows/docs-check.yml` | `CLAUDE.md`, `AGENTS.md`, `tests/docs_test.js` 가 바뀔 때만 | 두 규칙 문서가 같은지 확인. 아무것도 올리지 않음 |

- 처음 한 번은 저장소 Settings > Actions > General 에서 "Read and write permissions" 를 켜야 합니다.
- 두 작업 모두 Actions 탭에서 작업 이름을 고른 뒤 "Run workflow" 를 눌러 바로 돌릴 수 있습니다.
- AI 테스트가 실패하면 진짜 AI 를 부르지 않고 멈춥니다. AI 결과는 글꼴 설치 전에 먼저 올리므로, 뒤 단계가 느려 잘려도 남습니다.
- 새 글의 검색·공유 페이지는 다음 자동 실행 때 생깁니다(최대 반나절).
- "규칙 문서 확인"이 실패하면 `CLAUDE.md` 와 `AGENTS.md` 중 한쪽만 고친 것입니다. 실행 기록에 몇 번째 줄이 다른지 나오니 두 파일을 똑같이 맞춥니다.

## Supabase 연결

1. Supabase 프로젝트를 만들고 SQL Editor 에서 `supabase-setup.sql` 을 실행합니다.
2. `index.html` 의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 에 프로젝트 주소와 공개용 키를 넣습니다. service_role, secret 키는 절대 넣지 않습니다.
3. 블로그에서 회원가입한 뒤 `supabase-setup.sql` 맨 아래 줄로 내 계정을 관리자로 지정합니다. 이때부터 관리자도 이메일과 비밀번호로 로그인하고 서버가 확인합니다. 체험 모드 비밀번호와 다른, 길고 추측하기 어려운 비밀번호를 씁니다.

## 테스트

다섯 테스트 모두 통과해야 배포합니다. 11-25 기준 177건이 모두 통과했습니다.

| 테스트 | 건수 | 필요한 것 |
| --- | --- | --- |
| `node tests/e2e.js` | 화면 90 | Playwright (체험 모드로 돔) |
| `python3 tests/rls_test.py` | 서버 권한 25 | 로컬 PostgreSQL 16 서버 켜기(`service postgresql start`) |
| `node tests/pages_test.js` | 검색·공유 생성기 24 | Node |
| `node tests/ai_test.js` | AI 도우미·챗봇 32 | Node (가짜 AI 서버, 돈 들지 않음) |
| `node tests/docs_test.js` | 규칙 문서 6 | Node |

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
