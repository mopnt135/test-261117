/*
 * 생각하는 공방 화면 테스트 (체험 모드)
 * 실행: node tests/e2e.js [결과 JSON 경로] [스크린샷 폴더]
 * 필요: playwright (require('playwright')), index.html 과 tests/fixtures 폴더
 * Supabase 를 연결하지 않은 체험 모드에서 화면 동작을 확인합니다.
 * 서버 권한 규칙은 tests/rls_test.py 에서 따로 확인합니다.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const NodeURL = require("url").URL; // 아래 URL 은 테스트 페이지 주소라서 이름이 겹친다

const ROOT = path.resolve(__dirname, "..");
// 테스트가 실제 GA 로 가짜 방문을 보내지 않도록, 측정 ID 를 비운 복사본으로 테스트한다
const GA_ID_RE = /const GA_MEASUREMENT_ID = "[^"]*";/;
const SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!GA_ID_RE.test(SOURCE)) throw new Error("index.html 에서 GA_MEASUREMENT_ID 를 찾지 못했습니다");
const withGaId = id => SOURCE.replace(GA_ID_RE, `const GA_MEASUREMENT_ID = "${id}";`);
const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "samsaekpen-e2e-"));
fs.writeFileSync(path.join(TMP, "index.html"), withGaId(""));
fs.cpSync(path.join(ROOT, "assets"), path.join(TMP, "assets"), { recursive: true }); // 메인 사진 등 그림 파일
// 챗봇 시험용 답 파일(진짜 ai/chatbot/qa.js 대신). HTML 기호가 글자로만 보이는지도 본다
const CHAT_QA = { ready: true, greeting: "안녕하세요. 포트폴리오 안내입니다.", items: [
  { q: "어떤 블로그인가요?", a: "복습 노트 블로그입니다.", keywords: ["블로그", "소개"] },
  { q: "<img src=x onerror=alert(1)>도구는요?", a: "HTML 과 <b>Supabase</b> 를 썼습니다.", keywords: ["도구", "기술"] }] };
const writeChat = d => { fs.mkdirSync(path.join(TMP, "ai/chatbot"), { recursive: true }); fs.writeFileSync(path.join(TMP, "ai/chatbot/qa.js"), d ? `window.CHATBOT_QA = ${JSON.stringify(d)};` : ""); };
writeChat(CHAT_QA);
const URL = "file://" + path.join(TMP, "index.html");
const FIX = path.join(__dirname, "fixtures");
const OUT = process.argv[2] || path.join(__dirname, "e2e-result.json");
const SHOTS = process.argv[3] || null;
// 크기 제한 시험용 큰 파일은 저장소에 두지 않고 실행할 때 만든다 (PNG 서명 + 1.2MB)
const BIG = path.join(require("os").tmpdir(), "samsaekpen-big.png");
fs.writeFileSync(BIG, Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]), Buffer.alloc(1200000)]));

const results = [];
let page, browser, errors = [];
const wait = (ms = 350) => page.waitForTimeout(ms);
const text = sel => page.textContent(sel);
const count = sel => page.$$eval(sel, a => a.length);
const goto = async hash => { await page.goto(URL + (hash || "")); await wait(450); };
// 11-25: 체험 모드 관리자는 비밀번호만 넣는다(이메일 없음). 회원은 이메일과 비밀번호
const ADMIN_PW = "test1125";
const login = async (email, admin) => {
  await goto(admin ? "#admin" : "#login");
  if (admin) await page.fill("#lPw", ADMIN_PW);
  else { await page.fill("#lEmail", email); await page.fill("#lPw", "123456"); }
  await page.click("#loginSubmit"); await wait(500);
};
const logout = async () => { const b = await page.$("#authArea [data-act=logout]"); if (b) { await b.click(); await wait(450); } };
const expect = (cond, detail) => { if (!cond) throw new Error(detail); return detail; };
const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }); };

let postUrl = "";

const tests = [
  // A. 공통 화면
  // 11-24 레이아웃 변경: 바로가기 3칸과 공지 큰 제목을 없애고, 가운데 한 줄 글 카드로 바꿨다
  ["A", "T01", "첫 화면이 오류 없이 열리고 글 카드가 사진 칸과 함께 보인다", async () => { await goto(); await shot("home-desktop"); const n = await count(".post .thumb"); return expect(errors.length === 0 && n >= 2, `글 카드 ${n}개, 스크립트 오류 ${errors.length}건`); }],
  ["A", "T02", "첫 화면 제목은 '최근 글'이고 첫 카드는 공지 '운영 기준'이다", async () => { const h = await text("#view h1"), t = await text(".post h3"); return expect(h === "최근 글" && t.includes("운영 기준"), `제목: ${h}, 첫 카드: ${t}`); }],
  ["A", "T03", "글 목록 맨 위에 공지 2개가 있다", async () => { await goto("#list"); const t = await page.$$eval(".post h3", a => a.slice(0, 2).map(x => x.textContent)); return expect(t.length === 2 && t[0].includes("운영 기준") && t[1].includes("이용 안내"), t.join(", ")); }],
  ["A", "T04", "공지 상세와 다른 글 이동이 된다", async () => { await goto("#post-notice-rules"); const pager = await page.$$eval(".pager a span", a => a.map(x => x.textContent)); return expect((await text("#view h1")).includes("운영 기준") && pager.includes("생각하는 공방 이용 안내"), "다른 글: " + pager.join(", ")); }],
  ["A", "T05", "검색 결과가 없으면 안내가 나온다", async () => { await goto("#list"); await page.fill("#q", "없는검색어"); await wait(); const e = await text(".empty"); await page.fill("#q", ""); await wait(); return expect(e.includes("검색 결과가 없습니다"), e.trim()); }],

  // B. 권한
  ["B", "T10", "방문자에게 글쓰기 메뉴가 안 보인다", async () => { await goto(); return expect(await page.$eval("[data-nav=write]", e => e.hidden), "글쓰기 메뉴 숨김"); }],
  ["B", "T11", "방문자가 글쓰기 주소로 오면 안내가 나온다", async () => { await goto("#write"); const t = await text(".notice-box p"); return expect(t.includes("관리자만"), t.trim()); }],
  ["B", "T12", "방문자에게는 댓글 대신 로그인 안내가 나온다", async () => { await goto("#post-notice"); const t = await text(".c-login p"); return expect(t.includes("로그인한 회원만"), t.trim()); }],
  ["B", "T13", "관리자 로그인 후 회원 관리 화면으로 간다", async () => { await login("boss@test.kr", true); return expect((await text("#view h1")).includes("회원 관리"), await text("#view h1")); }],
  ["B", "T14", "관리자는 글을 쓸 수 있다", async () => {
    await goto("#write"); await page.fill("#wTitle", "테스트 글"); await page.fill("#wBody", "관리자가 쓴 테스트 본문입니다.");
    await page.click("#writeSubmit"); await wait(900); postUrl = page.url().split("#")[1];
    return expect((await text("#view h1")) === "테스트 글", "저장 후 이동: #" + postUrl);
  }],
  ["B", "T15", "회원에게는 글쓰기 메뉴가 없고 주소로 와도 막힌다", async () => {
    await logout(); await login("kim@test.kr");
    const hidden = await page.$eval("[data-nav=write]", e => e.hidden);
    await goto("#write"); const t = await text(".notice-box p");
    return expect(hidden && t.includes("관리자만"), t.trim());
  }],
  ["B", "T16", "회원에게는 글 수정과 삭제 버튼이 없다", async () => { await goto("#" + postUrl); return expect(!(await page.$(".article-actions")), "수정, 삭제 버튼 없음"); }],
  ["B", "T17", "회원이 관리자 화면에 오면 안내가 나온다", async () => { await goto("#admin"); return expect((await text("#view h1")).includes("관리자 계정이 아닙니다"), await text("#view h1")); }],

  // C. 댓글
  ["C", "T20", "회원이 댓글을 달면 이름이 가려져 보인다", async () => {
    await goto("#" + postUrl); await page.fill("#cBody", "좋은 글이네요"); await page.click("#cSubmit"); await wait(500);
    const name = await text(".c-meta b"); return expect(name === "kim***", "작성자 표시: " + name);
  }],
  ["C", "T21", "빈 댓글은 올라가지 않는다", async () => { await page.fill("#cBody", "   "); await page.click("#cSubmit"); await wait(); return expect((await count(".comment")) === 1 && (await text("#cMsg")).includes("입력"), (await text("#cMsg")).trim()); }],
  ["C", "T22", "내 댓글을 고치면 수정됨 표시가 붙는다", async () => {
    await page.click("[data-act=editComment]"); await wait(); await page.fill("[data-edit-comment] textarea", "좋은 글이네요 (수정)");
    await page.click("[data-edit-comment] button[type=submit]"); await wait(500);
    const body = await text(".c-body"), meta = await text(".c-meta");
    return expect(body.includes("(수정)") && meta.includes("수정됨"), body);
  }],
  ["C", "T23", "다른 회원의 댓글에는 수정, 삭제 버튼이 없다", async () => {
    await logout(); await login("lee@test.kr"); await goto("#" + postUrl);
    const n = await count(".comment [data-act=editComment], .comment [data-act=delComment]"); return expect(n === 0, "수정, 삭제 버튼 수: " + n + " (답글 버튼은 있어야 함)");
  }],
  ["C", "T24", "관리자는 댓글을 두 번 눌러 지운다", async () => {
    await page.fill("#cBody", "lee 의 댓글"); await page.click("#cSubmit"); await wait(500);
    await logout(); await login("boss@test.kr", true); await goto("#" + postUrl);
    const before = await count(".comment");
    const del = page.locator(".comment", { hasText: "lee 의 댓글" }).locator("[data-act=delComment]");
    await del.click(); await wait(200); const mid = await count(".comment");
    await del.click(); await wait(600); const after = await count(".comment");
    return expect(before === 2 && mid === 2 && after === 1, `${before} → 한 번 눌러도 ${mid} → 두 번째에 ${after}`);
  }],

  // D. 경고와 추방
  ["D", "T30", "경고를 주면 횟수가 올라간다", async () => {
    await goto("#admin");
    const row = () => page.locator(".members li", { hasText: "kim@test.kr" });
    await row().locator("[data-member=warn]").click(); await wait(400);
    await row().locator("[data-member=warn]").click(); await wait(400);
    const t = await row().textContent(); await shot("admin-members");
    return expect(t.includes("경고 2/3"), t.replace(/\s+/g, " ").trim());
  }],
  ["D", "T31", "세 번째 경고는 확인을 거쳐 자동 추방된다", async () => {
    const btn = page.locator(".members li", { hasText: "kim@test.kr" }).locator("[data-member=warn]");
    const label = await btn.textContent(); await btn.click(); await wait(200);
    const armed = await btn.textContent(); await btn.click(); await wait(500);
    const badge = await page.locator(".members li", { hasText: "kim@test.kr" }).locator(".badge").textContent();
    return expect(label.includes("자동 추방") && armed.includes("한 번 더") && badge === "추방", `${label} → ${armed} → ${badge}`);
  }],
  ["D", "T32", "추방 회원의 댓글은 방문자에게 숨겨지고 관리자에게는 보인다", async () => {
    await goto("#" + postUrl); const admin = await count(".comment");
    await logout(); await goto("#" + postUrl); const guest = await count(".comment");
    return expect(admin === 1 && guest === 0, `관리자 ${admin}개, 방문자 ${guest}개`);
  }],
  ["D", "T33", "추방 회원은 댓글을 쓸 수 없다", async () => { await login("kim@test.kr"); await goto("#" + postUrl); const t = await text(".c-login p"); return expect(t.includes("제한된 계정"), t.trim()); }],
  ["D", "T34", "추방을 되돌리면 경고 0회 회원이 되고 댓글이 다시 보인다", async () => {
    await logout(); await login("boss@test.kr", true); await goto("#admin");
    await page.locator(".members li", { hasText: "kim@test.kr" }).locator("[data-member=unban]").click(); await wait(500);
    const t = await page.locator(".members li", { hasText: "kim@test.kr" }).textContent();
    await logout(); await goto("#" + postUrl); const guest = await count(".comment");
    return expect(t.includes("경고 0/3") && guest === 1, `${t.replace(/\s+/g, " ").trim()} / 방문자에게 댓글 ${guest}개`);
  }],

  ["D", "T35", "관리자 댓글 현황에 모든 댓글과 숨김 상태가 보인다", async () => {
    await logout(); await login("lee@test.kr"); await goto("#" + postUrl); await page.fill("#cBody", "lee 의 두 번째 댓글"); await page.click("#cSubmit"); await wait(500);
    await logout(); await login("boss@test.kr", true); await goto("#admin-comments"); await wait(500);
    const n = await count(".ac-item"), tab = await text(".admin-tabs [aria-current]"), post = await text(".ac-item .ac-post");
    await shot("admin-comments");
    return expect(n === 2 && tab.includes("댓글 현황") && post.includes("테스트 글"), `댓글 ${n}개, 글 제목 표시: ${post}`);
  }],
  ["D", "T36", "댓글 현황에서 오늘, 숨겨진 댓글로 거를 수 있다", async () => {
    await page.click("[data-acf=today]"); await wait(); const today = await count(".ac-item");
    await page.click("[data-acf=hidden]"); await wait(); const hidden = await count(".ac-item");
    await page.click("[data-acf=all]"); await wait();
    return expect(today === 2 && hidden === 0, `오늘 ${today}개, 숨겨진 댓글 ${hidden}개`);
  }],
  ["D", "T37", "댓글 현황에서 두 번 눌러 댓글을 지운다", async () => {
    const del = page.locator(".ac-item", { hasText: "lee 의 두 번째 댓글" }).locator("[data-act=adminDelComment]");
    await del.click(); await wait(200); const mid = await count(".ac-item"); await del.click(); await wait(600);
    const after = await count(".ac-item"), m = await text("#acMsg");
    return expect(mid === 2 && after === 1 && m.includes("지웠습니다"), `2 → 한 번 눌러도 ${mid} → ${after}개`);
  }],
  ["D", "T38", "회원 관리에 회원별 댓글 수가 보인다", async () => { await goto("#admin"); const t = await page.locator(".members li", { hasText: "kim@test.kr" }).textContent(); return expect(t.includes("댓글 1개"), t.replace(/\s+/g, " ").trim()); }],

  // C. 답글 (공지 글에서 시험해 다른 테스트의 댓글 수에 영향을 주지 않음)
  ["C", "T25", "회원이 댓글에 답글을 단다", async () => {
    await logout(); await login("lee@test.kr"); await goto("#post-notice"); await page.fill("#cBody", "공지 잘 읽었습니다"); await page.click("#cSubmit"); await wait(500);
    await logout(); await login("kim@test.kr"); await goto("#post-notice");
    await page.click("[data-act=replyComment]"); await wait(); await page.fill("#rBody", "저도 잘 읽었어요"); await page.click("#rSubmit"); await wait(500);
    const n = await count(".c-replies .comment"), badge = await text(".c-replies .c-rbadge"); await shot("comment-replies");
    return expect(n === 1 && badge === "답글", `답글 ${n}개, 표시: ${badge}`);
  }],
  ["C", "T26", "답글에는 다시 답글 버튼이 없고 빈 답글은 거절된다", async () => {
    const nb = await count(".c-replies [data-act=replyComment]");
    await page.click("[data-act=replyComment]"); await wait(); await page.click("#rSubmit"); await wait();
    const m = await text("#rMsg"); await page.click("[data-act=cancelReply]"); await wait();
    return expect(nb === 0 && m.includes("입력"), `답글 안의 답글 버튼 ${nb}개, ${m.trim()}`);
  }],
  ["C", "T27", "답글이 달린 댓글을 지우면 자리 표시가 남고 답글은 유지된다", async () => {
    await logout(); await login("lee@test.kr"); await goto("#post-notice");
    const del = page.locator(".c-list > .comment").first().locator(":scope > .c-actions [data-act=delComment]");
    await del.click(); await wait(200); await del.click(); await wait(600);
    const top = await text(".c-list > .comment > .c-body"), n = await count(".c-replies .comment");
    return expect(top.includes("삭제된 댓글") && n === 1, `${top.trim()} / 답글 ${n}개 유지`);
  }],
  ["C", "T28", "방문자에게는 답글 버튼이 없지만 답글은 보인다", async () => {
    await logout(); await goto("#post-notice"); const n = await count("[data-act=replyComment]"), r = await count(".c-replies .comment");
    return expect(n === 0 && r === 1, `답글 버튼 ${n}개, 보이는 답글 ${r}개`);
  }],
  ["C", "T29", "관리자 댓글 현황에 답글과 삭제 상태가 표시된다", async () => {
    await login("boss@test.kr", true); await goto("#admin-comments"); await wait(500);
    const t = await page.locator(".ac-item", { hasText: "저도 잘 읽었어요" }).textContent();
    const d = await page.locator(".ac-item", { hasText: "삭제된 댓글" }).textContent();
    await logout();
    return expect(t.includes("답글") && d.includes("삭제됨"), "답글 표시, 삭제됨 표시");
  }],

  // E. 첨부 파일
  ["E", "T40", "JPG, PNG, GIF, PDF 4종을 고를 수 있다", async () => {
    await logout(); await login("boss@test.kr", true); await goto("#write"); await page.fill("#wTitle", "첨부 테스트"); await page.fill("#wBody", "첨부 본문");
    await page.setInputFiles("#wFiles", ["red.png", "orange.jpg", "mint.gif", "note.pdf"].map(f => path.join(FIX, f))); await wait(600);
    const n = await page.$$eval("#attPick .nm", a => a.map(x => x.textContent)); return expect(n.length === 4, n.join(", "));
  }],
  ["E", "T41", "허용되지 않은 형식(txt)은 거절된다", async () => { await page.setInputFiles("#wFiles", path.join(FIX, "memo.txt")); await wait(400); const m = await text("#writeMsg"); return expect(m.includes("JPG, PNG, GIF, PDF 파일만") && (await count("#attPick li")) === 4, m.trim()); }],
  ["E", "T42", "이름만 .png 로 바꾼 파일은 거절된다", async () => { await page.setInputFiles("#wFiles", path.join(FIX, "fake.png")); await wait(400); const m = await text("#writeMsg"); return expect(m.includes("형식이 아니에요"), m.trim()); }],
  ["E", "T43", "크기 제한을 넘는 파일은 거절된다", async () => { await page.setInputFiles("#wFiles", BIG); await wait(400); const m = await text("#writeMsg"); return expect(m.includes("큰 파일"), m.trim()); }],
  ["E", "T44", "한 글에 5개까지만 들어간다", async () => { await page.setInputFiles("#wFiles", ["red.png", "red.png"].map(f => path.join(FIX, f))); await wait(500); const n = await count("#attPick li"), m = await text("#writeMsg"); return expect(n === 5 && m.includes("5개까지"), `${n}개, ${m.trim()}`); }],
  ["E", "T45", "글 상세에 이미지가 보이고 PDF는 링크로 열린다", async () => {
    await page.click("#writeSubmit"); await wait(1400);
    const imgs = await page.$$eval(".att-imgs img", a => a.filter(x => x.naturalWidth > 0).length);
    const pdf = await page.$$eval(".att-file", a => a.map(x => x.href.startsWith("blob:") || x.href.startsWith("http")));
    await shot("post-attachments");
    return expect(imgs === 4 && pdf.length === 1 && pdf[0], `이미지 ${imgs}개 표시, PDF 링크 ${pdf.length}개`);
  }],
  ["E", "T46", "글 수정에서 첨부를 빼고 다시 저장할 수 있다", async () => {
    await page.click("a[href^='#edit-']"); await wait(600);
    const before = await count("#attPick li"); await page.click("#attPick [data-act=rmKept]"); await wait(200);
    await page.click("#writeSubmit"); await wait(1200);
    const after = (await count(".att-imgs img")) + (await count(".att-file"));
    return expect(before === 5 && after === 4, `${before}개 → ${after}개`);
  }],
  ["E", "T47", "글 목록에 첨부 개수가 보인다", async () => { await goto("#list"); const r = await page.$$eval(".post .read", a => a.map(x => x.textContent)); return expect(r.some(x => x.includes("첨부 4개")), r.find(x => x.includes("첨부")) || "없음"); }],

  // F. 글 관리
  ["F", "T50", "관리자가 글을 고치면 수정됨이 붙는다", async () => {
    await goto("#edit-" + postUrl.replace("post-", "")); await page.fill("#wTitle", "테스트 글 (수정)"); await page.click("#writeSubmit"); await wait(900);
    const m = await text(".article .meta"); return expect((await text("#view h1")).includes("(수정)") && m.includes("수정"), (await text("#view h1")));
  }],
  ["F", "T51", "나만보기 글은 관리자에게만 보인다", async () => {
    await goto("#write"); await page.fill("#wTitle", "초안 글"); await page.fill("#wBody", "초안"); await page.check("#visPrivate"); await page.click("#writeSubmit"); await wait(900);
    await goto("#list"); const admin = (await page.$$eval(".post h3", a => a.map(x => x.textContent))).includes("초안 글");
    await logout(); await goto("#list"); const guest = (await page.$$eval(".post h3", a => a.map(x => x.textContent))).includes("초안 글");
    return expect(admin && !guest, `관리자 ${admin ? "보임" : "안 보임"}, 방문자 ${guest ? "보임" : "안 보임"}`);
  }],
  ["F", "T52", "관리자는 글을 두 번 눌러 지운다", async () => {
    await login("boss@test.kr", true); await goto("#" + postUrl);
    const del = page.locator("[data-act=delete]"); await del.click(); await wait(200); const armed = await del.textContent(); await del.click(); await wait(900);
    const titles = await page.$$eval(".post h3", a => a.map(x => x.textContent));
    return expect(armed.includes("한 번 더") && !titles.some(t => t.startsWith("테스트 글")), `확인 문구: ${armed}`);
  }],
  ["F", "T53", "로그아웃하면 관리 버튼이 사라진다", async () => { await logout(); const w = await page.$eval("[data-nav=write]", e => e.hidden); const a = await text("#authArea"); return expect(w && a.includes("로그인"), "글쓰기 메뉴 숨김, 로그인 버튼 표시"); }],

  // H. 방문 통계 (GA4). window.samsaekpenEvents 에 쌓이는 이벤트로 확인
  ["H", "T70", "첫 화면을 열면 홈 page_view 가 1건 기록된다", async () => {
    await goto(); await wait(300);
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "page_view"));
    // GA4 는 page_location 으로 경로를 정한다. 첫 화면은 사이트 주소 그대로 (배포 주소에서는 /thinkandmake/)
    const home = new NodeURL(".", URL).href;
    return expect(ev.length === 1 && ev[0].params.page_type === "home" && ev[0].params.page_location === home && ev[0].params.page_path === new NodeURL(home).pathname && ev[0].params.view_source === "app", `page_view ${ev.length}건, ${ev[0] && ev[0].params.page_location}`);
  }],
  ["H", "T71", "글을 열면 글 경로의 page_view 와 post_view 가 기록된다", async () => {
    await page.click(".post h3 a >> nth=0"); await wait(500);
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => ["page_view", "post_view"].includes(e.name)).slice(-2));
    const pv = ev.find(e => e.name === "page_view"), po = ev.find(e => e.name === "post_view");
    // 글은 검색·공유 페이지와 같은 실제 주소 p/<글번호>/ 로 보낸다
    const want = new NodeURL(`p/${po && po.params.post_id}/`, new NodeURL(".", URL)).href;
    return expect(pv && pv.params.page_location === want && pv.params.page_path.endsWith(`/p/${po.params.post_id}/`) && po.params.post_title && po.params.view_source === "app", `${pv && pv.params.page_path}, 글: ${po && po.params.post_title}`);
  }],
  ["H", "T72", "본문 끝까지 보고 10초가 지나면 읽기 완료가 1번 기록된다", async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(10600);
    await page.evaluate(() => window.dispatchEvent(new Event("scroll"))); await wait(200);
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "post_read_complete"));
    return expect(ev.length === 1 && ev[0].params.engaged_seconds >= 10, `읽기 완료 ${ev.length}건, ${ev[0] && ev[0].params.engaged_seconds}초`);
  }],
  ["H", "T73", "검색어와 카테고리 선택이 기록된다", async () => {
    await goto("#list"); await page.fill("#q", "운영"); await wait(1400); await page.fill("#q", ""); await wait(300);
    await page.click(".chip >> text=공지"); await wait(300);
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => ["search", "category_filter"].includes(e.name)));
    const sr = ev.find(e => e.name === "search"), cf = ev.find(e => e.name === "category_filter");
    return expect(sr && sr.params.search_term === "운영" && sr.params.result_count >= 1 && cf && cf.params.category === "공지", `검색 "${sr && sr.params.search_term}" 결과 ${sr && sr.params.result_count}개, 카테고리 ${cf && cf.params.category}`);
  }],
  ["H", "T74", "로그인과 댓글, 답글이 기록되고 회원 등급이 설정된다", async () => {
    await login("kim@test.kr");
    const before = await page.evaluate(() => window.samsaekpenEvents.map(e => e.name));
    await goto("#post-notice-rules"); await page.fill("#cBody", "통계 테스트 댓글"); await page.click("#cSubmit"); await wait(500);
    await page.click("[data-act=replyComment] >> nth=0"); await wait(); await page.fill("#rBody", "통계 테스트 답글"); await page.click("#rSubmit"); await wait(500);
    const ev = await page.evaluate(() => window.samsaekpenEvents);
    const types = ev.filter(e => e.name === "comment_submit").map(e => e.params.comment_type);
    const roleSet = ev.some(e => e.name === "user_properties" && e.params.user_role === "member");
    return expect(before.includes("login") && types.join(",") === "comment,reply" && roleSet, `login ${before.includes("login") ? "있음" : "없음"}, 댓글 종류 ${types.join(",")}, 등급 member`);
  }],
  ["H", "T79", "검색어 속 이메일과 전화번호는 가려서 기록한다", async () => {
    await goto("#list"); await page.fill("#q", "kim@test.kr 010-1234-5678 운영"); await wait(1400);
    const sr = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "search").pop());
    await page.fill("#q", ""); await wait(300);
    return expect(sr && sr.params.search_term === "[이메일] [숫자] 운영", `기록된 검색어: ${sr && sr.params.search_term}`);
  }],
  ["H", "T86", "UTM 링크로 들어오면 page_view 주소에 utm_ 값만 남는다", async () => {
    await page.goto(URL + "?utm_source=kakaotalk&utm_medium=social_group&utm_campaign=blog_open&email=a@b.c#post-notice-rules"); await wait(500);
    const pv = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "page_view").pop());
    const u = new NodeURL(pv.params.page_location);
    const ok = u.searchParams.get("utm_source") === "kakaotalk" && u.searchParams.get("utm_campaign") === "blog_open" && !u.searchParams.has("email")
      && u.pathname.endsWith("/p/notice-rules/") && pv.params.page_path.endsWith("/p/notice-rules/") && !pv.params.page_path.includes("?");
    await goto();
    return expect(ok, pv.params.page_location.replace(/^.*\/p\//, ".../p/"));
  }],
  ["H", "T85", "관리자로 로그인한 브라우저는 내부 방문으로 표시하고, 회원으로 로그인하면 표시를 지운다", async () => {
    const flag = () => page.evaluate(() => localStorage.getItem("samsaekpen-ga-internal"));
    await logout(); await login("boss@test.kr", true); const a = await flag();
    await logout(); const b = await flag();
    await login("kim@test.kr"); const c = await flag();
    return expect(a === "1" && b === "1" && c === null, `관리자 ${a}, 로그아웃 뒤 ${b}, 회원 로그인 뒤 ${c}`);
  }],
  ["H", "T75", "이벤트에 이메일이나 댓글 내용이 담기지 않는다", async () => {
    const all = JSON.stringify(await page.evaluate(() => window.samsaekpenEvents));
    const leaks = ["@test.kr", "통계 테스트 댓글", "통계 테스트 답글", "123456"].filter(x => all.includes(x));
    await logout();
    return expect(leaks.length === 0, leaks.length ? "유출: " + leaks.join(", ") : "이메일, 댓글 내용, 비밀번호 없음");
  }],
  ["H", "T76", "측정 ID 가 비어 있으면 GA 스크립트를 불러오지 않는다 (테스트용 복사본)", async () => {
    await goto(); const n = await page.evaluate(() => document.querySelectorAll('script[src*="googletagmanager"]').length + (window.dataLayer ? 1 : 0));
    return expect(n === 0, "GA 스크립트 0개, dataLayer 없음");
  }],
  ["H", "T77", "측정 ID 를 넣으면 GA 로 page_view 를 보내고, 통계 끄기를 누르면 멈춘다", async () => {
    const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "samsaekpen-ga-"));
    const html = withGaId("G-TEST12345");
    fs.writeFileSync(path.join(dir, "index.html"), html);
    await page.goto("file://" + path.join(dir, "index.html")); await wait(600);
    const st = await page.evaluate(() => ({
      tag: document.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-TEST12345"]').length,
      config: (window.dataLayer || []).some(a => a[0] === "config" && a[1] === "G-TEST12345" && a[2] && a[2].send_page_view === false),
      pv: (window.dataLayer || []).filter(a => a[0] === "event" && a[1] === "page_view").length,
      toggle: document.getElementById("gaToggle").textContent
    }));
    await page.click("#gaToggle"); await wait(300);
    const off = await page.evaluate(() => ({ flag: window["ga-disable-G-TEST12345"] === true, label: document.getElementById("gaToggle").textContent }));
    await page.reload(); await wait(600);
    const after = await page.evaluate(() => ({ dl: window.dataLayer ? window.dataLayer.length : 0, label: document.getElementById("gaToggle").textContent }));
    await page.evaluate(() => localStorage.removeItem("samsaekpen-ga-optout"));
    return expect(st.tag === 1 && st.config && st.pv === 1 && st.toggle === "방문 통계 끄기" && off.flag && after.dl === 0 && after.label === "방문 통계 켜기",
      `스크립트 ${st.tag}개, 자동 page_view 끔 ${st.config}, page_view ${st.pv}건 → 끄기 후 재방문 전송 ${after.dl}건`);
  }],

  ["H", "T78", "배포 파일에 측정 ID 가 들어 있다", async () => { const m = SOURCE.match(GA_ID_RE)[0]; return expect(/"G-[A-Z0-9]{6,}"/.test(m), m); }],

  // I. 검색과 공유 (글별 설명, 공유 링크)
  ["I", "T80", "관리자가 검색 설명을 적으면 글 화면의 설명(meta description)이 바뀐다", async () => {
    await logout(); await login("boss@test.kr", true);
    await goto("#write"); await page.fill("#wTitle", "검색 설명 테스트"); await page.fill("#wSummary", "  검색 결과에   나올 한 줄 설명  ");
    await page.fill("#wBody", "본문입니다."); await page.click("#writeSubmit"); await wait(900);
    const onPost = await page.$eval('meta[name="description"]', m => m.content);
    await goto(); const onHome = await page.$eval('meta[name="description"]', m => m.content);
    return expect(onPost === "검색 결과에 나올 한 줄 설명" && onHome.startsWith("생각하는 공방은 AIPM 수업을"), `글: ${onPost} / 첫 화면: ${onHome.slice(0, 15)}…`);
  }],
  ["I", "T81", "검색 설명은 160자까지만 입력되고, 고칠 때 저장된 값이 채워진다", async () => {
    await goto("#list"); await page.click(".post h3 a >> text=검색 설명 테스트"); await wait(400);
    const id = page.url().split("#post-")[1];
    await goto("#edit-" + id); const kept = await page.inputValue("#wSummary");
    await page.fill("#wSummary", "가".repeat(200)); const len = (await page.inputValue("#wSummary")).length;
    return expect(kept === "검색 결과에 나올 한 줄 설명" && len === 160, `채워진 값: ${kept}, 200자 입력 → ${len}자`);
  }],
  ["I", "T82", "공유 링크 복사는 글의 정적 페이지 주소(p/글번호/)를 준다", async () => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await goto("#post-notice-rules"); await page.click("[data-act=copyShare]"); await wait(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    const m = await text("#shareMsg");
    const got = clip || (m.match(/(\S+p\/notice-rules\/)/) || [])[1] || "";
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "share_link_copy").pop());
    return expect(got.endsWith("/p/notice-rules/") && ev && ev.params.post_id === "notice-rules" && Object.keys(ev.params).join() === "post_id", `${got} · ${m.trim().slice(0, 20)}…`);
  }],
  ["I", "T83", "나만보기 글에는 공유 링크 복사 버튼이 없다", async () => {
    await goto("#write"); await page.fill("#wTitle", "공유 안 되는 초안"); await page.check("#visPrivate"); await page.fill("#wBody", "초안");
    await page.click("#writeSubmit"); await wait(900);
    const has = await count("[data-act=copyShare]");
    await page.click("[data-act=delete]"); await wait(150); await page.click("[data-act=delete]"); await wait(600);
    return expect(has === 0, `나만보기 글의 공유 버튼 ${has}개`);
  }],
  ["I", "T84", "첫 화면에 사이트 공유 미리보기 정보(og)가 있다", async () => {
    const og = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(m => [m.getAttribute("property"), m.content])));
    return expect(og["og:image"] === "https://mopnt135.github.io/thinkandmake/og/site.png" && og["og:title"] && og["og:url"], `og:image ${og["og:image"]}`);
  }],

  // J. 첫 화면. 11-24 쉬어가기(고양이, 포켓몬)를 사용자 결정으로 없애며 T90~T99 를 지우고 T102 로 대신한다
  ["J", "T102", "쉬어가기와 외부 API(고양이, 포켓몬, 날씨) 코드가 없다", async () => {
    await goto();
    const n = await count(".fun, .fun-card"), apis = /thecatapi|pokeapi|openweathermap/i.test(SOURCE);
    return expect(n === 0 && !apis, `쉬어가기 요소 ${n}개, 외부 API 코드 ${apis ? "남아 있음" : "없음"}`);
  }],
  ["J", "T103", "공지 글 카드의 사진은 공지 그림이고, 파일에 있는 글(소개, 기획 둘, 이미지 셋)은 자기 그림, 일반 글은 공유 썸네일을 쓴다", async () => {
    await goto("#list");
    const r = await page.$$eval(".post", a => a.map(li => ({ notice: !!li.querySelector(".badge.notice"), href: li.querySelector("h3 a").getAttribute("href"), src: (li.querySelector(".thumb img") || {}).getAttribute?.("src") || "" })));
    const own = { "#post-about": "assets/about-cat.png", "#post-image-1": "assets/posts/image-1.jpg", "#post-image-2": "assets/posts/image-2.jpg", "#post-image-3": "assets/posts/image-3.jpg", "#post-plan-1": "assets/posts/plan-1.jpg", "#post-plan-2": "assets/posts/plan-2.jpg" };
    const n = r.filter(x => x.notice), fixed = r.filter(x => own[x.href]), o = r.filter(x => !x.notice && x.src && !own[x.href]);
    const ok = n.length >= 2 && n.every(x => x.src === "assets/notice-card.jpg") && fixed.length === 6 && fixed.every(x => x.src === own[x.href]) && o.every(x => /^p\/.+\/og\.png$/.test(x.src));
    return expect(ok, `공지 ${n.length}개: ${[...new Set(n.map(x => x.src))].join(", ")} / 파일 글 ${fixed.length}개 / 일반 ${o.length}개`);
  }],
  ["J", "T121", "고정 소개 글: 로그인 안 해도 목록에 보이고, 글에 PM 이 되고 싶은 이유와 이름의 뜻, 고양이 그림이 나오며, 관리자에게도 수정·삭제 버튼이 없다", async () => {
    await logout(); await goto("#post-about"); await wait(200);
    const r = await page.evaluate(() => { const i = document.querySelector(".post-figure img"); const t = document.querySelector(".article-body").textContent;
      return { h1: document.querySelector(".article h1").textContent, img: i && i.getAttribute("src"), alt: i && i.alt, ok: i && i.complete && i.naturalWidth > 0, why: t.includes("PM이 되고 싶은 이유"), name: t.includes("생각(기획)과 공방(직접 만들기)") }; });
    await login("boss@test.kr", true); await goto("#post-about"); await wait(200);
    const edit = await page.$$eval(".article-actions", a => a.length);
    await logout();
    return expect(r.h1 === "생각하는 공방을 소개합니다" && r.img === "assets/about-cat.png" && r.alt && r.ok && r.why && r.name && edit === 0, `${JSON.stringify(r)}, 관리 버튼 ${edit}`);
  }],
  ["J", "T122", "글 메뉴 셋(기획, 이미지, 오늘의 프롬프트): 헤더 '글 목록' 의 소메뉴와 첫 화면 글씨 카드(그림 없음)에 있고, 누르면 그 분류 글만 보이며, 이미지에는 그림 글 3편, 오늘의 프롬프트에는 프롬프트 글 1편이 있다", async () => {
    await goto(); await wait(200);
    const nav = await page.$$eval("nav.main a", a => a.map(x => x.textContent.trim()));
    const cards = await page.$$eval(".menu-card", a => a.map(x => ({ href: x.getAttribute("href"), name: x.querySelector(".mc-name").textContent, img: !!x.querySelector("img"), h: x.getBoundingClientRect().height })));
    const sub = await page.evaluate(() => { const g = document.querySelector(".nav-group"); return { first: g.querySelector(":scope > a").textContent, items: [...g.querySelectorAll(".sub a")].map(a => a.textContent), hidden: getComputedStyle(g.querySelector(".sub")).display === "none" }; });
    await page.hover('.nav-group > a[data-nav="list"]'); await wait(100);
    const shown = await page.$eval(".nav-group .sub", el => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 100);
    await page.click('.menu-card[href="#m-image"]'); await wait(200);
    const img = await page.evaluate(() => ({ h1: document.querySelector(".page h1, .page h2").textContent, n: document.querySelectorAll(".posts .post").length, cur: (document.querySelector('nav.main a[aria-current="page"]') || {}).textContent, chips: [...document.querySelectorAll(".chip")].map(c => c.dataset.c) }));
    await goto("#m-prompt"); await wait(200);
    const plan = await page.evaluate(() => ({ n: document.querySelectorAll(".posts .post").length, first: (document.querySelector(".posts .post h3 a") || {}).getAttribute?.("href") }));
    await page.click('.chip[data-c="전체"]'); await wait(200);
    const back = await page.evaluate(() => ({ hash: location.hash, n: document.querySelectorAll(".posts .post").length }));
    await page.setViewportSize({ width: 390, height: 844 }); await goto(); await wait(200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const mobileH = await page.$$eval(".menu-card", a => Math.min(...a.map(x => x.getBoundingClientRect().height)));
    await page.click("#menuBtn"); await wait(150);
    const mobSub = await page.$$eval(".nav-group .sub a", a => a.filter(x => x.getBoundingClientRect().height >= 44).length);
    await page.click("#menuBtn");
    await page.setViewportSize({ width: 1280, height: 900 });
    const ok = ["기획", "이미지", "오늘의 프롬프트"].every(t => nav.includes(t)) && sub.first === "글 목록" && sub.items.join() === "기획,이미지,오늘의 프롬프트" && sub.hidden && shown && mobSub === 3
      && cards.length === 3 && cards.every(c => !c.img && c.h >= 44 && c.h <= 80)
      && img.n === 3 && img.cur === "이미지" && ["기획", "이미지", "오늘의 프롬프트", "자기소개"].every(c => img.chips.includes(c))
      && plan.n === 1 && plan.first === "#post-prompt-1" && back.hash === "#list" && back.n > 3 && !over && mobileH >= 44;
    return expect(ok, JSON.stringify({ nav, sub, shown, mobSub, cards: cards.map(c => [c.name, c.img, Math.round(c.h)]), img, plan: plan.n, back, over, mobileH }));
  }],
  ["J", "T123", "체험 모드 관리자 로그인은 비밀번호 칸 하나이고, 틀리면 안내하며, 이메일로 먼저 로그인해도 관리자가 되지 않고, 코드에 비밀번호 글자가 없다", async () => {
    await logout(); await goto("#admin");
    const form = await page.evaluate(() => ({ email: !!document.querySelector("#lEmail"), pw: !!document.querySelector("#lPw") }));
    await page.fill("#lPw", "wrong-pass"); await page.click("#loginSubmit"); await wait(300);
    const bad = await page.evaluate(() => ({ msg: $("loginMsg").textContent, still: location.hash === "#admin" && !!document.querySelector("#lPw") }));
    await page.evaluate(() => localStorage.clear()); await login("first@test.kr"); await goto("#admin"); await wait(200);
    const firstNotAdmin = await page.evaluate(() => document.body.textContent.includes("관리자 계정이 아닙니다"));
    await logout(); await login("x", true); await wait(200);
    const ok = await page.evaluate(() => location.hash === "#admin" && !!document.querySelector(".members, .stat"));
    const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    await logout();
    return expect(!form.email && form.pw && bad.msg.includes("비밀번호가 맞지 않습니다") && bad.still && firstNotAdmin && ok && !src.includes("test1125"),
      `칸 ${JSON.stringify(form)}, 틀림 ${bad.msg}, 첫 이메일 관리자 아님 ${firstNotAdmin}, 비밀번호로 관리자 ${ok}, 코드에 글자 없음 ${!src.includes("test1125")}`);
  }],
  ["J", "T124", "기획 메뉴에 PDF 글 2편이 있고, 글에 'PDF 내려받기' 버튼(저장소 안 PDF, 파일 이름 지정)이 있으며, 용사 키우기 PDF 에는 작성자 실명이 없다", async () => {
    await goto("#m-plan"); await wait(200);
    const list = await page.$$eval(".posts .post h3 a", a => a.map(x => x.getAttribute("href")));
    await goto("#post-plan-2"); await wait(200);
    const dl = await page.evaluate(() => { const a = document.querySelector(".post-file a"); return a && { href: a.getAttribute("href"), name: a.getAttribute("download"), info: document.querySelector(".post-file span").textContent }; });
    const files = ["assets/files/PRD-thinkandmake-v1.0.pdf", "assets/files/hero-plan.pdf"].map(f => fs.readFileSync(path.join(ROOT, f)));
    const pdf = files.every(b => b.slice(0, 5).toString() === "%PDF-");
    const raw = files[1].toString("latin1"), noName = !raw.includes("박형준") && !files[1].toString("utf8").includes("박형준");
    const res = await page.evaluate(async h => (await fetch(h)).ok, dl && dl.href).catch(() => false);
    return expect(list.join() === "#post-plan-1,#post-plan-2" && dl && dl.href === "assets/files/hero-plan.pdf" && dl.name.endsWith(".pdf") && dl.info.includes("5쪽") && pdf && noName,
      `목록 ${list}, 버튼 ${JSON.stringify(dl)}, PDF ${pdf}, 실명 없음 ${noName}, 파일 열림 ${res}`);
  }],
  ["J", "T125", "오늘의 프롬프트 글: 사용자가 준 프롬프트를 줄바꿈 그대로 상자에 보여 주고, '프롬프트 복사' 를 누르면 복사 결과를 알린다", async () => {
    await goto("#post-prompt-1"); await wait(200);
    const r = await page.evaluate(() => { const pre = document.querySelector(".prompt-box pre"); return { text: pre && pre.textContent, lines: pre && pre.textContent.split("\n").length, btn: !!document.querySelector('[data-act="copyPrompt"]') }; });
    await page.click('[data-act="copyPrompt"]'); await wait(200);
    const m = await page.$eval("#promptMsg", el => el.textContent);
    const ok = r.text && r.text.startsWith("너는 10년 차 PM 면접관이야.") && r.text.endsWith("프로젝트 이름: [여기에 프로젝트 이름]") && r.lines === 7 && r.btn && (m.includes("복사했어요") || m.includes("직접 복사"));
    return expect(ok, `줄 ${r.lines}, 버튼 ${r.btn}, 안내 ${m}`);
  }],
  ["J", "T126", "예시 회원과 댓글: 실제 글에 '예시' 표시와 함께 달리고, 관리자 댓글 현황과 회원 목록에 같은 데이터가 보이며, 추방 회원의 댓글은 방문자에게 숨는다", async () => {
    await logout(); await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem("seed-test", "1"); });
    await page.reload(); await wait(300); // 저장소를 비운 뒤 화면 메모리에 남은 예전 데이터도 비운다
    await goto("#post-about"); await wait(400);
    const about = await page.$$eval(".comments .c-meta", a => a.map(m => ({ seed: !!m.querySelector(".badge.seed"), reply: !!m.querySelector(".c-rbadge") })));
    await goto("#post-image-1"); await wait(400);
    const spamSeen = await page.evaluate(() => (document.querySelector(".comments") || {}).innerText.includes("무료 쿠폰")); // 본문 글자만(스크립트 글자 제외)
    await login("x", true); await goto("#admin"); await wait(400);
    const mem = await page.evaluate(() => ({ n: document.querySelectorAll(".members li").length, seed: document.querySelectorAll(".members .badge.seed").length, banned: !!document.querySelector(".members .badge.role-banned"), warned: !!document.querySelector(".members .badge.role-warned") }));
    await goto("#admin-comments"); await wait(500);
    const ac = await page.evaluate(() => ({ text: document.querySelector("#view").innerText, seed: document.querySelectorAll(".badge.seed").length }));
    await logout(); await page.evaluate(() => { sessionStorage.removeItem("seed-test"); localStorage.clear(); }); await page.reload(); await goto(); await wait(300);
    const ok = about.length === 2 && about.every(x => x.seed) && about[1].reply && !spamSeen && mem.n === 6 && mem.seed === 6 && mem.banned && mem.warned
      && ac.seed >= 12 && ac.text.includes("무료 쿠폰") && ac.text.includes("PM 이 되고 싶은 이유가 와닿아요") && ac.text.includes("생각하는 공방을 소개합니다");
    return expect(ok, JSON.stringify({ about, spamSeen, mem, acSeed: ac.seed }));
  }],
  ["J", "T104", "헤더 로고는 전구와 톱니 그림(assets/logo.png)이고 제대로 보인다", async () => {
    await goto();
    const r = await page.evaluate(() => { const i = document.querySelector("header .logo img"); return i ? { src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, h: Math.round(i.getBoundingClientRect().height) } : null; });
    return expect(r && r.src === "assets/logo.png" && r.ok && r.h >= 24, r ? `그림 ${r.src}, 보임 ${r.ok}, 높이 ${r.h}px` : "로고 그림 없음");
  }],
  ["J", "T105", "헤더와 푸터에 'THINK & MAKE'(금색)가 있고, 푸터 로고는 왼쪽에 흰 전구 그림이다", async () => {
    await goto();
    const r = await page.evaluate(() => { const tg = [...document.querySelectorAll(".tagline")].map(e => [e.textContent, getComputedStyle(e).color]);
      const fb = document.querySelector(".foot-brand"), img = fb && fb.querySelector("img"), info = document.querySelector(".foot-info");
      return { tg, name: fb ? getComputedStyle(fb.querySelector(".foot-name")).color : "", img: img && img.getAttribute("src"), ok: img && img.naturalWidth > 0, left: fb && info && fb.getBoundingClientRect().left < info.getBoundingClientRect().left }; });
    const gold = r.tg.length === 2 && r.tg.every(([t, c]) => t === "THINK & MAKE" && c === "rgb(184, 134, 43)");
    return expect(gold && r.name === "rgb(255, 255, 255)" && r.img === "assets/logo-footer.png" && r.ok && r.left, `글자 ${r.tg.length}곳 금색 ${gold}, 이름 ${r.name}, 그림 ${r.img}, 왼쪽 ${r.left}`);
  }],
  ["J", "T106", "파비콘이 새 로고 그림으로 연결되어 있고 파일이 열린다", async () => {
    await goto();
    const links = await page.$$eval('link[rel="icon"], link[rel="apple-touch-icon"]', a => a.map(l => l.getAttribute("href")));
    const missing = links.filter(h => !fs.existsSync(path.join(ROOT, h)));
    const loaded = await page.evaluate(async () => { const i = new Image(); i.src = "assets/favicon-32.png"; await i.decode().catch(() => {}); return i.naturalWidth; });
    return expect(links.length >= 3 && links.every(h => h.startsWith("assets/")) && missing.length === 0 && loaded === 32, `연결 ${links.length}개, 없는 파일 ${missing.length}개, 32px 그림 너비 ${loaded}`);
  }],
  ["K", "T110", "챗봇 답 파일이 준비되면 오른쪽 아래에 블로그 로고와 '질문해주세요' 버튼이 보이고, 누르면 '생각하는 공방' 대화창에 인사와 준비된 질문이 나온다", async () => {
    await goto(); await wait(300);
    const pos = await page.$eval("#chatFab", b => { const r = b.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom, h: r.height }; });
    await page.click("#chatFab"); await wait(200);
    const r = await page.evaluate(() => ({ open: !$("chatPanel").hidden, hello: $("chatLog").textContent, chips: document.querySelectorAll("#chatChips button").length }));
    await shot("chatbot-open");
    const fab = await page.$eval("#chatFab", b => ({ text: b.textContent.trim(), logo: (b.querySelector(".fab-avatar img") || {}).getAttribute?.("src"), ok: !!b.querySelector(".fab-avatar img") && b.querySelector(".fab-avatar img").naturalWidth > 0 }));
    return expect(pos.right < 40 && pos.bottom < 40 && pos.h >= 44 && r.open && r.hello.includes("포트폴리오 안내") && r.chips === 2 && fab.text === "질문해주세요" && fab.logo === "assets/logo.png" && fab.ok && (await page.$eval("#chatTitle", h => h.textContent)) === "생각하는 공방",
      `오른쪽 ${pos.right}px, 아래 ${pos.bottom}px, 높이 ${pos.h}px, 질문 ${r.chips}개, 버튼 ${JSON.stringify(fab)}`);
  }],
  ["K", "T111", "준비된 질문을 누르면 그 답이 나오고, 답 속 HTML 기호는 글자로만 보이며, 챗봇 말풍선 옆에는 블로그 로고 얼굴이 있다", async () => {
    await page.click("#chatChips button >> nth=1"); await wait(150);
    const faces = await page.$$eval("#chatLog .bot-row", rows => rows.map(r => { const i = r.querySelector(".bot-face img"); return !!i && i.getAttribute("src") === "assets/logo.png" && i.naturalWidth > 0 && !!r.querySelector(".bubble.bot"); }));
    const r = await page.evaluate(() => ({ text: $("chatLog").textContent, tags: $("chatLog").querySelectorAll("img:not(.bot-face img), b").length /* 로고 얼굴 그림(11-25)은 빼고 센다 */ }));
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "chatbot_question").pop());
    return expect(r.text.includes("<b>Supabase</b>") && r.tags === 0 && ev && ev.params.q_index === 2 && ev.params.source === "chip" && faces.length >= 2 && faces.every(Boolean), `태그 ${r.tags}개, 로고 얼굴 ${faces.length}개 ${faces.every(Boolean)}, 기록 ${JSON.stringify(ev && ev.params)}`);
  }],
  ["K", "T112", "직접 적은 질문은 낱말로 맞는 답을 찾고, 없으면 준비된 질문을 고르라고 안내한다. 적은 글자는 기록에 보내지 않는다", async () => {
    await page.fill("#chatQ", "어떤 기술을 썼나요"); await page.press("#chatQ", "Enter"); await wait(150);
    const hit = await page.evaluate(() => [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent);
    await page.fill("#chatQ", "점심 메뉴 추천해 줘"); await page.press("#chatQ", "Enter"); await wait(150);
    const miss = await page.evaluate(() => [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent);
    const ev = await page.evaluate(() => window.samsaekpenEvents.filter(e => e.name === "chatbot_question").slice(-2));
    const leaked = JSON.stringify(ev).includes("점심") || JSON.stringify(ev).includes("기술을");
    return expect(hit.includes("Supabase") && miss.includes("준비된 질문") && ev[1].params.matched === false && !leaked, `맞춤: ${hit.slice(0, 20)}, 없음: ${miss.slice(0, 20)}, 글자 보냄 ${leaked}`);
  }],
  ["K", "T113", "Esc 나 닫기 버튼으로 닫히고, 휴대폰 너비에서도 창이 화면 안에 들어간다", async () => {
    await page.press("#chatQ", "Escape"); await wait(100);
    const closed = await page.evaluate(() => $("chatPanel").hidden && document.activeElement === $("chatFab"));
    await page.setViewportSize({ width: 390, height: 844 }); await goto(); await wait(300);
    await page.click("#chatFab"); await wait(200);
    const box = await page.$eval("#chatPanel", p => { const r = p.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, w: innerWidth, over: document.documentElement.scrollWidth > innerWidth }; });
    await shot("chatbot-mobile");
    await page.click("#chatClose"); await page.setViewportSize({ width: 1280, height: 900 });
    return expect(closed && box.l >= 0 && box.r <= box.w && box.t >= 0 && !box.over, `Esc 로 닫힘 ${closed}, 창 ${Math.round(box.l)}~${Math.round(box.r)} / ${box.w}`);
  }],
  ["K", "T114", "자료 작성 전(ready: false)이거나 답 파일이 없으면 말풍선을 보이지 않는다", async () => {
    writeChat({ ...CHAT_QA, ready: false }); await page.reload(); await wait(500);
    const a = await page.$eval("#chatFab", b => b.hidden);
    writeChat(null); await page.reload(); await wait(500);
    const b = await page.$eval("#chatFab", b => b.hidden);
    writeChat(CHAT_QA); await page.reload(); await wait(400);
    return expect(a && b, `작성 전 숨김 ${a}, 파일 없음 숨김 ${b}`);
  }],
  ["K", "T115", "답에 그림이 있으면 답 아래에 사진과 영상 썸네일(재생 안 됨 표시, 영상 태그 없음)이 나오고, 저장소 밖 주소는 버린다", async () => {
    writeChat({ ...CHAT_QA, items: [...CHAT_QA.items, { q: "예시 작품 보여 주세요", a: "예시 작품입니다.", keywords: ["작품"], media: [
      { src: "assets/portfolio/example-1-banner.jpg", alt: "예시 1 <b>배너</b>" },
      { src: "assets/portfolio/example-3-video-thumb.jpg", alt: "예시 3 영상 한 장면", video: true },
      { src: "https://evil.example/x.jpg", alt: "바깥 주소" }, { src: "assets/portfolio/../../secret.jpg", alt: "경로 공격" }] }] });
    await page.reload(); await wait(400); await page.click("#chatFab"); await wait(200);
    await page.click("#chatChips button >> nth=2"); await wait(600);
    const r = await page.evaluate(() => { const figs = [...document.querySelectorAll("#chatLog .chat-media figure")];
      return { n: figs.length, srcs: figs.map(f => f.querySelector("img").getAttribute("src")), ok: figs.every(f => f.querySelector("img").naturalWidth > 0),
        cap: figs.map(f => f.querySelector("figcaption").textContent), bold: document.querySelectorAll("#chatLog b").length,
        tag: figs.map(f => (f.querySelector(".chat-media-tag") || {}).textContent || ""), video: document.querySelectorAll("#chatLog video").length,
        wide: Math.max(...figs.map(f => f.getBoundingClientRect().right)) <= document.querySelector("#chatPanel").getBoundingClientRect().right }; });
    await shot("chatbot-media");
    await page.click("#chatClose"); writeChat(CHAT_QA); await page.reload(); await wait(400);
    return expect(r.n === 2 && r.ok && r.srcs.every(x => x.startsWith("assets/portfolio/")) && r.cap[0] === "예시 1 <b>배너</b>" && r.bold === 0
      && r.tag[0] === "" && r.tag[1].includes("재생 안 됨") && r.video === 0 && r.wide, JSON.stringify(r));
  }],
  ["K", "T116", "질문을 고르면 준비된 질문 영역이 접혀 답 자리가 넓어지고, '준비된 질문 보기'를 누르면 다시 펼쳐진다(휴대폰 너비)", async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await goto(); await wait(300);
    await page.click("#chatFab"); await wait(200);
    const st = () => page.evaluate(() => ({ hidden: $("chatChips").hidden, exp: $("chatChipsToggle").getAttribute("aria-expanded"), text: $("chatChipsToggle").textContent,
      h: $("chatChipsToggle").getBoundingClientRect().height, log: $("chatLog").getBoundingClientRect().height }));
    const a = await st();
    await page.click("#chatChips button >> nth=0"); await wait(200);
    const b = await st();
    await shot("chatbot-folded");
    await page.click("#chatChipsToggle"); await wait(150);
    const c = await st();
    await page.click("#chatChipsToggle"); await page.fill("#chatQ", "블로그"); await page.press("#chatQ", "Enter"); await page.click("#chatChipsToggle"); await wait(150);
    const d = await st();
    await page.click("#chatClose"); await page.setViewportSize({ width: 1280, height: 900 });
    return expect(!a.hidden && a.exp === "true" && b.hidden && b.exp === "false" && b.text.includes("보기 (2개)") && b.h >= 44 && b.log > a.log
      && !c.hidden && c.exp === "true" && c.text.includes("접기") && !d.hidden, `처음 ${JSON.stringify(a)} / 고른 뒤 ${JSON.stringify(b)} / 다시 ${c.exp}`);
  }],
  ["K", "T117", "버튼에 없는 숨은 질문도 다르게 묻는 말로 찾아 답하고, 글로 만든 답에는 '이 글 읽기' 링크가 붙는다. 블로그와 무관한 질문은 범위를 알리고 질문 버튼을 다시 열되 안내 말은 보이게 둔다", async () => {
    writeChat({ ...CHAT_QA, items: [{ ...CHAT_QA.items[0], chip: true }, { ...CHAT_QA.items[1], chip: true },
      { q: "PRD 는 어떻게 쓰나요?", a: "문제를 먼저 적습니다.", keywords: ["PRD"], alts: ["기획서 쓰는 법"], post_id: "demo-1" },
      { q: "숨은 질문", a: "나쁜 링크", keywords: ["해킹"], post_id: "../x\" onclick=alert(1)" }] });
    await page.reload(); await wait(400); await page.click("#chatFab"); await wait(200);
    const chips = await page.$$eval("#chatChips button", b => b.length);
    await page.fill("#chatQ", "기획서 쓰는 법이 궁금해요"); await page.press("#chatQ", "Enter"); await wait(150);
    const hit = await page.evaluate(() => ({ text: [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent, link: (document.querySelector("#chatLog .chat-post") || {}).getAttribute?.("href") }));
    await page.fill("#chatQ", "해킹 방법"); await page.press("#chatQ", "Enter"); await wait(150);
    const bad = await page.$$eval("#chatLog .chat-post", a => a.map(x => x.getAttribute("href")));
    await page.fill("#chatQ", "오늘 서울 날씨 어때"); await page.press("#chatQ", "Enter"); await wait(150);
    const miss = await page.evaluate(() => { const l = $("chatLog"), last = [...l.querySelectorAll(".bubble.bot")].pop(), r = last.getBoundingClientRect(), lr = l.getBoundingClientRect();
      return { text: last.textContent, open: !$("chatChips").hidden, seen: r.bottom <= lr.bottom + 1 && r.top >= lr.top - 1 }; });
    await page.click("#chatClose"); writeChat(CHAT_QA); await page.reload(); await wait(400);
    return expect(chips === 2 && hit.text.includes("문제를 먼저") && hit.link === "#post-demo-1" && bad.length === 1 && miss.text.includes("블로그와 포트폴리오에 관한 질문에만") && miss.open && miss.seen,
      `버튼 ${chips}, 맞춤 ${hit.text} ${hit.link}, 링크 ${JSON.stringify(bad)}, 무관 ${miss.open} 보임 ${miss.seen}`);
  }],
  ["K", "T118", "적은 말은 끝의 조사와 어미를 떼고 맞추며, 적은 낱말의 절반도 맞지 않는 답이나 흔한 말로만 걸친 답은 내지 않는다", async () => {
    writeChat({ ready: true, greeting: "안녕", items: [
      { q: "연락은 어떻게 하나요?", a: "이메일로 연락 주세요.", keywords: ["연락", "이메일"], alts: ["이메일 뭐예요?"], chip: true },
      { q: "관리자 AI 기능은요?", a: "제목 추천과 태그를 만듭니다.", keywords: ["제목", "태그"], alts: ["제목 추천도 해 줘요?"], chip: true },
      { q: "보안은요?", a: "키를 숨겼습니다.", keywords: ["보안"], alts: ["보안은 어때요?"] }] });
    await page.reload(); await wait(400); await page.click("#chatFab"); await wait(200);
    const ask = async q => { await page.fill("#chatQ", q); await page.press("#chatQ", "Enter"); await wait(100);
      return page.evaluate(() => [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent); };
    const r = { mail: await ask("이메일 주소 알려주세요"), lunch: await ask("맛있는 점심 메뉴 추천해 줘"), weather: await ask("오늘 서울 날씨 어때"), tag: await ask("태그는 어떻게 만들어요?") };
    await page.click("#chatClose"); writeChat(CHAT_QA); await page.reload(); await wait(400);
    const out = t => t.includes("관한 질문에만");
    return expect(r.mail.includes("이메일로") && out(r.lunch) && out(r.weather) && r.tag.includes("태그"), JSON.stringify(r));
  }],
  ["K", "T119", "여러 답에 두루 나오는 주제어(포트폴리오)로만 물어도 답하고, 질문에 없던 낱말은 답 글에서도 찾는다", async () => {
    writeChat({ ready: true, greeting: "안녕", items: [
      { q: "누구인가요?", a: "PM 을 꿈꿉니다.", keywords: ["자기소개"], alts: ["포트폴리오 주인은?"], chip: true },
      { q: "작품이 있나요?", a: "예시 작품 세 개가 있습니다.", keywords: ["포트폴리오", "작품"], alts: ["포트폴리오 몇 개예요?"], chip: true },
      { q: "블로그 기능은요?", a: "기기가 다크 모드면 블로그도 어두워집니다.", keywords: ["기능"] }] });
    await page.reload(); await wait(400); await page.click("#chatFab"); await wait(200);
    const ask = async q => { await page.fill("#chatQ", q); await page.press("#chatQ", "Enter"); await wait(100);
      return page.evaluate(() => [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent); };
    const r = { pf: await ask("포트폴리오 있어?"), dark: await ask("다크 모드 돼?"), out: await ask("주식 투자 어떻게 해") };
    await page.click("#chatClose"); writeChat(CHAT_QA); await page.reload(); await wait(400);
    return expect(r.pf.includes("예시 작품") && r.dark.includes("다크 모드") && r.out.includes("관한 질문에만"), JSON.stringify(r));
  }],
  ["K", "T120", "비슷한 말(돈→비용, 한 글자 '뜻'→이름·의미)로도 찾고, 영어 낱말은 통째로만 맞추며(ai≠aipm), 찾을 낱말과 똑같은 답을 먼저 고른다", async () => {
    writeChat({ ready: true, greeting: "안녕", items: [
      { q: "어떤 블로그예요?", a: "AIPM 수업 복습 블로그입니다.", keywords: ["AIPM", "블로그"], chip: true },
      { q: "운영 비용은요?", a: "비용 없이 운영합니다.", keywords: ["비용"], chip: true },
      { q: "어떤 도구를 썼어요?", a: "Claude API 를 썼습니다.", keywords: ["도구", "ClaudeAPI"], alts: ["어떤 AI 써요?"] },
      { q: "회원은 뭘 하나요?", a: "회원은 글을 읽습니다.", keywords: ["회원"], alts: ["회원은 뭘 할 수 있어요?"] },
      { q: "댓글은 어떻게 다나요?", a: "회원가입하면 댓글을 답니다.", keywords: ["회원가입", "댓글"], alts: ["회원가입 어떻게 해요?"] },
      { q: "블로그 주인은 누구예요?", a: "PM 을 꿈꾸는 생각하는 공방입니다.", keywords: ["생각하는공방", "주인"], alts: ["누가 만들었어요?"] },
      { q: "블로그 이름은 무슨 의미예요?", a: "생각(기획)과 공방(만들기)을 담았습니다.", keywords: ["이름", "의미"], alts: ["이름 의미가 뭐예요?"] }] });
    await page.reload(); await wait(400); await page.click("#chatFab"); await wait(200);
    const ask = async q => { await page.fill("#chatQ", q); await page.press("#chatQ", "Enter"); await wait(100);
      return page.evaluate(() => [...document.querySelectorAll("#chatLog .bubble.bot")].pop().textContent); };
    const r = { money: await ask("돈 얼마 들었어?"), model: await ask("AI 모델 뭐 써?"), join: await ask("회원가입 어떻게 해?"), mean: await ask("생각하는 공방은 무슨 뜻이야") };
    await page.click("#chatClose"); writeChat(CHAT_QA); await page.reload(); await wait(400);
    return expect(r.money.includes("비용 없이") && r.model.includes("Claude") && r.join.includes("회원가입하면") && r.mean.includes("기획"), JSON.stringify(r));
  }],
  ["J", "T101", "로그인하면 헤더의 '내 계정'을 눌러 계정 상자를 연다", async () => {
    await logout(); await login("boss@test.kr", true); await goto();
    const closed = await page.$eval(".acct-menu", d => d.open);
    await page.click(".acct-menu > summary"); await wait(150);
    const r = await page.evaluate(() => { const box = document.querySelector(".acct-pop .account"); return { open: document.querySelector(".acct-menu").open, seen: !!box && box.getBoundingClientRect().height > 0, text: box ? box.textContent : "" }; });
    await page.click(".acct-menu > summary"); await logout();
    return expect(!closed && r.open && r.seen && r.text.includes("관리자 (체험 모드)"), `처음 닫힘 ${!closed}, 눌러서 열림 ${r.open}, 상자 보임 ${r.seen}`);
  }],
  // 11-24 사용자 결정: 사이트 이름이 사진과 겹쳐 빼고 사진만 둔다. 꾸밈 사진이라 화면 읽기 프로그램에는 숨긴다
  ["J", "T100", "첫 화면 맨 위에 메인 사진만 보이고(이름 없음), 사진 파일은 300KB 이하다", async () => {
    await goto();
    const r = await page.evaluate(() => { const b = document.querySelector(".banner"), img = b && b.querySelector("img");
      return { ok: !!img && img.complete && img.naturalWidth > 0, alt: img && img.getAttribute("alt"), hidden: b && b.getAttribute("aria-hidden"), text: b ? b.textContent.trim() : "x" }; });
    const big = ["hero-1408.jpg", "hero-800.jpg"].map(f => fs.statSync(path.join(ROOT, "assets", f)).size).filter(n => n > 300 * 1024);
    return expect(r.ok && r.alt === "" && r.hidden === "true" && r.text === "" && big.length === 0, `사진 ${r.ok ? "보임" : "안 보임"}, alt "${r.alt}", 숨김 ${r.hidden}, 글자 "${r.text}", 300KB 넘는 파일 ${big.length}개`);
  }],

  // G. 화면 크기와 테마
  ["G", "T60", "휴대폰 너비에서 화면이 옆으로 넘치지 않는다", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const bad = [];
    for (const h of ["", "#list", "#post-notice-rules", "#write", "#admin", "#login"]) { await goto(h); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) bad.push(h || "#"); }
    await goto(); await shot("home-mobile");
    await page.setViewportSize({ width: 1280, height: 900 });
    return expect(bad.length === 0, bad.length ? "넘침: " + bad.join(", ") : "6개 화면 모두 정상");
  }],
  ["G", "T61", "다크모드에서 어두운 배경과 밝은 글자로 바뀐다", async () => {
    await page.emulateMedia({ colorScheme: "dark" }); await goto();
    const [bg, fg] = await page.evaluate(() => { const s = getComputedStyle(document.body); return [s.backgroundColor, s.color]; });
    await shot("home-dark"); await page.emulateMedia({ colorScheme: "light" });
    return expect(bg === "rgb(53, 56, 57)" && fg === "rgb(255, 255, 255)", `배경 ${bg}, 글자 ${fg}`); // 11-24 새 색: 배경 #353839, 글자 #FFFFFF
  }],
  ["G", "T63", "푸터는 문양색 #2F3E63 바탕에 밝은 글자다 (밝은 화면, 어두운 화면)", async () => {
    const read = () => page.evaluate(() => { const f = getComputedStyle(document.querySelector("footer")), a = getComputedStyle(document.querySelector("footer a")); return [f.backgroundColor, f.color, a.color]; });
    await goto(); const light = await read();
    await page.emulateMedia({ colorScheme: "dark" }); await goto(); const dark = await read(); await page.emulateMedia({ colorScheme: "light" });
    const ok = light[0] === "rgb(47, 62, 99)" && light[1] === "rgb(255, 255, 240)" && light[2] === "rgb(255, 255, 240)" && dark[0] === "rgb(47, 62, 99)" && dark[1] === "rgb(255, 255, 255)";
    return expect(ok, `밝게 ${light.join(" / ")}, 어둡게 ${dark.join(" / ")}`);
  }],
  ["G", "T62", "전체 테스트 동안 스크립트 오류가 없다", async () => expect(errors.length === 0, errors.length ? errors.join(" | ") : "오류 0건")],
];

(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // 11-25: 체험 모드는 예시 회원과 댓글(DEMO_SEED)을 처음 한 번 넣는다. 다른 시험은 빈 상태에서 세므로 기본으로 건너뛰고,
  // 예시 데이터는 T126 이 sessionStorage "seed-test" 를 켜고 따로 확인한다
  await page.addInitScript(() => { const k = "samsaekpen-demo-v3"; if (!sessionStorage.getItem("seed-test") && !localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ seeded: "s1" })); });
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/googletagmanager\.com|google-analytics\.com/, r => r.abort());
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  for (const [area, id, name, fn] of tests) {
    const t0 = Date.now();
    try { const detail = await fn(); results.push({ area, id, name, pass: true, detail, ms: Date.now() - t0 }); }
    catch (e) { results.push({ area, id, name, pass: false, detail: e.message.split("\n")[0], ms: Date.now() - t0 }); }
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  const fail = results.filter(r => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.name} — ${r.detail}`);
  console.log(`\n${results.length}건 중 ${results.length - fail.length}건 통과, ${fail.length}건 실패`);
  process.exit(fail.length ? 1 : 0);
})();
