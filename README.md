# 삼색펜 블로그

AIPM 수업 복습 노트를 올리는 블로그입니다.
글은 관리자만 쓰고, 회원은 읽고 댓글을 달 수 있습니다.

- 주소: https://mopnt135.github.io/test-261117/
- 구성: `index.html` 하나 + Supabase(로그인, 데이터, 첨부 파일)
- Supabase 를 연결하지 않으면 브라우저에만 저장되는 체험 모드로 동작합니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | AI 코딩 에이전트 작업 규칙 (Claude Code 용) |
| [AGENTS.md](AGENTS.md) | 같은 규칙 (Codex, Cursor 등 다른 AI 코딩 도구용) |
| [docs/PRD.md](docs/PRD.md) | 권한, 사용자 스토리, 결정 사항 |
| [docs/PRD-ai-assist.md](docs/PRD-ai-assist.md) | AI 도우미 과제 기획서 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조, 데이터 표, 권한 규칙 |
| [docs/TASKS.md](docs/TASKS.md) | 끝낸 일과 남은 일 |
| [docs/reports/](docs/reports/) | 테스트 보고서 |

## 검색과 공유 미리보기

글마다 `p/글번호/` 주소의 정적 페이지와 썸네일이 자동으로 만들어집니다.
GitHub Actions 가 하루 두 번 돌고, Actions 탭에서 "검색·공유 페이지 만들기"를 눌러 바로 만들 수도 있습니다.
처음 한 번은 저장소 Settings > Actions > General 에서 "Read and write permissions" 를 켜야 합니다.

## AI 도우미

글마다 AI 가 3줄 요약(독자용)과 제목 후보, 태그, SNS 홍보 문구(관리자용)를 미리 만듭니다.
위 GitHub Actions 가 같이 돌립니다. 독자가 글을 볼 때는 AI 를 부르지 않아 비용이 들지 않습니다.

- 관리자 보고서: https://mopnt135.github.io/test-261117/ai/
- AI 키가 없으면 시연용 가짜 AI 로 만듭니다. 결과에 "시연용"이라고 표시됩니다.
- 진짜 AI 를 쓰려면 저장소 Settings > Secrets and variables > Actions 에서 `AI_API_KEY` 를 등록합니다. 모델 이름은 Variables 의 `AI_MODEL` 로 바꿀 수 있습니다.
- Supabase 를 연결하기 전에는 `demo/posts.json` 의 시연용 글로 돕니다.

## 자동 실행 (GitHub Actions)

저장소에는 자동으로 도는 작업이 두 개 있습니다. 결과는 저장소의 Actions 탭에서 봅니다. 초록 체크는 성공, 빨간 X 는 실패입니다.

| 이름 | 파일 | 언제 도나 | 하는 일 |
| --- | --- | --- | --- |
| 검색·공유 페이지 만들기 | `.github/workflows/seo-pages.yml` | 매일 06:17, 18:17 KST. `index.html`, 생성기, AI 도우미, 시연용 글이 바뀔 때 | AI 결과, 글별 정적 페이지, 썸네일, 사이트맵을 만들고 저장소에 올림 |
| 규칙 문서 확인 | `.github/workflows/docs-check.yml` | `CLAUDE.md`, `AGENTS.md`, `tests/docs_test.js` 가 바뀔 때만 | 두 규칙 문서가 같은지 확인. 아무것도 올리지 않음 |

- 두 작업 모두 Actions 탭에서 작업 이름을 고른 뒤 "Run workflow" 를 눌러 바로 돌릴 수 있습니다.
- 두 작업은 따로 돕니다. "규칙 문서 확인"이 실패해도 블로그와 검색 페이지 만들기는 멈추지 않습니다.
- "규칙 문서 확인"이 실패하면 `CLAUDE.md` 와 `AGENTS.md` 중 한쪽만 고친 것입니다. 실행 기록에 몇 번째 줄이 다른지 나오니 두 파일을 똑같이 맞춥니다.

## Supabase 연결

1. Supabase 프로젝트를 만들고 SQL Editor 에서 `supabase-setup.sql` 을 실행합니다.
2. `index.html` 의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 에 프로젝트 주소와 공개용 키를 넣습니다.
3. 블로그에서 회원가입한 뒤 `supabase-setup.sql` 맨 아래 줄로 내 계정을 관리자로 지정합니다.

## 테스트

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
