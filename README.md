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
