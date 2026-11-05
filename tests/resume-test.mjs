import puppeteer from "puppeteer-core";

/* 진단 기록(부팅·종료 구분)과 진행 중 세션 복구: 복습 카드·뻥뚫 도중 다시 로드돼도 이어서 */
const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" }); await sleep(1800);
const ev = (f, ...a) => page.evaluate(f, ...a);
const crash = async () => {   /* 렌더러를 죽이고 새 탭으로 다시 연다 = pagehide 없는 강제 종료 */
  await sleep(1200); await page.goto("chrome://crash").catch(() => {}); await sleep(500); await page.close().catch(() => {});
  page = await browser.newPage(); page.on("pageerror", (e) => errors.push(e.message)); await page.setViewport({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: "load" }); await sleep(2500);
};

ok("첫 부팅 기록", await ev(() => DIAG.log.some((x) => x.type === "boot" && x.prev === "first")));
await page.reload({ waitUntil: "load" }); await sleep(1800);
ok("정상 새로고침은 closed", await ev(() => DIAG.log.filter((x) => x.type === "boot").pop().prev === "closed"));

/* 복습 카드: 2장 넘기고 3번째에 입력 중 → 갑자기 끊김(pagehide 없이) */
await ev(() => showTab("quiz")); await sleep(500);
await ev(() => { Q.study = false; [...document.querySelectorAll("#p-quiz button")].find((b) => /시작/.test(b.textContent)).click(); }); await sleep(600);
for (let i = 0; i < 2; i++){
  await ev(() => { const r = document.getElementById("q-reveal"); r && r.click(); }); await sleep(150);
  await ev(() => (document.getElementById("q-right") || document.getElementById("q-next")).click()); await sleep(250);
}
const before = await ev(() => ({ i: Q.i, n: Q.queue.length, id: Q.queue[Q.i].id, sn: Q.sess.n }));
await ev(() => { Q.study = false; drawCard(); }); await sleep(200);   /* 입력칸 있는 시험 화면으로 */
const hasIn = await ev(() => !!document.getElementById("q-in"));
if (hasIn){ await page.focus("#q-in"); await page.keyboard.type("징계의결"); }
await sleep(500);
await crash();
ok("끊긴 부팅은 cut + 직전 세션 quiz", await ev(() => { const b = DIAG.log.filter((x) => x.type === "boot").pop(); return b.prev === "cut" && b.prevSess === "quiz"; }), await ev(() => JSON.stringify(DIAG.log.filter((x) => x.type === "boot").pop())));
const after = await ev(() => ({ tab: curTab(), sess: !!Q.sess, i: Q.i, n: Q.queue.length, id: Q.queue[Q.i] && Q.queue[Q.i].id, sn: Q.sess && Q.sess.n, typed: (document.getElementById("q-in") || {}).value || "" }));
ok("복습 카드 이어서(같은 카드·진행 수)", after.tab === "quiz" && after.sess && after.i === before.i && after.id === before.id && after.sn === before.sn, JSON.stringify(after));
ok("입력 중이던 글자 복구", hasIn && after.typed === "징계의결", after.typed);
await ev(() => document.getElementById("q-end").click()); await sleep(300);
await page.reload({ waitUntil: "load" }); await sleep(2000);
ok("끝낸 세션은 복구 안 함", await ev(() => !Q.sess && curTab() !== "quiz" || !Q.sess));

/* 뻥뚫: 직접 입력 중 끊김 */
await ev(() => { showTab("bt"); BT.lv = 3; BT.md = "type"; BT.cnt = 3; BT.law = "운영규정"; BT.topic = "0"; drawBtHome(); document.getElementById("bt-start").click(); }); await sleep(800);
const n = await ev(() => document.querySelectorAll("#bt-art .bt-in").length);
for (let k = 0; k < Math.min(n, 3); k++){ await ev((k) => document.querySelectorAll("#bt-art .bt-in")[k].focus(), k); await page.keyboard.type("가나" + k); }
await sleep(500);
const bb = await ev(() => ({ id: artId(BT.queue[BT.i]), ans: [...document.querySelectorAll("#bt-art .bt-in")].map((x) => x.dataset.ans).join("|") }));
await crash();
const ba = await ev(() => ({ tab: curTab(), sess: BT.sess, id: BT.queue[BT.i] && artId(BT.queue[BT.i]), ans: [...document.querySelectorAll("#bt-art .bt-in")].map((x) => x.dataset.ans).join("|"), vals: [...document.querySelectorAll("#bt-art .bt-in")].slice(0, 3).map((x) => x.value) }));
ok("뻥뚫 이어서(같은 조문·같은 빈칸)", ba.tab === "bt" && ba.sess && ba.id === bb.id && ba.ans === bb.ans, JSON.stringify({ id: ba.id, a: ba.ans.slice(0, 60), b: bb.ans.slice(0, 60) }));
ok("뻥뚫 입력값 복구", n === 0 || ba.vals.slice(0, Math.min(n, 3)).every((v, k) => v === "가나" + k), ba.vals.join("/"));
/* 채점 뒤 끊기면 다음 조문부터 (기록 중복 없음) */
await ev(() => document.getElementById("bt-check").click()); await sleep(300);
const resN = await ev(() => BT.res.length), iN = await ev(() => BT.i);
await sleep(500);
await crash();
ok("채점한 조문은 건너뛰고 다음 조문", await ev((a) => BT.sess && BT.res.length === a.resN && BT.i === a.iN + 1, { resN, iN }), await ev(() => BT.i));
ok("JS 오류 없음", errors.length === 0, errors.join(" | "));
console.log(res.join("\n"));
await browser.close();
