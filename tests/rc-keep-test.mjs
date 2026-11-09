import puppeteer from "puppeteer-core";

/* 회독 +1·−1 을 눌러도 누른 조문이 제자리에 있어야 한다 (국제인도법: 이해 칩이 늦게 붙어 몇 절 아래로 밀리던 오류) */
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1180, height: 820 });
await page.goto("http://localhost:8765/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: "load" }); await sleep(800);
const ev = (f, ...a) => page.evaluate(f, ...a);
const openLaw = async (law) => { await ev((l) => { R.law = l; R.topic = "0"; showTab("read"); drawRead(); }, law); await sleep(1200); };
const top = (id) => ev((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
const check = async (name, id) => {
  await ev((id) => { const el = document.getElementById(id); window.scrollBy(0, el.getBoundingClientRect().top - 140); }, id); await sleep(300);
  const t0 = await top(id);
  await page.click(`[id="${id}"] .rc:not(.minus)`); await sleep(400);
  const t1 = await top(id);
  ok(name + " +1 제자리", Math.abs(t1 - t0) <= 2, `${t0}→${t1}`);
  await page.click(`[id="${id}"] .rc.minus`); await sleep(400);
  const t2 = await top(id);
  ok(name + " −1 제자리", Math.abs(t2 - t0) <= 2, `${t0}→${t2}`);
};
await openLaw("국제인도법");
const ids = await ev(() => [...document.querySelectorAll('#r-body .art[id^="a-"]')].map((e) => e.id));
const pick = (re) => ids.find((i) => re.test(i));
await check("인도법 뒤쪽 절", pick(/표장의 사용.*1\)/));
await check("인도법 중간 절", ids[Math.floor(ids.length / 2)]);
await ev(() => { localStorage.setItem("ihx-mode", "easy"); }); await page.reload({ waitUntil: "load" }); await sleep(800);
await openLaw("국제인도법");
await check("인도법 해석 펼침", pick(/표장의 사용.*1\)/));
await openLaw("운영규정");
await check("운영규정", "a-운영규정:30");
ok("페이지 오류 없음", errors.length === 0, errors.join(" / "));
console.log(res.join("\n"));
await browser.close();
