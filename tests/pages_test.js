/*
 * 검색, 공유용 정적 페이지 생성기(scripts/build-pages.js) 테스트
 * 실행: node tests/pages_test.js
 * Supabase 대신 가짜 글 목록(JSON)으로 임시 폴더에 만들고, 결과 HTML 을 검사한다.
 * 썸네일 PNG 는 한글 글꼴이 필요해서 여기서는 그리지 않는다(--no-images).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://mopnt135.github.io/test-261117/";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "samsaekpen-pages-"));
const out = path.join(tmp, "site");
const postsFile = path.join(tmp, "posts.json");

const longBody = "프롬프트 ".repeat(80);
const posts = [
  { id: 12, title: "PRD 쓰는 법", body: "본문 첫 줄\n\n둘째 줄", category: "기초 개념", summary: "PRD 를 한 장으로 쓰는 순서를 정리했습니다.", visibility: "public", created_at: "2026-11-10T01:00:00Z", updated_at: "2026-11-11T01:00:00Z" },
  { id: 13, title: "<script>alert(1)</script> \"따옴표\" & 기호", body: "</script><img src=x onerror=alert(1)>", category: "실습 기록", visibility: "public", created_at: "2026-11-12T01:00:00Z" },
  { id: 14, title: "긴 본문", body: longBody, category: "일반", visibility: "public", created_at: "2026-11-13T01:00:00Z" },
  { id: 15, title: "초안", body: "비밀 초안", category: "일반", visibility: "private", created_at: "2026-11-14T01:00:00Z" },
  { id: "../evil", title: "경로 공격", body: "x", category: "일반", visibility: "public", created_at: "2026-11-14T01:00:00Z" }
];
fs.writeFileSync(postsFile, JSON.stringify(posts));
fs.mkdirSync(path.join(out, "p", "99"), { recursive: true });
fs.writeFileSync(path.join(out, "p", "99", "index.html"), "예전 글");

const run = () => execFileSync("node", [path.join(ROOT, "scripts/build-pages.js"), "--out", out, "--posts-json", postsFile, "--no-images"], { encoding: "utf8" });
const log = run();
const read = rel => fs.readFileSync(path.join(out, rel), "utf8");
const exists = rel => fs.existsSync(path.join(out, rel));
const meta = (html, attr, name) => { const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)); return m ? m[1] : null; };

const results = [];
function check(id, name, fn) {
  let pass = false, detail = "";
  try { [pass, detail] = fn(); } catch (e) { detail = e.message; }
  results.push({ id, name, pass, detail });
}

check("G1", "공개글과 공지마다 페이지가 생기고 나만보기 글은 빠진다", () => {
  const ok = ["12", "13", "14", "notice", "notice-rules"].every(d => exists(`p/${d}/index.html`)) && !exists("p/15");
  return [ok, log.trim()];
});
check("G2", "글마다 제목과 설명이 다르다", () => {
  const a = read("p/12/index.html"), b = read("p/14/index.html");
  const ok = a.includes("<title>PRD 쓰는 법 · 삼색펜</title>") && meta(a, "property", "og:title") === "PRD 쓰는 법"
    && meta(a, "name", "description") === "PRD 를 한 장으로 쓰는 순서를 정리했습니다." && meta(b, "property", "og:title") === "긴 본문";
  return [ok, `12번 설명: ${meta(a, "name", "description")}`];
});
check("G3", "검색 설명이 비어 있으면 본문 앞 120자에 … 를 붙인다", () => {
  const d = meta(read("p/14/index.html"), "name", "description");
  return [d.endsWith("…") && d.length <= 121 && d.startsWith("프롬프트 프롬프트"), `${d.length}자`];
});
check("G4", "썸네일과 주소는 전체 주소(https://…)로 적는다", () => {
  const h = read("p/12/index.html");
  const ok = meta(h, "property", "og:image") === `${SITE}p/12/og.png?v=${Date.parse("2026-11-11T01:00:00Z").toString(36)}` && meta(h, "property", "og:url") === `${SITE}p/12/`
    && h.includes(`<link rel="canonical" href="${SITE}p/12/">`) && meta(h, "name", "twitter:card") === "summary_large_image";
  return [ok, meta(h, "property", "og:image")];
});
check("G13", "글을 고치면 썸네일 주소의 ?v= 값이 바뀐다 (카카오톡 캐시 대비)", () => {
  const v = h => meta(h, "property", "og:image").split("?v=")[1];
  const a = v(read("p/12/index.html")), b = v(read("p/14/index.html"));
  return [a && b && a !== b && meta(read("p/12/index.html"), "name", "twitter:image").endsWith(`?v=${a}`), `12번 v=${a}, 14번 v=${b}`];
});
check("G5", "제목과 본문의 HTML 기호는 글자로 바뀐다", () => {
  const h = read("p/13/index.html");
  const ok = !h.includes("<script>alert") && !h.includes("<img src=x") && h.includes("&lt;script&gt;alert(1)&lt;/script&gt; &quot;따옴표&quot; &amp; 기호");
  return [ok, ok ? "모두 바뀜" : "바뀌지 않은 기호가 있음"];
});
check("G6", "구조화 데이터(JSON-LD)가 올바르고 </script> 로 끊기지 않는다", () => {
  const h = read("p/13/index.html");
  const raw = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const ld = JSON.parse(raw);
  return [ld["@type"] === "BlogPosting" && ld.headline.startsWith("<script>") && !raw.includes("</"), `headline: ${ld.headline.slice(0, 20)}…`];
});
check("G7", "글 번호가 이상하면(../ 등) 페이지를 만들지 않는다", () => {
  const bad = fs.readdirSync(path.join(out, "p")).filter(d => !/^[\w-]+$/.test(d));
  return [bad.length === 0 && !fs.existsSync(path.join(tmp, "evil")), `p 폴더: ${fs.readdirSync(path.join(out, "p")).join(", ")}`];
});
check("G8", "더 이상 공개가 아닌 글의 예전 페이지는 지운다", () => [!exists("p/99"), exists("p/99") ? "남아 있음" : "지움"]);
check("G9", "사이트맵에 공개 페이지만 들어가고 robots.txt 가 사이트맵을 알려준다", () => {
  const sm = read("sitemap.xml"), rb = read("robots.txt");
  const ok = sm.includes(`<loc>${SITE}p/12/</loc><lastmod>2026-11-11</lastmod>`) && sm.includes(`<loc>${SITE}</loc>`) && !sm.includes("p/15/")
    && rb.includes(`Sitemap: ${SITE}sitemap.xml`);
  return [ok, `사이트맵 주소 ${(sm.match(/<loc>/g) || []).length}개`];
});
check("G10", "정적 페이지에서 블로그 원래 글(#post-번호)로 갈 수 있다", () => {
  const h = read("p/12/index.html");
  return [h.includes('href="../../#post-12"'), "블로그에서 보고 댓글 달기 링크"];
});
check("G11", "다시 실행해도 같은 결과가 나온다", () => {
  const before = read("p/12/index.html"); run();
  return [before === read("p/12/index.html"), "두 번째 실행 결과 같음"];
});
check("G12", "저장소의 p/ 폴더는 생성기 결과와 같다 (손으로 고치지 않았다)", () => {
  const notices = ["notice", "notice-rules"];
  const same = notices.every(n => fs.readFileSync(path.join(ROOT, "p", n, "index.html"), "utf8") === read(`p/${n}/index.html`));
  return [same, same ? "공지 페이지 2개 같음" : "다름. node scripts/build-pages.js 를 다시 실행하세요"];
});

fs.rmSync(tmp, { recursive: true, force: true });
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.name} — ${r.detail}`);
const fails = results.filter(r => !r.pass).length;
console.log(`\n${results.length}건 중 ${results.length - fails}건 통과, ${fails}건 실패`);
process.exit(fails ? 1 : 0);
