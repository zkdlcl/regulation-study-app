import puppeteer from "puppeteer-core";

/* 국제인도법 이해 층: 칩 표시 범위, 해석·원어·팁·비교·연표, 전역 모드 유지, 폰 넘침 */
const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1180, height: 820 });
await page.goto(URL, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" }); await sleep(600);
const ev = (f, ...a) => page.evaluate(f, ...a);
const openLaw = async (law) => { await ev((l) => { R.law = l; R.topic = "0"; showTab("read"); drawRead(); }, law); await sleep(1200); };
const A = (no) => `[id="a-국제인도법:${no}"]`;

await openLaw("보수운영규정");
ok("다른 규정에는 이해 칩 없음", await ev(() => !document.querySelector(".ihx")));
await openLaw("국제인도법");
const n = await ev(() => document.querySelectorAll(".art .ihx").length);
ok("데이터 있는 절 수만큼 칩 줄", n === (await ev(() => Object.keys(D.ihlStudy.arts).length)), n);
ok("데이터 없는 절에는 없음", await ev(() => !document.querySelector('[id="a-국제인도법:제1장 2)"] .ihx')));
ok("처음엔 닫힘", await ev((s) => document.querySelector(s + " .ihx-pane").hidden, A("제2장 1)")));

await ev((s) => document.querySelector(s).scrollIntoView({ block: "center" }), A("제2장 1)"));
await page.click(`${A("제2장 1)")} [data-ihxk="easy"]`); await sleep(200);
ok("해석 열림", await ev((s) => { const p = document.querySelector(s + " .ihx-pane"); return !p.hidden && p.querySelectorAll(".ihx-easy li").length === 5; }, A("제2장 1)")));
ok("전역 모드: 다른 절도 해석 열림", await ev((s) => !document.querySelector(s + " .ihx-pane").hidden && !!document.querySelector(s + " .ihx-easy"), A("제11장 2)")));
await page.click(`${A("제2장 1)")} [data-ihxk="en"]`); await sleep(200);
ok("원어 jus ad bellum", await ev((s) => /jus ad bellum/.test(document.querySelector(s + " .ihx-en").textContent), A("제2장 1)")));
ok("원어 없는 절은 닫힘(제4장 2)", await ev((s) => document.querySelector(s + " .ihx-pane").hidden, A("제4장 2)")));
await page.click(`${A("제2장 1)")} [data-ihxk="vs"]`); await sleep(200);
ok("비교 카드 두 칸", await ev((s) => document.querySelectorAll(s + " .ihx-side").length === 2, A("제2장 1)")));
await page.click(`${A("제2장 1)")} [data-ihxcover="b"]`); await sleep(100);
ok("한쪽 가리기", await ev((s) => document.querySelector(s + ' .ihx-side[data-side="b"]').classList.contains("covered"), A("제2장 1)")));
await page.screenshot({ path: "tests/ihl-study-vs.png" });

await ev((s) => document.querySelector(s).scrollIntoView({ block: "start" }), A("제4장 2)"));
await page.click(`${A("제4장 2)")} [data-ihxk="tl"]`); await sleep(200);
const tl = await ev((s) => { const l = document.querySelectorAll(s + " .ihx-ti"), v = [...l].filter((x) => x.offsetParent); return { all: l.length, vis: v.length, core: v.every((x) => x.classList.contains("core")), first: v[0] && v[0].querySelector(".ihx-ty").textContent }; }, A("제4장 2)"));
ok("연표: 원문 표 행 그대로", tl.all === (await ev((s) => document.querySelectorAll(s + " table tr").length - 1, A("제4장 2)"))), JSON.stringify(tl));
ok("연표: 기본 ○ 핵심만", tl.core && tl.vis > 5 && tl.vis < tl.all && tl.first === "1864");
await page.screenshot({ path: "tests/ihl-study-tl.png" });
await page.click(`${A("제4장 2)")} [data-ihxtl="all"]`); await sleep(150);
ok("연표: 전체 보기", await ev((s) => [...document.querySelectorAll(s + " .ihx-ti")].every((x) => x.offsetParent), A("제4장 2)")));
await page.click(`${A("제4장 2)")} [data-ihxk="tl"]`); await sleep(150);
ok("같은 칩 다시 누르면 닫힘", await ev((s) => document.querySelector(s + " .ihx-pane").hidden, A("제4장 2)")));

await page.click(`${A("제11장 2)")} [data-ihxk="tip"]`); await sleep(150);
await page.reload({ waitUntil: "load" }); await sleep(600);
await openLaw("국제인도법");
ok("새로고침 뒤 모드 유지(팁)", await ev((s) => !document.querySelector(s + " .ihx-pane").hidden && !!document.querySelector(s + " .ihx-tip"), A("제11장 2)")));

await ev(() => { document.documentElement.dataset.theme = "dark"; });
await page.setViewport({ width: 390, height: 844 }); await sleep(300);
await page.click(`${A("제2장 1)")} [data-ihxk="vs"]`); await sleep(200);
await ev((s) => document.querySelector(s).scrollIntoView({ block: "start" }), A("제2장 1)")); await sleep(200);
ok("폰 너비 가로 넘침 없음", await ev(() => document.documentElement.scrollWidth <= innerWidth), await ev(() => document.documentElement.scrollWidth));
await page.screenshot({ path: "tests/ihl-study-phone.png" });
ok("JS 오류 없음", errors.length === 0, errors.join(" | "));
console.log(res.join("\n"));
await browser.close();
