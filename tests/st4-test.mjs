import puppeteer from "puppeteer-core";

/* 스터디 4주차(11/5 보수운영규정) 8인 56문항: 묶음·답·화면 */
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1180, height: 820 });
await page.goto("http://localhost:8765/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" }); await sleep(800);
const r = await page.evaluate(() => {
  const x = D.exam.filter((e) => e.grp === "st4");
  const by = {}; x.forEach((e) => (by[e.area] = (by[e.area] || 0) + 1));
  const g = (id) => (x.find((e) => e.id === id) || {}).a;
  return { n: x.length, by, xg: XG.map((g) => g[0]).join(","), a: [g("st4-최강락-7"), g("st4-구현지-6"), g("st4-박준규-5"), g("st4-전권능-1"), g("st4-신승현-6")].join(","), five: /⑤ 0개/.test((x.find((e) => e.id === "st4-구현지-6") || {}).q || "") };
});
ok("4주차 56문항", r.n === 56, String(r.n));
ok("8인 × 7문항", Object.keys(r.by).length === 8 && Object.values(r.by).every((v) => v === 7), JSON.stringify(r.by));
ok("묶음 순서 st3 → st4 → case", /st3,st4,case/.test(r.xg), r.xg);
ok("답 확인(최강락-7 ③, 구현지-6 ⑤, 박준규-5 X, 전권능-1 ②, 신승현-6 ④)", r.a === "③,⑤,X,②,④", r.a);
ok("구현지-6 에 ⑤ 0개 보기", r.five);
await page.evaluate(() => showTab("exam")); await sleep(500);
const card = await page.evaluate(() => [...document.querySelectorAll("#p-exam .pk")].map((b) => b.textContent.replace(/\s+/g, " ").trim()).find((t) => /4주차/.test(t)) || "");
ok("기출 탭에 4주차 묶음 카드", /4주차/.test(card) && /56/.test(card), card);
await page.screenshot({ path: "tests/st4-exam.png" });
for (const [w, h, dark] of [[820, 1180, false], [390, 844, true]]) {
  await page.setViewport({ width: w, height: h });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
  await sleep(400);
  await page.screenshot({ path: `tests/st4-exam-${w}.png` });
}
ok("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
console.log(res.join("\n"));
await browser.close();
