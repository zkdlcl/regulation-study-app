import puppeteer from "puppeteer-core";

/* 회독 제외 ✕: 삭제 조문·불필요한 별표를 회독 진도·이어 읽기에서 뺀다 */
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
const LAW = "운영규정", AK = "운영규정:14", AEL = "a-운영규정:14", BK = "보수운영규정:별표2", BEL = "byeol-보수운영규정-2";
const openLaw = async (law) => { await ev((l) => { R.law = l; R.topic = "0"; showTab("read"); drawRead(); }, law); await sleep(900); };
const clickX = async (k) => { await ev((k) => document.querySelector(`#r-body [data-rskip="${k}"]`).click(), k); await sleep(150); };
const prog = () => ev(() => document.getElementById("r-prog").textContent);
const denom = (s) => +/1회독 이상 \d+\/(\d+)조/.exec(s)[1];

await openLaw(LAW);
ok("조문마다 ✕", await ev(() => document.querySelectorAll('#r-body .art[id^="a-"]').length === document.querySelectorAll("#r-body .art .rc-x").length));
const n0 = denom(await prog());
await ev((k) => { S.reads[k] = 2; save(); drawRead(true); }, AK);
await clickX(AK);
ok("제외 기록", await ev((k) => S.rskip[k] === 1, AK));
ok("회독 수는 보존", await ev((k) => S.reads[k] === 2, AK));
ok("분모에서 빠짐", denom(await prog()) === n0 - 1, await prog());
ok("진행 줄에 제외 표시", /제외 1/.test(await prog()));
ok("본문 접힘", await ev((id) => [...document.getElementById(id).children].filter((e) => getComputedStyle(e).display !== "none").length === 1, AEL));
ok("회독 버튼 숨김", await ev((id) => !document.getElementById(id).querySelector(".rc"), AEL));
ok("↩ 로 표시", await ev((id) => document.getElementById(id).querySelector(".rc-x").textContent === "↩", AEL));
ok("목차에 ✕", await ev((id) => document.querySelector(`#r-toc [data-tj="${id}"] .ck`).textContent === "✕", AEL));
ok("이어 읽기 후보에서 빠짐", await ev((k) => !candArts().some((a) => artId(a) === k), AK));
ok("안 읽은 조문을 제외하면 다음 회독으로", await ev((k) => {
  const keep = JSON.stringify(S.reads);
  lawArts().forEach((a) => { S.reads[artId(a)] = 1; }); S.reads[k] = 0;
  const r1 = readRound(lawArts()), r2 = readRound(candArts());
  S.reads = JSON.parse(keep);
  return r1 === 1 && r2 === 2;
}, AK));
await page.reload({ waitUntil: "load" }); await sleep(600);
await openLaw(LAW);
ok("새로고침 뒤에도 유지", await ev((id) => document.getElementById(id).classList.contains("skip"), AEL));
await clickX(AK);
ok("해제하면 회독 수 복귀", await ev((k) => !S.rskip[k] && S.reads[k] === 2, AK));
ok("해제하면 분모 복귀", denom(await prog()) === n0, await prog());
ok("해제하면 회독 버튼 복귀", await ev((id) => !!document.getElementById(id).querySelector(".rc.has"), AEL));
ok("해제 뒤 제외 표시 없음", !/제외/.test(await prog()));

await openLaw("보수운영규정");
ok("별표에도 ✕", await ev(() => document.querySelectorAll("#r-body .chap[id] .rc-x").length) === 22);
await clickX(BK);
ok("별표 집계에서 빠짐", /별표 0\/21/.test(await prog()), await prog());
ok("별표 표 접힘", await ev((id) => { let t = document.getElementById(id).nextElementSibling; while (t && !t.matches(".tw")) t = t.nextElementSibling; return !!t && getComputedStyle(t).display === "none"; }, BEL));
ok("다음 별표 본문 보임", await ev(() => { const e = document.getElementById("byeol-보수운영규정-3"); return getComputedStyle(e).display !== "none" && getComputedStyle(e.nextElementSibling).display !== "none"; }));
ok("별표 목차 ✕", await ev((id) => document.querySelector(`#r-toc [data-tj="${id}"] .ck`).textContent === "✕", BEL));
ok("이동 목록 제목에 버튼 글자 없음", await ev(() => ![...document.querySelectorAll("#r-jump option")].some((o) => o.value.startsWith("byeol-") && /[✕↩]/.test(o.textContent))));
ok("제외한 별표만 접힘", await ev(() => { const o = document.querySelectorAll("#r-body .chap.skip").length; return o === 1; }));

await openLaw(LAW);
await clickX(AK);
for (const [w, h, name] of [[1180, 820, "land"], [820, 1180, "port"], [390, 844, "phone"]]) {
  for (const theme of ["light", "dark"]) {
    await page.setViewport({ width: w, height: h });
    await ev((t) => { document.documentElement.dataset.theme = t; }, theme);
    await ev((id) => document.getElementById(id).previousElementSibling.scrollIntoView(), AEL); await sleep(250);
    await page.screenshot({ path: `tests/rskip-${name}-${theme}.png` });
  }
}
await page.setViewport({ width: 1180, height: 820 });
await ev(() => { document.documentElement.dataset.theme = "light"; });
await openLaw("보수운영규정");
await ev((id) => document.getElementById(id).scrollIntoView(), BEL); await sleep(250);
await page.screenshot({ path: "tests/rskip-byeol.png" });
ok("JS 오류 없음", errors.length === 0, errors.join(";"));
console.log(res.join("\n")); await browser.close();
