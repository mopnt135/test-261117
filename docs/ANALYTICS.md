# 삼색펜 방문 통계 (GA4) 설계

기준일: 2026-11-17 (KST)
대상: 블로그 운영자(관리자 1명)와 이 저장소에서 일하는 AI 코딩 에이전트

## 1. 알고 싶은 것과 답하는 방법

| 질문 | GA4 에서 보는 곳 | 쓰는 데이터 |
| --- | --- | --- |
| 홈 화면 방문자는 몇 명인가 | 보고서 > 참여도 > 페이지 및 화면, 페이지 경로 `/` | `page_view` (page_type = home) |
| 페이지별 방문자는 몇 명인가 | 같은 보고서, 측정기준 "페이지 경로" | `page_view` 의 page_path |
| 어느 지역, 기기, OS 에서 오나 | 보고서 > 사용자 > 인구통계 세부정보, 기술 세부정보 | GA 가 자동으로 수집 (코드 불필요) |
| 어떤 글을 가장 많이 읽나 | 탐색 > 자유 형식, 측정기준 post_title | `post_view` 수, `post_read_complete` 수 |
| 글을 끝까지 읽나 | 탐색, post_read_complete ÷ post_view | 완독률 |
| 읽고 나서 참여하나 | 탐색 > 유입경로 | `post_view` → `comment_submit` |

## 2. ASIS → TOBE

| 구분 | ASIS (이전) | TOBE (이번 변경 뒤) |
| --- | --- | --- |
| 방문자 수 | 알 수 없음 | 홈과 페이지별 방문자 수를 GA4 에서 확인 |
| 화면 구분 | 블로그가 `#post-12` 같은 # 주소로 화면을 바꿈. GA 기본 설정에 맡기면 화면 이동이 정확히 집계될지 보장할 수 없음 | 화면이 바뀔 때마다 코드가 직접 `page_view` 를 보냄. `#post-12` → `/post/12` 처럼 읽기 쉬운 경로로 바꿔 보냄 |
| 인기 글 | 댓글 수로만 짐작 | 글별 조회(`post_view`)와 끝까지 읽음(`post_read_complete`)을 따로 셈 |
| 지역, 기기, OS | 없음 | GA 자동 수집: 국가, 지역, 도시, 기기 종류, OS, 브라우저, 화면 크기, 언어 |
| 사용자 행동 | 없음 | 검색, 카테고리 선택, 댓글과 답글, 첨부 열기, 가입과 로그인 |
| 관리자 방문 | 구분 없음 | 관리자는 `traffic_type=internal` 로 보내 GA 내부 트래픽 필터로 뺄 수 있음 |
| 개인정보 | 해당 없음 | 이메일, 댓글 본문, 비밀번호는 보내지 않음. 화면 맨 아래 "방문 통계 끄기" 버튼 |
| 외부 스크립트 | Supabase JS 1개 | Supabase JS + Google 태그(gtag.js). 측정 ID 가 비어 있으면 GA 는 불러오지 않음 |
| 검증 | 없음 | 화면 테스트 8건 (T70~T77): 이벤트 이름, 값, 개인정보 미포함, 끄기 버튼 |

## 3. 이벤트 택소노미

### 이름 규칙
- 영어 소문자와 밑줄(snake_case). `대상_행동` 순서. 예: `post_view`, `comment_submit`
- GA 권장 이벤트가 있으면 그 이름을 쓴다: `page_view`, `login`, `sign_up`, `search`
- 값이 정해진 파라미터는 아래 표의 값만 쓴다. 새 값이 필요하면 이 문서를 먼저 고친다.
- 문자열 값은 100자에서 자른다. 검색어는 50자.

### 개인정보 규칙 (반드시 지킴)
- 보내지 않는 것: 이메일, 이름, 댓글과 답글 본문, 비밀번호, Supabase 사용자 번호
- 보내도 되는 것: 공개된 글 제목과 번호, 카테고리, 글자 수 같은 숫자
- 검색어는 사용자가 입력한 글자라 개인정보가 섞일 수 있다. 50자로 자르고, 정기적으로 GA 에서 이상한 값이 없는지 본다.

### 이벤트 목록

| 이벤트 | 언제 | 파라미터 | 답하는 질문 |
| --- | --- | --- | --- |
| `page_view` | 화면이 바뀔 때마다 1번. 첫 접속은 데이터를 다 불러온 뒤 | page_path, page_type, page_title, page_location | 홈과 페이지별 방문자 |
| `post_view` | 글 또는 공지 상세를 열 때 | post_id, post_title, post_category, is_notice, attachment_count | 인기 글 |
| `post_read_complete` | 본문 끝이 화면에 보이고 글을 연 지 10초가 지났을 때, 글 하나에 1번 | post_id, post_title, post_category, engaged_seconds | 완독률 |
| `search` | 검색어 입력이 1초 멈췄을 때 | search_term, result_count | 무엇을 찾는가, 못 찾는가 |
| `category_filter` | 글 목록에서 카테고리를 누를 때 | category | 관심 주제 |
| `sign_up` | 회원가입 요청 | method=`email`, needs_email_confirm | 가입 전환 |
| `login` | 로그인 성공 | method=`email`, login_screen=`member`/`admin` | 재방문 회원 |
| `logout` | 로그아웃 | user_role | |
| `comment_submit` | 댓글 또는 답글 등록 | post_id, comment_type=`comment`/`reply`, comment_length | 참여도 |
| `comment_edit` | 내 댓글 수정 | post_id | |
| `comment_delete` | 댓글 삭제 | post_id, deleted_by=`self`/`admin`, screen=`post`/`admin_comments`, soft_delete | 운영 부담 |
| `attachment_open` | 첨부 이미지나 PDF 를 열 때 | post_id, file_ext | 자료 활용도 |
| `post_create` / `post_update` | 관리자가 글을 저장할 때 | post_id, post_category, visibility, attachment_count, upload_failed | 발행 빈도 |
| `post_delete` | 관리자가 글을 지울 때 | post_id | |
| `file_rejected` | 첨부 파일이 거절될 때 | reason=`type`/`mime_mismatch`/`signature`/`size`/`empty`/`count`, file_ext | 업로드 문제 |
| `member_action` | 관리자가 경고, 추방, 되돌림을 할 때 | action=`warn`/`auto_ban`/`ban`/`unban`, warn_count | 운영 기록 |
| `analytics_opt_out` / `analytics_opt_in` | 방문 통계 끄기와 켜기 | 없음 | |

### page_type 값과 경로

| page_type | page_path | 화면 |
| --- | --- | --- |
| home | `/` | 첫 화면 |
| list | `/list` | 글 목록 |
| post | `/post/<글번호>` | 글 상세 |
| notice | `/post/notice`, `/post/notice-rules` | 공지 상세 |
| write / edit | `/write`, `/edit/<글번호>` | 글쓰기, 글 수정 |
| login | `/login` | 로그인 |
| admin / admin_comments | `/admin`, `/admin/comments` | 관리자 화면 |

### 사용자 속성
| 속성 | 값 |
| --- | --- |
| user_role | `guest` 방문자, `member` 회원, `banned` 추방, `admin` 관리자 |

## 4. GA4 설정 순서 (사람이 할 일)

화면 메뉴 이름은 Google 이 자주 바꿉니다. 아래와 다르면 비슷한 이름을 찾아 주세요.

1. analytics.google.com 에서 계정과 **속성**을 만든다. 시간대는 대한민국, 통화는 원(KRW).
2. **웹 데이터 스트림**을 만든다. 주소는 `https://mopnt135.github.io/test-261117/`.
3. 나온 **측정 ID** (`G-` 로 시작)를 `index.html` 의 `GA_MEASUREMENT_ID` 에 넣고 배포한다.
4. 데이터 스트림 > **향상된 측정** > "브라우저 기록 이벤트에 따른 페이지 변경"을 **끈다.** 코드가 page_view 를 직접 보내므로 켜 두면 두 번 셀 수 있다.
5. 관리 > **맞춤 정의**에서 아래를 등록한다. 등록해야 보고서에서 측정기준으로 고를 수 있다.
   - 이벤트 범위: page_type, post_id, post_title, post_category, is_notice, comment_type, deleted_by, file_ext, reason, action, visibility, search_term 은 기본 제공
   - 측정항목: engaged_seconds, result_count, attachment_count, comment_length
   - 사용자 범위: user_role
6. 관리 > 데이터 수집 및 수정 > **데이터 필터** > 내부 트래픽 필터를 "활성"으로 바꾼다. 관리자 방문이 빠진다.
7. 관리 > 데이터 보관 > 이벤트 데이터 보관 기간을 가장 길게 바꾼다.
8. 관리 > **DebugView** 에서 블로그를 열고 이벤트가 들어오는지 본다.

## 5. 주의할 점

- **방문자가 적으면 일부 숫자가 가려질 수 있다.** GA4 는 개인을 알아볼 수 있을 만큼 수가 적으면 값을 숨길 때가 있다. 특히 Google 신호 데이터를 켜면 더 그렇다. 작은 블로그는 Google 신호 데이터를 끄는 것을 권한다.
- **지역은 IP 주소로 추정한 값이다.** 시, 구 단위는 틀릴 수 있다.
- **광고 차단기를 쓰는 방문자는 집계되지 않는다.** GA 숫자는 실제 방문자보다 적게 나온다.
- **개인정보 처리방침에 GA 사용 사실을 적는 것이 좋다.** 쿠키로 방문 통계를 모으기 때문이다. 화면 맨 아래 "방문 통계 끄기" 버튼으로 거부할 수 있게 했다.
- 체험 모드에서도 이벤트는 `window.samsaekpenEvents` 에 쌓인다. 측정 ID 가 있을 때만 GA 로 나간다.

## 6. 코드 위치 (에이전트용)

| 무엇 | 어디 |
| --- | --- |
| 측정 ID | `index.html` 의 `GA_MEASUREMENT_ID` (현재 `G-5HJBBKMVE3`) |
| 공통 함수 | `analytics.track(name, params)`, `analytics.setUser(role)` |
| 화면 이동 | `trackPageView()`, `pageInfo()` |
| 읽기 완료 | `checkReadComplete()` |
| 테스트 | `tests/e2e.js` 의 H 영역 T70~T78. 테스트는 측정 ID 를 비운 복사본으로 돌아가 실제 GA 로 보내지 않는다 |

새 이벤트를 넣을 때:
1. 이 문서의 이벤트 목록에 먼저 적는다.
2. `analytics.track()` 으로만 보낸다. `gtag()` 를 직접 부르지 않는다.
3. 개인정보가 안 들어가는지 T75 처럼 테스트한다.
