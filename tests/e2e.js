/*
 * 삼색펜 화면 테스트 (체험 모드)
 * 실행: node tests/e2e.js [결과 JSON 경로] [스크린샷 폴더]
 * 필요: playwright (require('playwright')), index.html 과 tests/fixtures 폴더
 * Supabase 를 연결하지 않은 체험 모드에서 화면 동작을 확인합니다.
 * 서버 권한 규칙은 tests/rls_test.py 에서 따로 확인합니다.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const URL = "file://" + path.join(ROOT, "index.html");
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
const login = async (email, admin) => {
  await goto(admin ? "#admin" : "#login");
  await page.fill("#lEmail", email); await page.fill("#lPw", "123456");
  await page.click("#loginSubmit"); await wait(500);
};
const logout = async () => { const b = await page.$("#authArea [data-act=logout]"); if (b) { await b.click(); await wait(450); } };
const expect = (cond, detail) => { if (!cond) throw new Error(detail); return detail; };
const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }); };

let postUrl = "";

const tests = [
  // A. 공통 화면
  ["A", "T01", "첫 화면이 오류 없이 열린다", async () => { await goto(); await shot("home-desktop"); return expect(errors.length === 0 && (await count(".tile")) === 3, "바로가기 3개, 스크립트 오류 0건"); }],
  ["A", "T02", "첫 화면 공지 제목이 운영 기준이다", async () => expect((await text("#view h1")).includes("운영 기준"), "제목: " + (await text("#view h1")))],
  ["A", "T03", "글 목록 맨 위에 공지 2개가 있다", async () => { await goto("#list"); const t = await page.$$eval(".post h3", a => a.slice(0, 2).map(x => x.textContent)); return expect(t.length === 2 && t[0].includes("운영 기준") && t[1].includes("이용 안내"), t.join(", ")); }],
  ["A", "T04", "공지 상세와 다른 글 이동이 된다", async () => { await goto("#post-notice-rules"); const pager = await page.$$eval(".pager a span", a => a.map(x => x.textContent)); return expect((await text("#view h1")).includes("운영 기준") && pager.includes("삼색펜 이용 안내"), "다른 글: " + pager.join(", ")); }],
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
    return expect(bg === "rgb(13, 13, 13)" && fg === "rgb(245, 245, 245)", `배경 ${bg}, 글자 ${fg}`);
  }],
  ["G", "T62", "전체 테스트 동안 스크립트 오류가 없다", async () => expect(errors.length === 0, errors.length ? errors.join(" | ") : "오류 0건")],
];

(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errors.push(e.message));
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
