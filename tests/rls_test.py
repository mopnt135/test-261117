"""
삼색펜 서버 권한 규칙(RLS) 테스트

실행: python3 tests/rls_test.py [결과 JSON 경로]
필요: 로컬 PostgreSQL 16 (psql), 환경 변수 PGHOST, PGPORT, PGUSER (기본: 소켓 기본값, postgres)
하는 일: 빈 데이터베이스를 만들고 stub_supabase.sql, supabase-setup.sql 을 실행한 뒤
         방문자(anon), 회원, 관리자로 역할을 바꿔 가며 허용과 거절을 확인합니다.
"""
import json, os, subprocess, sys, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tests", "rls-result.json")
DB = "samsaekpen_rls_" + uuid.uuid4().hex[:8]
ADMIN, KIM, LEE = ("00000000-0000-0000-0000-00000000000" + c for c in "123")


def psql(sql, db=DB, ok_errors=False):
    r = subprocess.run(["psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", sql],
                       capture_output=True, text=True)
    if r.returncode and not ok_errors:
        raise RuntimeError(r.stderr.strip())
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def as_user(role, uid, sql):
    """역할과 로그인 사용자를 정한 뒤 한 문장을 실행. (성공 여부, 결과, 오류) 반환"""
    setup = f"set role {role}; select 'SETUP' || set_config('test.uid', '{uid or ''}', false);"
    code, out, err = psql(f"{setup} {sql}", ok_errors=True)
    lines = [l for l in out.splitlines() if l.strip() and not l.startswith("SETUP")]  # 준비 줄 제외
    return code == 0, "\n".join(lines), err


results = []


def case(cid, name, fn):
    try:
        ok, detail = fn()
    except Exception as e:  # noqa: BLE001
        ok, detail = False, str(e).splitlines()[0]
    results.append({"area": "S", "id": cid, "name": name, "pass": bool(ok), "detail": detail})


def main():
    psql(f"create database {DB}", db="postgres")
    try:
        psql(open(os.path.join(ROOT, "tests", "stub_supabase.sql"), encoding="utf-8").read())
        subprocess.run(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DB, "-f",
                        os.path.join(ROOT, "supabase-setup.sql")], check=True, capture_output=True, text=True)
        psql("""
          grant usage on schema public, storage, auth to anon, authenticated;
          grant select, insert, update, delete on all tables in schema public to anon, authenticated;
          grant select, insert, update, delete on storage.objects to anon, authenticated;
          grant usage, select on all sequences in schema public to anon, authenticated;
          grant execute on all functions in schema public to anon, authenticated;
        """)
        psql(f"insert into auth.users values ('{ADMIN}','boss@test.kr'),('{KIM}','kim@test.kr'),('{LEE}','lee@test.kr');")
        psql("alter table public.profiles disable trigger profiles_guard;"
             "update public.profiles set role='admin' where email='boss@test.kr';"
             "alter table public.profiles enable trigger profiles_guard;")
        psql(f"insert into public.posts(author_id,title,body,visibility) values ('{ADMIN}','공개글','본문','public'),('{ADMIN}','초안','본문','private');")

        case("S01", "가입하면 회원 등급이 자동으로 생긴다", lambda: (
            (r := psql("select role from public.profiles where email='kim@test.kr'")[1]) == "member", f"kim 등급: {r}"))

        def s02():
            ok, out, _ = as_user("anon", None, "select title from public.posts order by id;")
            return out == "공개글", f"방문자가 본 글: {out.replace(chr(10), ', ')}"
        case("S02", "방문자는 공개글만 읽는다", s02)

        def s03():
            ok, _, err = as_user("authenticated", KIM, f"insert into public.posts(author_id,title,body) values ('{KIM}','회원 글','x');")
            return not ok and "row-level security" in err, "회원 글쓰기 거절: " + (err.split("ERROR:")[-1].strip()[:60] if err else "거절 안 됨")
        case("S03", "회원은 글을 쓸 수 없다", s03)

        def s04():
            ok, _, err = as_user("authenticated", ADMIN, f"insert into public.posts(author_id,title,body) values ('{ADMIN}','관리자 글','x');")
            return ok, "관리자 글쓰기 성공" if ok else err
        case("S04", "관리자는 글을 쓸 수 있다", s04)

        def s05():
            ok, out, err = as_user("authenticated", KIM, "insert into public.comments(post_id, body, author_name) values ('1','안녕하세요','admin***') returning author_name;")
            return ok and out == "kim***", f"저장된 이름: {out or err}"
        case("S05", "댓글 이름은 서버가 정한다 (위조 불가)", s05)

        def s06():
            ok, out, _ = as_user("authenticated", LEE, "update public.comments set body='해킹' returning id;")
            return ok and out == "", "lee 가 kim 댓글 수정 시도: 바뀐 줄 0개" if out == "" else f"바뀐 줄: {out}"
        case("S06", "남의 댓글은 고칠 수 없다", s06)

        def s07():
            ok, out, _ = as_user("authenticated", LEE, "delete from public.comments returning id;")
            return ok and out == "", "lee 가 kim 댓글 삭제 시도: 지운 줄 0개" if out == "" else f"지운 줄: {out}"
        case("S07", "남의 댓글은 지울 수 없다", s07)

        def s08():
            ok, out, _ = as_user("authenticated", KIM, f"update public.profiles set role='admin', warns=0 where id='{KIM}' returning role;")
            r = psql("select role from public.profiles where email='kim@test.kr'")[1]
            return out == "" and r == "member", f"kim 이 스스로 관리자 지정 시도 → 등급 {r}"
        case("S08", "회원은 자기 등급을 바꿀 수 없다", s08)

        def s09():
            ok, out, err = as_user("authenticated", ADMIN, f"update public.profiles set warns=3 where id='{KIM}' returning role, warns;")
            return ok and out == "banned|3", f"경고 3회 결과: {out or err}"
        case("S09", "경고 3회면 서버가 자동 추방한다", s09)

        def s10():
            ok, out, _ = as_user("anon", None, "select count(*) from public.comments;")
            ok2, out2, _ = as_user("authenticated", ADMIN, "select count(*) from public.comments;")
            return out == "0" and out2 == "1", f"방문자 {out}개, 관리자 {out2}개"
        case("S10", "추방 회원 댓글은 방문자에게 숨겨진다", s10)

        def s11():
            ok, _, err = as_user("authenticated", KIM, "insert into public.comments(post_id, body) values ('1','다시 씀');")
            return not ok, "추방 회원 댓글 쓰기 거절" if not ok else "거절 안 됨"
        case("S11", "추방 회원은 댓글을 쓸 수 없다", s11)

        def s12():
            ok, out, err = as_user("authenticated", ADMIN, f"update public.profiles set role='member' where id='{KIM}' returning role, warns;")
            return ok and out == "member|0", f"되돌림 결과: {out or err}"
        case("S12", "추방을 되돌리면 경고 0회 회원이 된다", s12)

        def s13():
            ok, out, err = as_user("authenticated", ADMIN, f"update public.profiles set role='banned' where id='{ADMIN}' returning role;")
            return out == "admin", f"관리자 추방 시도 결과: {out or err}"
        case("S13", "관리자는 추방되지 않는다", s13)

        def s14():
            ok, _, err = as_user("authenticated", ADMIN, "delete from public.comments where author_id is not null returning id;")
            return ok, "관리자 댓글 삭제 성공" if ok else err
        case("S14", "관리자는 남의 댓글을 지울 수 있다", s14)

        def s15():
            ok, _, err = as_user("authenticated", KIM, "insert into storage.objects(bucket_id, name) values ('attachments','1/x.png');")
            ok2, _, _ = as_user("authenticated", ADMIN, "insert into storage.objects(bucket_id, name) values ('attachments','1/a.png'),('attachments','2/b.png');")
            return (not ok) and ok2, f"회원 파일 올리기 {'거절' if not ok else '허용'}, 관리자 {'성공' if ok2 else '실패'}"
        case("S15", "파일은 관리자만 올릴 수 있다", s15)

        def s16():
            ok, out, _ = as_user("anon", None, "select name from storage.objects order by name;")
            return out == "1/a.png", f"방문자가 볼 수 있는 파일: {out.replace(chr(10), ', ') or '없음'} (2번은 나만보기 글)"
        case("S16", "나만보기 글의 파일은 방문자가 볼 수 없다", s16)

        def s17():
            ok, _, err = as_user("authenticated", ADMIN, f"insert into public.posts(author_id,title,body,attachments) values ('{ADMIN}','t','b','[1,2,3,4,5,6]');")
            return not ok and "posts_attachments_check" in err, "첨부 6개 거절" if not ok else "거절 안 됨"
        case("S17", "글 하나에 첨부는 5개까지다", s17)

        def s18():
            r = psql("select file_size_limit, array_to_string(allowed_mime_types, ',') from storage.buckets where id='attachments'")[1]
            return r == "10485760|image/jpeg,image/png,image/gif,application/pdf", f"보관함 설정: {r}"
        case("S18", "파일 보관함은 10MB, 4가지 형식만 받는다", s18)

        def s20():
            ok, a, err = as_user("authenticated", KIM, "insert into public.comments(post_id, body) values ('1','부모 댓글') returning id;")
            ok2, b, err2 = as_user("authenticated", LEE, f"insert into public.comments(post_id, body, parent_id) values ('1','답글', {a}) returning parent_id;")
            ok3, c, err3 = as_user("authenticated", KIM, f"insert into public.comments(post_id, body, parent_id) values ('1','답글의 답글', (select id from public.comments where body='답글')) returning parent_id;")
            return ok2 and b == a and ok3 and c == a, f"부모 {a}, 답글의 부모 {b}, 답글의 답글의 부모 {c or err3}"
        case("S20", "회원은 답글을 달고, 답글의 답글은 한 단계로 모인다", s20)

        def s21():
            ok, _, err = as_user("authenticated", LEE, "insert into public.comments(post_id, body, parent_id) values ('2','다른 글', (select id from public.comments where body='부모 댓글'));")
            return not ok and "찾을 수 없습니다" in err, "다른 글의 댓글에 답글 거절" if not ok else "거절 안 됨"
        case("S21", "다른 글의 댓글에는 답글을 달 수 없다", s21)

        def s22():
            ok, out, _ = as_user("authenticated", KIM, "delete from public.comments where body='부모 댓글' returning id;")
            ok2, out2, err2 = as_user("authenticated", KIM, "update public.comments set deleted=true where body='부모 댓글' returning deleted, body;")
            n = psql("select count(*) from public.comments where parent_id is not null")[1]
            return out == "" and out2 == "t|삭제된 댓글입니다" and n == "2", f"완전 삭제 {('거절' if out == '' else '허용')}, 삭제 표시 {out2 or err2}, 남은 답글 {n}개"
        case("S22", "답글이 달린 내 댓글은 지우지 못하고 삭제 표시로 바뀐다", s22)

        def s23():
            ok, out, err = as_user("authenticated", ADMIN, "update public.comments set body='관리자가 고친 글' where body='답글' returning deleted, body;")
            return ok and out == "t|삭제된 댓글입니다", f"관리자 수정 시도 결과: {out or err}"
        case("S23", "관리자가 남의 댓글을 고치면 삭제 표시로만 바뀐다", s23)

        def s24():
            ok, _, err = as_user("authenticated", KIM, "update public.comments set body='되살리기' where body='삭제된 댓글입니다' and author_id = auth.uid();")
            return not ok and "고칠 수 없습니다" in err, "삭제된 댓글 고치기 거절" if not ok else "거절 안 됨"
        case("S24", "삭제된 댓글은 다시 고칠 수 없다", s24)

        def s25():
            ok, out, _ = as_user("authenticated", ADMIN, f"insert into public.posts(author_id,title,body,summary) values ('{ADMIN}','t','b','{'가'*160}') returning char_length(summary);")
            ok2, _, err2 = as_user("authenticated", ADMIN, f"insert into public.posts(author_id,title,body,summary) values ('{ADMIN}','t','b','{'가'*161}');")
            return ok and out == "160" and not ok2 and "posts_summary_len" in err2, f"160자 {'저장' if ok else '거절'}, 161자 {'거절' if not ok2 else '저장'}"
        case("S25", "검색 설명은 160자까지만 저장된다", s25)

        def s19():
            code = subprocess.run(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DB, "-f",
                                   os.path.join(ROOT, "supabase-setup.sql")], capture_output=True, text=True).returncode
            return code == 0, "설정 파일 두 번째 실행 성공" if code == 0 else "두 번째 실행 실패"
        case("S19", "설정 파일을 다시 실행해도 오류가 없다", s19)
    finally:
        psql(f"drop database if exists {DB}", db="postgres", ok_errors=True)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    fails = [r for r in results if not r["pass"]]
    for r in results:
        print(("PASS" if r["pass"] else "FAIL"), r["id"], r["name"], "—", r["detail"])
    print(f"\n{len(results)}건 중 {len(results) - len(fails)}건 통과, {len(fails)}건 실패")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
