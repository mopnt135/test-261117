/*
 * 생각하는 공방 검색, 공유용 정적 페이지 만들기
 *
 * 왜 필요한가: 블로그는 index.html 한 장에서 #post-12 같은 # 주소로 화면을 바꾼다.
 * 검색엔진과 카카오톡, 페이스북 같은 공유 미리보기는 # 뒤를 다른 페이지로 보지 않고,
 * 대부분 자바스크립트도 실행하지 않는다. 그래서 글마다 실제 주소(/p/12/)를 가진
 * HTML 파일을 만들고, 그 안에 글별 제목, 설명, 썸네일(og:image)을 적어 둔다.
 *
 * 실행: node scripts/build-pages.js [--out 폴더] [--posts-json 파일] [--no-images]
 *  - 공지 2개는 index.html 에서 읽는다.
 *  - Supabase 주소와 공개용 키가 index.html 에 있으면 공개글을 읽어 온다. 나만보기 글은 만들지 않는다.
 *  - --posts-json 은 테스트용. Supabase 대신 이 파일의 글을 쓴다.
 *  - 썸네일 PNG 는 Playwright(Chromium)로 그린다. 한글 글꼴이 설치돼 있어야 한다.
 *    OG_FONT_CSS 환경 변수로 @font-face CSS 파일을 줄 수도 있다.
 *  - ai/<글번호>.json(scripts/ai-assist.js 결과)이 있고 글 내용이 그대로면, 글 페이지에 AI 3줄 요약을 넣는다.
 * 결과: p/<글번호>/index.html, p/<글번호>/og.png, og/site.png, sitemap.xml, robots.txt
 * 더 이상 공개가 아닌 글의 p/<글번호>/ 폴더는 지운다.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(arg("--out") || ROOT);
const POSTS_JSON = arg("--posts-json");
const NO_IMAGES = args.includes("--no-images");
const ATT_DIR = arg("--attachments-dir"); // 테스트용. Supabase 보관함 대신 이 폴더에서 첨부 사진을 읽는다

const SITE_URL = "https://mopnt135.github.io/test-261117/";
const SITE_NAME = "생각하는 공방";
// 로고(전구와 톱니). 썸네일 카드는 파일 주소 대신 데이터로 넣어야 그림 그리기 브라우저가 바로 읽는다
const LOGO_URI = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "assets", "logo.png")).toString("base64");
const SITE_DESC = "생각하는 공방은 AIPM 수업을 들으며 생각하고 만든 것을 기록하는 복습 노트 블로그입니다. THINK & MAKE";
const DESC_MAX = 120;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kstDate = iso => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.\s?/g, ".").replace(/\.$/, "");
const safeId = id => /^[\w-]{1,64}$/.test(String(id)) ? String(id) : null;

/* ---------- index.html 에서 설정과 공지 읽기 ---------- */
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const constStr = name => { const m = INDEX.match(new RegExp(`const ${name} = "([^"]*)";`)); return m ? m[1] : ""; };
const SUPABASE_URL = process.env.SUPABASE_URL || constStr("SUPABASE_URL");
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || constStr("SUPABASE_ANON_KEY");
const GA_ID = constStr("GA_MEASUREMENT_ID");

function readNotice(name) {
  const start = INDEX.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`index.html 에서 ${name} 을 찾지 못했습니다`);
  const end = INDEX.indexOf("\n};", start);
  const literal = INDEX.slice(start + `const ${name} = `.length, end + 2);
  return new Function(`return (${literal});`)(); // 이 저장소의 index.html 만 읽는다
}

async function loadPosts() {
  if (POSTS_JSON) return JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/posts`;
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const q = cols => `${base}?select=${cols}&visibility=eq.public&order=created_at.desc&limit=1000`;
  let res = await fetch(q("id,title,body,category,summary,visibility,created_at,updated_at,attachments"), { headers });
  if (res.status === 400) res = await fetch(q("id,title,body,category,visibility,created_at,updated_at,attachments"), { headers }); // summary 칸이 아직 없을 때
  if (!res.ok) throw new Error(`Supabase 에서 글을 읽지 못했습니다: ${res.status}`);
  return res.json();
}

const imgVersion = p => (Date.parse(p.updated_at || p.created_at) || 0).toString(36) + CARD_DESIGN;
const describe = p => {
  const s = (p.summary || "").trim();
  if (s) return s.slice(0, 160);
  const flat = String(p.body || "").replace(/\s+/g, " ").trim();
  return flat.length > DESC_MAX ? flat.slice(0, DESC_MAX).trim() + "…" : flat;
};

/* ---------- AI 3줄 요약 (scripts/ai-assist.js 가 만든 파일) ----------
 * 글을 고친 뒤 AI 를 아직 다시 돌리지 않았으면 예전 요약이 틀릴 수 있으므로 넣지 않는다(hash 비교). */
const aiHash = p => crypto.createHash("sha256").update(`${p.title}\n${p.body}`).digest("hex").slice(0, 16);
function loadAi(p) {
  const id = safeId(p.id);
  if (!id || p.notice) return null;
  try {
    const ai = JSON.parse(fs.readFileSync(path.join(OUT, "ai", `${id}.json`), "utf8"));
    if (ai.hash !== aiHash(p) || !Array.isArray(ai.summary) || !ai.summary.length) return null;
    return ai;
  } catch (e) { return null; }
}
function aiBox(ai) {
  if (!ai) return "";
  const who = ai.mode === "mock" ? "시연용 가짜 AI 가 만든 요약입니다." : "AI 가 만든 요약입니다.";
  return `<aside class="ai" aria-label="AI 3줄 요약">
    <div class="ai-h">AI 3줄 요약</div>
    <ol>${ai.summary.slice(0, 3).map(l => `<li>${esc(l)}</li>`).join("")}</ol>
    <p class="ai-note">${who} 틀릴 수 있으니 본문을 꼭 확인하세요.</p>
  </aside>`;
}

/* ---------- 글 페이지 HTML ---------- */
function postPage(p, ai = null) {
  const id = safeId(p.id);
  const url = `${SITE_URL}p/${id}/`;
  // 카카오톡 등은 썸네일을 주소 기준으로 기억한다. 글을 고치면 주소 끝 ?v= 가 바뀌어 새 그림을 다시 가져간다
  const img = `${SITE_URL}p/${id}/og.png?v=${imgVersion(p)}`;
  const title = `${p.title} · ${SITE_NAME}`;
  const desc = describe(p);
  const ld = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: desc, image: img, url, mainEntityOfPage: url,
    datePublished: p.created_at, dateModified: p.updated_at || p.created_at,
    articleSection: p.category, inLanguage: "ko-KR",
    author: { "@type": "Organization", name: SITE_NAME }, publisher: { "@type": "Organization", name: SITE_NAME }
  };
  // GA: 블로그 화면(index.html)과 같은 이름, 같은 값으로 보낸다. 주소가 같아(p/글번호/) GA 보고서에서 한 줄로 모인다.
  // 이메일, 댓글 같은 개인정보는 이 페이지에 없으므로 보내지 않는다. 이벤트 규칙은 docs/ANALYTICS.md
  const gaPost = { post_id: String(id), post_title: String(p.title).slice(0, 100), post_category: String(p.notice ? "공지" : p.category).slice(0, 100),
    is_notice: !!p.notice, attachment_count: Array.isArray(p.attachments) ? p.attachments.length : 0, view_source: "static", has_ai_summary: !!ai };
  const ga = GA_ID ? `
<script>
  (function () {
    var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if (ls("samsaekpen-ga-optout") === "1") { window["ga-disable-${GA_ID}"] = true; return; }
    var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}"; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    var post = ${JSON.stringify(gaPost).replace(/</g, "\\u003c")};
    gtag("js", new Date());
    if (ls("samsaekpen-ga-internal") === "1") gtag("set", { traffic_type: "internal" });
    gtag("config", "${GA_ID}", { page_type: post.is_notice ? "notice" : "post", view_source: "static" });
    gtag("event", "post_view", post);
  })();
</script>` : "";
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../../assets/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" href="../../assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="../../assets/apple-touch-icon.png">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.title)}">
<meta property="article:published_time" content="${esc(p.created_at)}">
<meta property="article:modified_time" content="${esc(p.updated_at || p.created_at)}">
<meta property="article:section" content="${esc(p.category)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@700;900&family=IBM+Plex+Sans+KR:wght@400;700&display=swap">
<style>
:root{--bg:#FFFFF0;--fg:#2B2622;--muted:#6B6760;--line:#C1C5C6;--red:#E5584B;--orange:#2F3E63;--orange-fill:#2F3E63;--mint-fill:#E6E8DF;--on-orange:#FFFFF0}
@media (prefers-color-scheme: dark){:root{--bg:#353839;--fg:#FFFFFF;--muted:#C2C3C4;--line:#5D6468;--red:#C2185B;--orange:#D5E8F5;--orange-fill:#D5E8F5;--mint-fill:#4D5255;--on-orange:#353839;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:17px;line-height:1.85;word-break:keep-all;overflow-wrap:break-word}
a{color:inherit}
.wrap{max-width:760px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header{border-bottom:2px solid var(--fg)}
header .wrap{display:flex;align-items:center;min-height:64px}
.logo{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:"Gothic A1",sans-serif;font-weight:900;font-size:22px}
.logo img{display:block;height:30px;width:auto}
article{padding-block:40px 64px}
.cat{font-size:14px;font-weight:700;color:var(--orange)}
h1{font-family:"Gothic A1",sans-serif;font-weight:900;font-size:clamp(28px,5vw,42px);line-height:1.3;letter-spacing:-.02em;margin:8px 0 12px}
.meta{font-size:14px;color:var(--muted);padding-bottom:18px;border-bottom:1px solid var(--line)}
.body{white-space:pre-wrap;margin:24px 0 0}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:40px;padding-top:24px;border-top:2px solid var(--fg)}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;font-weight:700;text-decoration:none;border:2px solid var(--fg)}
.btn.main{background:var(--orange-fill);color:var(--on-orange);border-color:var(--orange-fill)}
.demo-note{flex-basis:100%;margin:0;font-size:14px;color:var(--muted)}
a:focus-visible{outline:3px solid var(--orange);outline-offset:3px}
.ai{margin:24px 0 0;padding:16px 18px;background:var(--mint-fill);border-left:6px solid var(--orange-fill)}
.ai-h{font-family:"Gothic A1",sans-serif;font-weight:900;font-size:15px}
.ai ol{margin:8px 0 0;padding-left:22px}
.ai-note{margin:8px 0 0;font-size:13px;color:var(--muted)}
</style>${ga}
</head>
<body>
<header><div class="wrap"><a class="logo" href="../../"><img src="../../assets/logo.png" alt="" width="198" height="265">${SITE_NAME}</a></div></header>
<main class="wrap">
<article>
  <div class="cat">${esc(p.notice ? "공지" : p.category)}</div>
  <h1>${esc(p.title)}</h1>
  <div class="meta">${esc(kstDate(p.created_at))} (KST)${p.updated_at ? ` · 수정 ${esc(kstDate(p.updated_at))}` : ""}</div>
  ${aiBox(ai)}
  <div class="body">${esc(p.body)}</div>
  <div class="cta">
    ${p.demo ? `<p class="demo-note">시연용 글이라 댓글은 달 수 없어요. 블로그 첫 화면에서 다른 글을 볼 수 있어요.</p>` : `<a class="btn main" href="../../#post-${esc(id)}">블로그에서 보고 댓글 달기</a>`}
    <a class="btn" href="../../">${SITE_NAME} 첫 화면</a>
  </div>
</article>
</main>
</body>
</html>
`;
}

/* ---------- 썸네일 카드 (1200×630) ----------
 * 글마다 다르게: 제목 + 본문 앞 세 줄(점 색: 강조, 문양, 선) + 날짜.
 * 글에 사진(JPG, PNG, GIF)이 첨부돼 있으면 첫 사진을 오른쪽에 넣는다.
 */
const CARD_DESIGN = "c6"; // 카드 디자인을 바꾸면 이 값을 바꾼다. 썸네일 주소의 ?v= 가 바뀌어 카카오톡이 새로 가져간다
const LINE_MAX = 60;
// 사진이 있으면 세 줄(두 줄까지 줄바꿈), 없으면 네 줄
async function cardContent(p) { const image = await thumbImage(p); return { image, lines: excerptLines(p, image ? 3 : 4) }; }
function excerptLines(p, n = 3) {
  const lines = String(p.body || "").split(/\n+/).map(l => l.replace(/\s+/g, " ").trim()).filter(l => l && l !== p.title);
  const s = String(p.summary || "").trim();
  return (s ? [s, ...lines] : lines).slice(0, n).map(l => l.length > LINE_MAX ? l.slice(0, LINE_MAX).trim() + "…" : l);
}

function cardHtml({ title, label, isNotice, date, lines = [], image, fontCss }) {
  const withImg = !!image;
  const tSize = title.length > (withImg ? 22 : 30) ? 54 : 64;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontCss || ""}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px}
body{background:#FFFFF0;color:#2B2622;font-family:"Noto Sans KR","Noto Sans CJK KR","Apple SD Gothic Neo",sans-serif;position:relative;overflow:hidden;display:flex;gap:44px;padding:52px 64px 66px}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:14px;font-size:32px;font-weight:900;letter-spacing:-.01em}
.brand img{display:block;height:56px;width:auto}
.label{font-size:24px;font-weight:700;color:#2F3E63;white-space:nowrap}
.label.notice{color:#2B2622;background:#E5584B;padding:2px 14px}
h1{margin-top:34px;font-size:${tSize}px;line-height:1.2;font-weight:900;letter-spacing:-.025em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;padding-bottom:22px;border-bottom:3px solid #2B2622}
ul{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:12px}
li{display:flex;gap:16px;align-items:flex-start;font-size:${withImg ? 26 : 30}px;line-height:1.45;color:#2B2622}
li i{flex:none;width:14px;height:14px;margin-top:${withImg ? 12 : 14}px}
li span{display:-webkit-box;-webkit-line-clamp:${withImg ? 2 : 1};-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
li:nth-child(1) i{background:#E5584B}li:nth-child(2) i{background:#2F3E63}li:nth-child(3) i{background:#C1C5C6}li:nth-child(4) i{background:#2B2622}
.foot{margin-top:auto;display:flex;justify-content:space-between;font-size:22px;color:#6B6760}
.pic{flex:none;width:400px;height:100%;border:3px solid #2B2622;background:#F3F3E8 center/cover no-repeat}
.bars{position:absolute;left:0;right:0;bottom:0;height:14px;display:flex}.bars i{flex:1}
</style></head><body>
<div class="main">
  <div class="top"><div class="brand"><img src="${LOGO_URI}" alt="">${SITE_NAME}</div><span class="label${isNotice ? " notice" : ""}">${esc(label)}</span></div>
  <h1>${esc(title)}</h1>
  <ul>${lines.map(l => `<li><i></i><span>${esc(l)}</span></li>`).join("")}</ul>
  <div class="foot"><span>${esc(date || "AIPM 복습 노트")}</span><span>mopnt135.github.io/test-261117</span></div>
</div>
${withImg ? `<div class="pic" style="background-image:url('${image}')"></div>` : ""}
<div class="bars"><i style="background:#E5584B"></i><i style="background:#2F3E63"></i><i style="background:#2B2622"></i></div>
</body></html>`;
}

/* 첨부 사진 가져오기. 형식은 파일 앞부분(서명)으로 다시 확인하고, 아니면 사진 없이 그린다 */
const IMG_MAX = 8 * 1024 * 1024;
const sniff = b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 ? "image/png"
  : b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF ? "image/jpeg"
  : b.slice(0, 4).toString("latin1") === "GIF8" ? "image/gif" : null;
async function thumbImage(p) {
  const a = (Array.isArray(p.attachments) ? p.attachments : []).find(x => x && /^image\/(png|jpeg|gif)$/.test(x.type) && typeof x.path === "string");
  if (!a) return null;
  let buf = null;
  try {
    if (ATT_DIR) {
      const file = path.resolve(ATT_DIR, a.path);
      if (!file.startsWith(path.resolve(ATT_DIR) + path.sep)) return null;
      buf = fs.readFileSync(file);
    } else if (SUPABASE_URL && SUPABASE_KEY) {
      const base = SUPABASE_URL.replace(/\/$/, "") + "/storage/v1";
      const key = a.path.split("/").map(encodeURIComponent).join("/");
      const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
      const r = await fetch(`${base}/object/sign/attachments/${key}`, { method: "POST", headers, body: JSON.stringify({ expiresIn: 120 }) });
      if (!r.ok) return null;
      const { signedURL } = await r.json();
      const img = await fetch(base + signedURL);
      if (!img.ok) return null;
      buf = Buffer.from(await img.arrayBuffer());
    }
  } catch (e) { console.error(`${p.id}번 글 사진을 가져오지 못해 사진 없이 그립니다: ${e.message}`); return null; }
  if (!buf || buf.length > IMG_MAX) return null;
  const type = sniff(buf);
  return type ? `data:${type};base64,${buf.toString("base64")}` : null;
}

function fontCssFromEnv() {
  const p = process.env.OG_FONT_CSS;
  if (!p) return "";
  const dir = path.dirname(path.resolve(p));
  return fs.readFileSync(p, "utf8").replace(/url\(([^)]+)\)/g, (m, u) => /^(https?:|file:|data:)/.test(u) ? m : `url(file://${path.join(dir, u.replace(/^["']|["']$/g, ""))})`);
}

async function drawCards(cards) {
  if (NO_IMAGES || !cards.length) return;
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route(/^https?:/, r => r.abort()); // 카드 안에서는 바깥 주소를 불러오지 않는다
  const fontCss = fontCssFromEnv();
  for (const c of cards) {
    await page.setContent(cardHtml({ ...c, fontCss }), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: c.file, type: "png" });
  }
  await browser.close();
}

/* ---------- 홈 카드, sitemap, robots ---------- */
function sitemap(entries) {
  const rows = [{ loc: SITE_URL, lastmod: null }, ...entries].map(e =>
    `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod.slice(0, 10))}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
const robots = () => `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`;

async function main() {
  const notices = [readNotice("NOTICE_RULES"), readNotice("NOTICE")];
  const fetched = (await loadPosts()).filter(p => p.visibility === undefined || p.visibility === "public");
  const all = [...notices, ...fetched].filter(p => safeId(p.id) && p.title && p.body && p.created_at);

  const pDir = path.join(OUT, "p");
  fs.mkdirSync(pDir, { recursive: true });
  const keep = new Set(all.map(p => safeId(p.id)));
  const removed = [];
  for (const d of fs.readdirSync(pDir)) {
    if (!keep.has(d) && fs.statSync(path.join(pDir, d)).isDirectory()) { fs.rmSync(path.join(pDir, d), { recursive: true, force: true }); removed.push(d); }
  }

  const cards = [];
  for (const p of all) {
    const dir = path.join(pDir, safeId(p.id));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), postPage(p, loadAi(p)));
    if (!NO_IMAGES) cards.push({ file: path.join(dir, "og.png"), title: p.title, label: p.notice ? "공지" : p.category, isNotice: !!p.notice,
      date: `${kstDate(p.created_at)} · AIPM 복습 노트`, ...await cardContent(p) });
  }
  fs.mkdirSync(path.join(OUT, "og"), { recursive: true });
  cards.push({ file: path.join(OUT, "og", "site.png"), title: "AIPM 수업 복습 노트", label: "블로그", isNotice: false,
    lines: ["AIPM 수업을 들으며 생각한 것과 만든 것을 기록합니다", "수업 복습 노트를 한곳에 모았습니다", "THINK & MAKE"] });
  await drawCards(cards);

  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap(all.map(p => ({ loc: `${SITE_URL}p/${safeId(p.id)}/`, lastmod: p.updated_at || p.created_at }))));
  fs.writeFileSync(path.join(OUT, "robots.txt"), robots());

  console.log(`글 페이지 ${all.length}개 (공지 ${notices.length}, 공개글 ${all.length - notices.length})${NO_IMAGES ? ", 썸네일 생략" : `, 썸네일 ${cards.length}장`}${removed.length ? `, 지운 페이지 ${removed.join(", ")}` : ""}`);
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { describe, postPage, cardHtml, excerptLines, imgVersion, thumbImage, aiBox, aiHash };
