import puppeteer from "puppeteer-core";

const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const errors = [];
const res = [];
const reqs = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (page, fn, arg, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(100); } return false; };

async function open(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 800 });
  page.on("pageerror", (e) => errors.push(`[${w}] pageerror: ` + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${w}] console: ` + m.text()); });
  page.on("request", (r) => { if (r.url().includes("/data/quiz/")) reqs.push(r.url().split("/").pop()); });
  await page.goto(URL, { waitUntil: "load" });
  await sleep(500);
  return page;
}

let page = await open(1180, 820);
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(250); };

/* ── 첫 화면 ── */
await page.evaluate(() => showTab("exam")); await sleep(400);
const h = await page.evaluate(() => ({
  hs: [...document.querySelectorAll("#p-exam h3")].map((e) => e.textContent.replace(/\s+/g, " ").trim().slice(0, 28)),
  law: document.querySelectorAll("[data-xlaw]").length, lawDis: [...document.querySelectorAll("[data-xlaw]")].filter((b) => b.disabled).map((b) => b.dataset.xlaw),
  past: QINDEX.filter((g) => g.kind === "past").length, sen: document.querySelectorAll("#x-sen .pk").length, local: document.querySelectorAll("#p-exam .pk-grid")[3].querySelectorAll(".pk").length,
  chips: [...document.querySelectorAll("[data-xlim]")].map((b) => b.textContent), qi: QINDEX.length, notes: document.querySelectorAll("#p-exam > p.small.mute").length,
}));
ok("섹션 구성(오답노트·법령별·기출 2종)", h.hs.length === 4, h.hs.join(" | "));
ok("법령별 모아 풀기 11개(유관법령 등 문제 없는 것은 비활성)", h.law === 11, `비활성: ${h.lawDis.join(",")}`);
ok("스터디 묶음 98개", h.sen === 98 && h.qi === 110, `${h.sen}/${h.qi}`);
ok("원문 복원본 7묶음(스터디 1~5주차 + 사례형 + 2026) 유지", h.local === 7, String(h.local));
ok("모아 풀기 문제 수 칩", h.chips.length === 4, h.chips.join(","));
ok("처음엔 문제 파일 요청 없음", reqs.length === 0);
ok("가로 스크롤 없음", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await page.screenshot({ path: "quiz-home.png" });

/* ── 기출 묶음 풀기 ── */
await click('[data-xstart="past-01"]');
ok("묶음 파일 1개만 요청", await waitFor(page, () => X.sess && X.queue.length > 0), null) && ok("요청: past-01.json", reqs.length === 1 && reqs[0] === "past-01.json", reqs.join(","));
const s1 = await page.evaluate(() => ({ n: X.queue.length, label: document.querySelector("#p-exam .mute.small").textContent, choices: document.querySelectorAll("[data-xc]").length, q: document.querySelector(".xq").textContent.slice(0, 40), first: X.queue[0].id }));
ok("26문제 시작, 묶음 이름이 라벨에", s1.n === 26 && /2018년 4급 기출/.test(s1.label) && s1.choices >= 4, JSON.stringify({ n: s1.n, label: s1.label }));
// 정답 선택 → 채점
const ans1 = await page.evaluate(() => { const q = X.queue[0]; return q.kind === "ox" ? q.a : (q.a.match(/[①-⑥]/g) || [])[0]; });
await page.evaluate((c) => document.querySelector(`[data-xc="${c}"]`).click(), ans1); await sleep(300);
ok("정답 채점 → 기록 저장", await page.evaluate(() => S.ex["past-01-1"] && S.ex["past-01-1"].last === true && !!document.querySelector(".xres").textContent.includes("정답")));
await click("#x-next");
// 일부러 오답
const wrongPick = await page.evaluate(() => { const q = X.queue[1]; const ans = q.kind === "ox" ? [q.a] : (q.a.match(/[①-⑥]/g) || []); const b = [...document.querySelectorAll("[data-xc]")].find((x) => !ans.includes(x.dataset.xc)); return q.kind === "sa" ? null : b && b.dataset.xc; });
if (wrongPick) { await page.evaluate((c) => document.querySelector(`[data-xc="${c}"]`).click(), wrongPick); await sleep(300); }
ok("오답 채점 → 오답노트 기록", wrongPick ? await page.evaluate(() => S.ex["past-01-2"] && S.ex["past-01-2"].last === false) : true);
await click("#x-end");
ok("결과 화면 · 오답 목록에 묶음 이름", await page.evaluate(() => /결과/.test(document.querySelector("#p-exam h2").textContent) && (document.querySelectorAll("#p-exam li").length === 0 || /2018년 4급 기출/.test(document.querySelector("#p-exam li").textContent))));
if (await page.evaluate(() => !!document.getElementById("x-retry"))) {
  await click("#x-retry");
  ok("틀린 문제만 다시(새 문제 묶음에서도 동작)", await page.evaluate(() => X.sess && X.queue.length >= 1 && X.queue.every((q) => q && q.id)));
  await click("#x-end"); await click("#x-home");
} else { await click("#x-home"); }

/* ── 법령별 모아 풀기 ── */
const before = reqs.length;
await click("[data-xlaw=\"인사관리시행규칙\"]");
ok("법령별 모아 풀기 시작", await waitFor(page, () => X.sess && X.queue.length > 0 && X.grp === "custom", null, 12000), `요청 ${reqs.length - before}개 묶음`);
const lq = await page.evaluate(() => ({ n: X.queue.length, limit: X.limit, areas: [...new Set(X.queue.map((q) => q.area))], groups: [...new Set(X.queue.map((q) => q.grp))].length, mode: X.mode, uniq: new Set(X.queue.map((q) => q.q + "|" + q.a)).size, pool: X.custom.length, uniqPool: new Set(X.custom.map((q) => q.q + "|" + q.a)).size }));
ok("인사관리시행규칙 문제만 · 20문제 · 중복 제거", lq.areas.length === 1 && lq.areas[0] === "인사관리시행규칙" && lq.n === 20 && lq.uniqPool === lq.pool, JSON.stringify(lq));
ok("필요한 묶음만 불러옴(20문제에 15개 이하)", reqs.length - before <= 15, `요청 ${reqs.length - before}개`);
ok("여러 묶음에서 섞임 + 무작위", lq.groups > 1 && lq.mode === "rand");
await page.screenshot({ path: "quiz-law-session.png" });
// 직접 채점형(주관식) 문제 흐름
await page.evaluate(() => { X.custom = X.custom.filter((q) => q.kind === "sa"); X.queue = X.custom.slice(0, 3); X.i = 0; X.picked = null; X.shown = false; X.res = []; drawX(); });
ok("주관식: 정답 보기 → 자체 채점", await page.evaluate(() => !!document.getElementById("x-show")));
await click("#x-show");
ok("정답 표시 + 맞았다/틀렸다", await page.evaluate(() => !!document.getElementById("x-ok") && !!document.getElementById("x-no") && /정답/.test(document.querySelector(".xex").textContent)));
await click("#x-no");
ok("자체 채점 → 오답 기록", await page.evaluate(() => Object.values(S.ex).filter((r) => !r.last).length >= 2));
await click("#x-end"); await click("#x-home");

/* ── 오답노트: 새 묶음 포함, 새로고침해도 ── */
const wrongCnt = await page.evaluate(() => ({ n: exWrongCount(), btn: document.querySelector('[data-xstart="wrong"]').textContent, newGroups: wrongGroupIds() }));
ok("오답노트 개수에 새 묶음 포함", wrongCnt.n >= 2 && wrongCnt.newGroups.length >= 1, JSON.stringify(wrongCnt));
await page.reload({ waitUntil: "load" }); await sleep(600);
await page.evaluate(() => showTab("exam")); await sleep(400);
const loadedAfterReload = await page.evaluate(() => Object.keys(QLOADED).length);
const cnt2 = await page.evaluate(() => exWrongCount());
await click('[data-xstart="wrong"]');
ok("새로고침 후에도 오답노트 시작(필요한 묶음 자동 로딩)", await waitFor(page, () => X.sess && X.queue.length > 0 && X.grp === "wrong", null, 12000), `로딩 전 ${loadedAfterReload}묶음 → 오답 ${cnt2}개`);
const wq = await page.evaluate(() => ({ n: X.queue.length, expected: exWrongCount(), allWrong: X.queue.every((q) => exWrong(q)) }));
ok("오답노트 큐 = 틀린 문제 전부, 모두 오답 상태", wq.allWrong && wq.n === wq.expected, JSON.stringify(wq));
await click("#x-end"); await click("#x-home");

/* ── 필터 칩 ── */
await click('[data-xkind="sa"]');
await click("[data-xlaw=\"국제인도법\"]");
ok("유형 '주관식' 필터 적용(모아 풀기)", await waitFor(page, () => X.sess && X.queue.length > 0, null, 15000) && await page.evaluate(() => X.queue.every((q) => q.kind === "sa")), String(await page.evaluate(() => X.queue.length)));
await click("#x-end"); await click("#x-home"); await click('[data-xkind=""]');
await click('[data-xmode="new"]');
await click('[data-xlim="10"]');
ok("모아 풀기 문제 수 10 + 안 푼 것만", await page.evaluate(() => X.limit === 10 && S.xlim === 10 && X.mode === "new"));
await click('[data-xmode="order"]'); await click('[data-xlim="20"]');

/* ── 스터디 묶음 연도 필터 · 6지선다 ── */
await page.evaluate(() => { document.getElementById("x-sen").open = true; });
await click('[data-xsf="2025"]');
const yf = await page.evaluate(() => ({ n: document.querySelectorAll("#x-sen .pk").length, open: document.getElementById("x-sen").open, ok: [...document.querySelectorAll("#x-sen .pk b")].every((b) => b.textContent.startsWith("2025년")) }));
ok("연도 필터(2025) + 펼침 유지", yf.n > 0 && yf.n < 98 && yf.open && yf.ok, JSON.stringify(yf));
// ⑥ 보기 문제 찾기
const six = await page.evaluate(async () => { for (const g of QINDEX.filter((x) => x.kind === "senior")) { const items = await loadQuizGroup(g.id); const q = items.find((i) => i.kind === "mc" && /^⑥ /m.test(i.q)); if (q) return q.id; } return null; });
if (six) {
  await page.evaluate((id) => { const q = exById(id); X.custom = [q]; X.grp = "custom"; X.queue = [q]; X.i = 0; X.picked = null; X.shown = false; X.res = []; X.sess = true; X.done = false; drawX(); }, six);
  const sx = await page.evaluate(() => ({ btns: document.querySelectorAll("[data-xc]").length }));
  ok("⑥ 보기가 있는 문제는 버튼 6개", sx.btns === 6, six);
  await click("#x-end"); await click("#x-home");
} else res.push("SKIP  ⑥ 보기 문제 없음");

/* ── 오늘 탭 → 기출 풀기 ── */
await page.evaluate(() => { SCHED.forEach((x) => { if (x.n <= 4) x.d = "2020-01-01"; else if (x.n === 5) x.d = "2099-01-01"; });  /* 오늘 날짜와 무관하게 다음 시험 = 5차 */ showTab("today"); }); await sleep(500);
await page.evaluate(() => renderers.today()); await sleep(300);
const qb = await page.evaluate(() => { const b = document.querySelector('[data-prep="quiz"]'); return b ? { t: b.textContent.trim(), laws: b.dataset.laws } : null; });
ok("오늘 카드에 '기출·문제 풀기 (N)' 버튼 (10/29 이후 5차=보수운영규정)", qb && /기출·문제 풀기 \(\d+\)/.test(qb.t) && qb.laws === "보수운영규정", JSON.stringify(qb));
await page.evaluate(() => document.querySelector('[data-prep="quiz"]').click());
ok("버튼 → 기출 탭에서 그 법령 문제로 시작", await waitFor(page, () => document.getElementById("p-exam").classList.contains("on") && X.sess && X.grp === "custom" && X.queue.every((q) => q.area === "보수운영규정"), null, 15000));
await click("#x-end"); await click("#x-home");

/* ── 오늘 추천의 오답노트 수 ── */
await page.evaluate(() => showTab("today")); await sleep(400);
ok("오늘 추천: 오답노트 수가 전체 기준", await page.evaluate(() => { const r = [...document.querySelectorAll(".rec")].find((e) => /오답노트/.test(e.textContent)); return !!r && r.textContent.includes(String(exWrongCount())); }));

/* ── 레이아웃 · 성능 ── */
await page.evaluate(() => showTab("exam")); await sleep(300);
const perf = await page.evaluate(() => { const t = performance.now(); drawXHome(); return Math.round(performance.now() - t); });
ok("첫 화면 그리기 200ms 이내", perf < 200, `${perf}ms`);
await page.close();

page = await open(390, 844);
await page.evaluate(() => showTab("exam")); await sleep(500);
ok("폰: 가로 스크롤 없음", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await page.screenshot({ path: "quiz-phone.png" });
await page.close();

const real = errors.filter((e) => !/Failed to load resource|favicon|404/.test(e));
ok("콘솔 오류 없음", real.length === 0, real.join(" | "));
console.log(res.join("\n"));
await browser.close();
process.exit(res.some((r) => r.startsWith("FAIL")) ? 1 : 0);
