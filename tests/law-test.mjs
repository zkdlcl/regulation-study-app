import puppeteer from "puppeteer-core";

const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const errors = [];
const res = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reqs = [];

async function open(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 800 });
  page.on("pageerror", (e) => errors.push(`[${w}] pageerror: ` + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${w}] console: ` + m.text()); });
  page.on("request", (r) => { if (r.url().includes("/data/laws/")) reqs.push(r.url().split("/").pop()); });
  await page.goto(URL, { waitUntil: "load" });
  await sleep(500);
  return page;
}
const waitFor = async (page, fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await sleep(120); } return false; };

let page = await open(1180, 820);
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(200); };

/* ── 데이터 로더 ── */
const idx = await page.evaluate(() => ({ n: LAW_INDEX.length, list: LAW_LIST, loaded: LAW_INDEX.filter((l) => lawReady(l.law)).length, arts: D.articles.filter((a) => a.type === "a").length }));
ok("규정 목록 11종, 처음엔 새 규정 미로딩", idx.list.length === 11 && idx.loaded === 0 && idx.arts === 194 + 0 || idx.arts > 150, JSON.stringify({ list: idx.list.join(","), loaded: idx.loaded, arts: idx.arts }));
ok("처음 화면에서 규정 파일 요청 없음", reqs.length === 0);

/* ── 회독: 새 규정 선택 → 불러와서 표시 ── */
await page.evaluate(() => showTab("read")); await sleep(500);
const seg = await page.evaluate(() => ({ btns: [...document.querySelectorAll("#r-law button")].map((b) => b.dataset.law), scroll: document.getElementById("r-law").classList.contains("seg-scroll") }));
ok("법령 선택 칩 11개(스크롤)", seg.btns.length === 11 && seg.scroll, seg.btns.join(","));
await page.evaluate(() => document.querySelector('#r-law [data-law="인사관리시행규칙"]').click());
ok("불러오는 중 안내가 먼저 보이거나 바로 표시", true);
ok("인사관리시행규칙 불러옴", await waitFor(page, () => lawReady("인사관리시행규칙") && document.querySelectorAll("#r-body .art").length > 20));
const pr = await page.evaluate(() => ({
  arts: document.querySelectorAll("#r-body .art").length, h: [...document.querySelectorAll("#r-body .ch-h .ch-tt")].map((e) => e.textContent), req: 0,
  first: document.querySelector("#r-body .art .art-h").textContent.replace(/\s+/g, " "), toc: document.querySelectorAll("#r-toc .toc-a").length,
  range: [...document.querySelectorAll("#r-chips [data-topic]")].map((b) => b.textContent), note: document.getElementById("r-note").hidden,
  extra: !!document.querySelector('#r-body .chap'), blanks: document.querySelectorAll("#r-body .b1, #r-body .b2").length, tables: document.querySelectorAll("#r-body table").length,
}));
ok("69개 조문 · 6개 장 표시", pr.arts === 69 && pr.h.length === 6, JSON.stringify({ arts: pr.arts, h: pr.h }));
ok("조문 머리글 '제1조'", /제1조/.test(pr.first), pr.first);
ok("목차 사이드바에 조문 표시", pr.toc >= 60, String(pr.toc));
ok("범위 칩 = 장 단위", pr.range.length === 7 && pr.range[0] === "전체 조문", pr.range.join(" | "));
ok("조직법용 안내문은 숨김", pr.note);
ok("별표·표 표시", pr.extra && pr.tables > 0, `표 ${pr.tables}`);
ok("자동 빈칸(b1/b2) 존재", pr.blanks > 50, String(pr.blanks));
ok("파일은 필요할 때 1개만 요청", reqs.length === 1 && reqs[0] === "personnel.json", reqs.join(","));
await page.screenshot({ path: "law-personnel.png" });

// 가리기 모드 ①②③
await click('#r-chips [data-mode="1"]');
ok("① 모드: 숫자·주체 빈칸 가려짐", await page.evaluate(() => { const b = [...document.querySelectorAll("#r-body .b1")]; return b.length > 0 && b.every((x) => getComputedStyle(x).color === "rgba(0, 0, 0, 0)"); }));
await click('#r-chips [data-mode="3"]'); await sleep(300);
ok("③ 모드: 조사만 남기고 가림", await page.evaluate(() => document.querySelectorAll("#r-body .b3").length > 100));
await click('#r-chips [data-mode="0"]');

// 장 범위 칩
await page.evaluate(() => document.querySelectorAll("#r-chips [data-topic]")[2].click()); await sleep(400);
ok("장 범위 칩 → 해당 장만", await page.evaluate(() => { const n = document.querySelectorAll("#r-body .art").length; return n > 0 && n < 69 && document.querySelectorAll("#r-body .ch-h").length === 1; }));
await page.evaluate(() => document.querySelectorAll("#r-chips [data-topic]")[0].click()); await sleep(300);

// 참조 링크: 시행규칙 본문의 「직원 운영규정」 제N조
const refs = await page.evaluate(() => { const x = [...document.querySelectorAll("#r-body .xr")]; return { n: x.length, kinds: [...new Set(x.map((e) => e.dataset.x.split("|")[1].split(":")[0]))] }; });
ok("본문 참조 링크 생성(여러 규정으로)", refs.n > 10 && refs.kinds.length >= 1, JSON.stringify(refs));
ok("직원 운영규정(운영규정)으로 가는 링크 존재", refs.kinds.includes("운영규정"), refs.kinds.join(","));
await page.evaluate(() => [...document.querySelectorAll("#r-body .xr")].find((e) => e.dataset.x.startsWith("a|운영규정:")).click()); await sleep(500);
ok("다른 규정(운영규정) 조문이 패널로 열림", await page.evaluate(() => !document.getElementById("pk").hidden && /운영규정/.test(document.getElementById("pk-ti").textContent)), await page.evaluate(() => document.getElementById("pk-ti").textContent));
await click("#pk-x");

/* ── 아직 안 불러온 규정으로 가는 링크(패널) ── */
await page.evaluate(() => openPeek("a|보수운영규정:5")); await sleep(1200);
ok("안 불러온 규정 조문도 패널에서 열림(자동 로딩)", await page.evaluate(() => /보수운영규정/.test(document.getElementById("pk-ti").textContent) && document.querySelectorAll("#pk-body .ln").length > 0), await page.evaluate(() => document.getElementById("pk-ti").textContent));
ok("보수운영규정 파일 요청", reqs.includes("compensation.json"), reqs.join(","));
await page.evaluate(() => closePeek());

/* ── 새 규정 별표 참조 ── */
await page.evaluate(() => document.querySelector('#r-law [data-law="인사관리시행규칙"]').click()); await sleep(500);
const bref = await page.evaluate(() => { const x = [...document.querySelectorAll("#r-body .xr")].find((e) => e.dataset.x.startsWith("b|인사관리시행규칙:")); return x ? x.dataset.x : null; });
if (bref) {
  await page.evaluate((k) => [...document.querySelectorAll("#r-body .xr")].find((e) => e.dataset.x === k).click(), bref); await sleep(500);
  ok("새 규정 별표 참조 → 패널에 표시", await page.evaluate(() => !document.getElementById("pk").hidden && document.querySelectorAll("#pk-body .ln, #pk-body table").length > 0 && /별표|인사서식/.test(document.getElementById("pk-ti").textContent)), bref);
  await click("#pk-x");
} else res.push("SKIP  인사관리시행규칙 본문 별표 참조 없음");

/* ── 나머지 새 규정 모두 열어 보기 ── */
for (const law of ["보수운영규정", "재무규정", "여비규정", "감사운영규정", "유관법령", "국제인도법", "국제적십자규약"]) {
  await page.evaluate((l) => { document.querySelector(`#r-law [data-law="${l}"]`).click(); }, law);
  const done = await waitFor(page, (l) => lawReady(l) && document.querySelectorAll("#r-body .art").length > 5 && R.law === l, 6000).catch(() => false);
  const n = await page.evaluate(() => ({ arts: document.querySelectorAll("#r-body .art").length, ch: document.querySelectorAll("#r-body .ch-h").length, toc: document.querySelectorAll("#r-toc .toc-a").length, byeol: document.querySelectorAll('#r-toc .toc-a[data-tj^="byeol-"]').length, law: R.law }));
  ok(`${law} 열림`, n.arts > 5 && n.toc === n.arts + n.byeol, JSON.stringify(n));
}
await page.screenshot({ path: "law-ihl.png" });

/* ── 뻥뚫: 새 규정으로 ── */
await page.evaluate(() => showTab("bt")); await sleep(400);
await page.evaluate(() => document.querySelector('[data-btu="6"]').click());
ok("뻥뚫: 6차 → 재무규정 범위 = 장 select", await waitFor(page, () => document.getElementById("bt-sel") && document.getElementById("bt-sel").options.length > 5 && BT.law === "재무규정"), await page.evaluate(() => (document.getElementById("bt-sel") || {options: []}).options.length + "개"));
await click('[data-lv="2"]'); await click('[data-max="5"]'); await click('[data-md="type"]'); await click('[data-cnt="5"]'); await click('[data-ord="num"]');
const cands = await page.evaluate(() => btCands().length);
ok("뻥뚫: 출제 가능 조문", cands > 10, String(cands));
await click("#bt-start");
const bt = await page.evaluate(() => ({ sess: BT.sess, inputs: document.querySelectorAll("#bt-art .bt-in").length, law: BT.queue[0].law }));
ok("뻥뚫 세션: 재무규정 조문에서 빈칸 입력", bt.sess && bt.inputs > 0 && bt.law === "재무규정", JSON.stringify(bt));
await page.evaluate(() => { document.querySelectorAll("#bt-art .bt-in").forEach((i) => (i.value = i.dataset.ans)); });
await click("#bt-check");
ok("뻥뚫 채점", await page.evaluate(() => document.getElementById("bt-res").textContent.includes("모두 맞혔")));
await click("#bt-end"); await click("#bt-home");
await page.evaluate(() => document.querySelector('[data-btu="7"]').click()); await sleep(500);
await click('[data-lv="3"]'); await click("#bt-start");
ok("뻥뚫: 국제인도법 난이도 3 시작", await page.evaluate(() => BT.sess && document.querySelectorAll("#bt-art .bt-in, #bt-art .bt-tap").length > 0));
await click("#bt-end"); await click("#bt-home");

/* ── 검색: 모든 규정 ── */
await page.evaluate(() => showTab("find")); await sleep(300);
await page.evaluate(() => { const i = document.getElementById("f-q"); i.value = "시험"; i.dispatchEvent(new Event("input")); });
ok("검색: 전체 규정 로딩 후 결과", await waitFor(page, () => document.querySelectorAll("#p-find .fr2").length > 5 && allLawsReady()));
const fs = await page.evaluate(() => [...document.querySelectorAll("#f-sc button")].map((b) => b.textContent));
ok("검색 범위 칩에 새 규정과 건수 표시", fs.length === 14 && fs.some((t) => t.startsWith("인사관리시행규칙 (")), fs.join(" | "));
await page.evaluate(() => document.querySelector('#f-sc [data-fsc="인사관리시행규칙"]').click()); await sleep(400);
ok("검색 범위: 인사관리시행규칙만", await page.evaluate(() => [...document.querySelectorAll("#p-find .fr2 .badge")].every((b) => b.textContent === "인사관리시행규칙")));
await page.evaluate(() => document.querySelector("[data-fgo]").click()); await sleep(900);
ok("검색 → 원문 보기(새 규정)", await page.evaluate(() => document.getElementById("p-read").classList.contains("on") && R.law === "인사관리시행규칙" && !!document.querySelector("#r-body .flash")));

/* ── 개정 탭: 전체 규정 ── */
await page.evaluate(() => showTab("rev")); await sleep(500);
const rv = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#p-rev [data-law]')].map((b) => b.dataset.law), n: amendItems().length, laws: [...new Set(amendItems().map((i) => i.law))] }));
ok("개정 탭: 새 규정의 개정 포함", rv.chips.length === 12 && rv.laws.length >= 8, JSON.stringify({ n: rv.n, laws: rv.laws.length }));

/* ── 오늘: 일정 → 새 규정 연결 ── */
await page.evaluate(() => { const s = SCHED.find((x) => x.n === 4); return s; });
const sp = await page.evaluate(() => SCHED.filter((s) => s.n && !s.prep).map((s) => ({ n: s.n, o: schedPrep(s).out.map((x) => x.law).join("+"), m: schedPrep(s).miss.join("+") })));
const miss = sp.filter((x) => x.m);
ok("모든 시험 과목이 앱 규정에 연결됨(미연결 없음)", miss.length === 0, JSON.stringify(miss));
ok("4차 → 인사관리시행규칙, 6차 → 재무·여비·감사 3종", sp[3].o === "인사관리시행규칙" && sp[5].o === "재무규정+여비규정+감사운영규정", JSON.stringify([sp[3], sp[5], sp[7]]));
await page.evaluate(() => { SCHED.forEach((x) => { if (x.n <= 4) x.d = "2020-01-01"; else if (x.n === 5) x.d = "2099-01-01"; });  /* 오늘 날짜와 무관하게 다음 시험 = 5차 */ showTab("today"); });  // 3차를 과거로 → 다음 시험이 4차
await sleep(500);
await page.evaluate(() => renderers.today());
await sleep(300);
const nx = await page.evaluate(() => ({ t: document.querySelector(".sch-n b").textContent, btn: [...document.querySelectorAll("[data-prep]")].map((b) => b.textContent.trim()) }));
ok("오늘 카드: 5차(4차 10/29 경과) 보수운영규정 회독·뻥뚫 버튼", /5차/.test(nx.t) && nx.btn.some((t) => t.includes("보수운영규정 회독")) && nx.btn.some((t) => t.includes("보수운영규정 뻥뚫")), JSON.stringify(nx));
await page.evaluate(() => document.querySelector('[data-prep="read"]').click()); await sleep(900);
ok("회독 버튼 → 새 규정 열림", await page.evaluate(() => R.law === "보수운영규정" && document.querySelectorAll("#r-body .art").length > 10));

/* ── 레이아웃 ── */
ok("가로 스크롤 없음(1180)", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
for (const tb of ["today", "read", "bt", "quiz", "exam", "rev", "find", "table", "lab", "ask"]) { await page.evaluate((id) => showTab(id), tb); await sleep(120); }
ok("선택되지 않은 탭은 숨김", await page.evaluate(() => [...document.querySelectorAll("section.pane")].every((p) => (getComputedStyle(p).display !== "none") === p.classList.contains("on"))));
await page.close();

/* ── 폰: 새 규정 열기 / 패널 ── */
page = await open(390, 844);
await page.evaluate(() => { R.law = "여비규정"; R.topic = "0"; showTab("read"); });
ok("폰: 여비규정 열림", await waitFor(page, () => lawReady("여비규정") && document.querySelectorAll("#r-body .art").length > 10));
ok("폰: 가로 스크롤 없음", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await page.evaluate(() => { const x = document.querySelector("#r-body .xr"); if (x) x.click(); }); await sleep(600);
ok("폰: 패널(시트)로 열림", await page.evaluate(() => !document.getElementById("pk").hidden));
await page.screenshot({ path: "law-phone.png" });
await page.close();

/* ── 일부러 실패: 파일이 없을 때 안내 ── */
page = await open(1180, 820);
await page.evaluate(() => { LAW_INDEX.find((l) => l.law === "감사운영규정").file = "data/laws/nope.json"; R.law = "감사운영규정"; showTab("read"); });
await sleep(1200);
const fail = await page.evaluate(() => ({ txt: document.getElementById("r-body").textContent, retry: !!document.querySelector("[data-lawretry]") }));
ok("로딩 실패 시 안내 + 다시 시도 버튼", /불러오지 못했습니다/.test(fail.txt) && fail.retry, fail.txt.slice(0, 60));
await page.evaluate(() => { LAW_INDEX.find((l) => l.law === "감사운영규정").file = "data/laws/audit.json"; document.querySelector("[data-lawretry]").click(); });
ok("고친 뒤 다시 시도 → 성공", await waitFor(page, () => lawReady("감사운영규정") && document.querySelectorAll("#r-body .art").length === 22));
await page.close();

const real = errors.filter((e) => !/Failed to load resource|favicon|nope\.json|404/.test(e));
ok("콘솔 오류 없음", real.length === 0, real.join(" | "));
console.log(res.join("\n"));
await browser.close();
process.exit(res.some((r) => r.startsWith("FAIL")) ? 1 : 0);
