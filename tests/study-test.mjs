import puppeteer from "puppeteer-core";
import { readFileSync } from "fs";

/* 스터디 답지 반영: 공식 답·해설, 이재길 조직법 추가 문항, 가채점 seed 정정(실제 백업 기록으로) */
const P = JSON.parse(JSON.parse(readFileSync(new globalThis.URL("../backup/progress.json", import.meta.url), "utf8")).json);
const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1180, height: 820 });
await page.goto(URL, { waitUntil: "load" });
await page.evaluate((s) => { localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(s)); }, P);
await page.reload({ waitUntil: "load" }); await sleep(800);

const r = await page.evaluate(() => ({ ex: S.ex, seeds: S.seeds, fix: D.stFix }));
const flip = Object.keys(r.fix);
ok("정정 대상 6문항", flip.length === 6, flip.join(","));
ok("정정 대상은 틀림으로 바뀜", flip.every((id) => r.ex[id].w >= 1 && r.ex[id].n >= r.ex[id].w && (r.ex[id].last === false || r.ex[id].n > r.ex[id].w)), flip.map((id) => `${id}:${r.ex[id].n}/${r.ex[id].w}/${r.ex[id].last}`).join(" "));   /* 정정 뒤 다시 풀어 맞힌 기록(last=true, n>w)도 허용 */
const same = Object.keys(P.ex).filter((id) => !flip.includes(id));
ok("나머지 기록은 그대로", same.every((id) => JSON.stringify(P.ex[id]) === JSON.stringify(r.ex[id])), same.length + "건");
ok("회독·카드 기록 그대로", JSON.stringify(P.reads) === JSON.stringify(await page.evaluate(() => S.reads)) && Object.keys(P.cards).length === (await page.evaluate(() => Object.keys(S.cards).length)));
ok("한 번만 (seeds.st2fix)", r.seeds.st2fix === 1);
// 다시 열어도 또 바뀌지 않음 (다시 푼 기록 흉내: 하나를 맞음으로)
await page.evaluate(() => { S.ex["st2-황해민-8"] = { n: 2, w: 1, last: true, t: Date.now() }; save(); });
await page.reload({ waitUntil: "load" }); await sleep(800);
ok("다시 푼 기록은 안 건드림", await page.evaluate(() => S.ex["st2-황해민-8"].last === true && S.ex["st2-황해민-8"].n === 2));

const d = await page.evaluate(() => {
  const g = (id) => D.exam.find((e) => e.id === id);
  return { a10: g("st2-이재길-10").a, ex10: g("st2-이재길-10").ex, st1: D.exam.filter((e) => e.grp === "st1" && e.area === "이재길").length,
    warn: D.exam.filter((e) => e.grp.startsWith("st") && /정답 추정/.test(e.ex)).map((e) => e.id) };
});
ok("공식 답 반영 (이재길-10 = X)", d.a10 === "X" && /가채점 정정/.test(d.ex10));
ok("'정답 추정' 경고 모두 사라짐", d.warn.length === 0, d.warn.join(","));
ok("이재길 조직법·정관 10문항 추가", d.st1 === 10);

// 1주차 묶음에서 이재길 1번을 풀어 본다
await page.evaluate(() => showTab("exam")); await sleep(300);
await page.evaluate(() => document.querySelector('[data-xstart="st1"]').click());
for (let i = 0; i < 30 && !(await page.evaluate(() => X.sess && X.queue.length)); i++) await sleep(200);
const n = await page.evaluate(() => X.queue.length);
await page.evaluate(() => { X.i = X.queue.findIndex((e) => e.id === "st1-이재길-1"); X.picked = null; X.shown = false; drawX(); }); await sleep(200);
const ch = await page.evaluate(() => [...document.querySelectorAll(".xc")].map((b) => b.textContent.trim()));
ok("1주차 묶음 66문항, 선택지 4개", n === 66 && ch.length === 4, n + " / " + ch.join("|"));
await page.evaluate(() => [...document.querySelectorAll(".xc")][2].click()); await sleep(300);
const ex = await page.evaluate(() => document.querySelector(".xex") && document.querySelector(".xex").textContent.slice(0, 80));
ok("정답 공개 후 해설", !!ex && ex.includes("3개"), ex);
await page.screenshot({ path: "study-st1.png" });
for (const [w, h, nm] of [[820, 1180, "port"], [390, 844, "phone"]]) {
  await page.setViewport({ width: w, height: h }); await sleep(300);
  await page.screenshot({ path: `study-${nm}.png` });
  ok(`${nm}: 가로 스크롤 없음`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
ok("페이지 오류 없음", errors.length === 0, errors.join(" | "));
console.log(res.join("\n"));
await browser.close();
