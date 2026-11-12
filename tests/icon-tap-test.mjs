import puppeteer from "puppeteer-core";

/* 버튼 안 아이콘(ui7 의 <i class="ic"><svg>)을 눌러도 버튼이 눌려야 한다.
   클릭 처리가 e.target.id 로 버튼을 가리는 곳이 많아, 아이콘이 누름을 가로채면 반응이 없다 (2026-11 모바일: 카드 '몰랐다' 무반응) */
const URL = process.env.TEST_URL || "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: "load" }); await sleep(800);
const ev = (f, ...a) => page.evaluate(f, ...a);

ok("아이콘은 누름을 가로채지 않음(CSS)", await ev(() => { const i = document.querySelector("button .ic"); return !!i && getComputedStyle(i).pointerEvents === "none" && getComputedStyle(i.querySelector("svg") || i).pointerEvents === "none"; }));
/* 카드 세션: 처음 보는 카드 대신 이미 본 카드 하나를 기한으로 만들어 바로 채점 화면으로 */
await ev(() => {
  const cs = D.cards.slice(0, 3); cs.forEach((c) => { S.cards[c.id] = { box: 0, right: 0, wrong: 1, due: 0, first: false, last: false }; });
  Q.queue = cs; Q.i = 0; Q.hist = []; Q.sess = { t: Date.now(), tag: "t", n: 0, ok: 0, retryOk: 0, retry: 0, ms: 0, study: 0 };
  showTab("quiz"); drawCard();
});
await sleep(300);
await page.tap("#q-reveal"); await sleep(300);
const tapIcon = async (sel) => {
  const b = await ev((s) => { const i = document.querySelector(s + " .ic"); if (!i) return null; i.scrollIntoView({ block: "center" }); const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  if (!b) return "아이콘 없음";
  const hit = await ev((p) => { const e = document.elementFromPoint(p.x, p.y); return e ? e.tagName + (e.id ? "#" + e.id : "") : "null"; }, b);
  await page.touchscreen.tap(b.x, b.y); await sleep(300);
  return hit;
};
const i0 = await ev(() => Q.i);
const hit = await tapIcon("#q-wrong");
ok("'몰랐다' 아이콘 위치를 누르면 그 버튼이 눌림", hit === "BUTTON#q-wrong" && (await ev(() => Q.i)) === i0 + 1, `hit=${hit}`);
ok("채점이 기록됨", await ev(() => S.log.length > 0 && S.log[S.log.length - 1].ok === false));
await page.tap("#q-reveal"); await sleep(300);
const hit2 = await tapIcon("#q-right");
ok("'알았다' 아이콘 위치도 동작", hit2 === "BUTTON#q-right" && (await ev(() => Q.i)) === i0 + 2, `hit=${hit2}`);
ok("페이지 오류 없음", errors.length === 0, errors.join(" / "));
console.log(res.join("\n"));
await browser.close();
