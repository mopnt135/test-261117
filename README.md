# 삼색펜 블로그

AIPM 수업 복습 노트를 올리는 블로그입니다.
글은 관리자만 쓰고, 회원은 읽고 댓글을 달 수 있습니다.

- 주소: https://mopnt135.github.io/test-261117/
- 구성: `index.html` 하나 + Supabase(로그인, 데이터, 첨부 파일)
- Supabase 를 연결하지 않으면 브라우저에만 저장되는 체험 모드로 동작합니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | AI 코딩 에이전트 작업 규칙 |
| [docs/PRD.md](docs/PRD.md) | 권한, 사용자 스토리, 결정 사항 |
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
