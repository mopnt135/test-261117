// CLAUDE.md 와 AGENTS.md 가 같은 규칙인지 확인하는 테스트.
// 두 파일은 제목 줄과 "더 읽을 문서" 표의 서로를 가리키는 한 줄만 다르다.
// 실행: node tests/docs_test.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");

let pass = 0, fail = 0;
function check(id, name, ok, detail) {
  if (ok) { pass++; console.log(`  ok  ${id} ${name}`); }
  else { fail++; console.log(`  FAIL ${id} ${name}${detail ? "\n       " + detail : ""}`); }
}

const claude = read("CLAUDE.md");
const agents = read("AGENTS.md");

// 서로 다른 것이 허락된 줄: 제목 줄, 상대 파일을 가리키는 표의 한 줄
const ROW_IN_CLAUDE = "| `AGENTS.md` |";
const ROW_IN_AGENTS = "| `CLAUDE.md` |";

check("D1", "CLAUDE.md 제목은 '# CLAUDE.md'", claude.startsWith("# CLAUDE.md\n"));
check("D2", "AGENTS.md 제목은 '# AGENTS.md'", agents.startsWith("# AGENTS.md\n"));
check("D3", "CLAUDE.md 표에 AGENTS.md 줄이 1개", claude.split("\n").filter((l) => l.startsWith(ROW_IN_CLAUDE)).length === 1);
check("D4", "AGENTS.md 표에 CLAUDE.md 줄이 1개", agents.split("\n").filter((l) => l.startsWith(ROW_IN_AGENTS)).length === 1);

const SYNC = "한쪽을 고치면 다른 쪽도 똑같이 고친다";
check("D5", "두 파일 모두 '같이 고친다' 안내가 있다", claude.includes(SYNC) && agents.includes(SYNC));

// 허락된 줄을 같은 표시로 바꾼 뒤 나머지가 한 글자도 다르지 않은지 본다
const norm = (text, row) =>
  text.split("\n").slice(1).map((l) => (l.startsWith(row) ? "<상대 파일 줄>" : l));
const a = norm(claude, ROW_IN_CLAUDE);
const b = norm(agents, ROW_IN_AGENTS);
let firstDiff = -1;
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) { firstDiff = i; break; }
}
check(
  "D6",
  "나머지 내용이 똑같다",
  firstDiff === -1,
  firstDiff === -1 ? "" :
    `${firstDiff + 2}번째 줄이 다릅니다. 한쪽만 고친 것 같아요. 두 파일을 똑같이 맞춰 주세요.\n` +
    `       CLAUDE.md: ${JSON.stringify(a[firstDiff] ?? "(줄 없음)")}\n` +
    `       AGENTS.md: ${JSON.stringify(b[firstDiff] ?? "(줄 없음)")}`
);

console.log(`\n문서 테스트: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
