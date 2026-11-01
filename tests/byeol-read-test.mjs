import puppeteer from "puppeteer-core";

/* 별표 회독 체크 · 별표 제2호 금액 표가 행 단위로 맞는지 */
const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
/* 게시본의 옛 data 파일을 재현: 파일의 별표는 쓸모없게 바꿔도 페이지에 넣은 별표가 나와야 한다 */
await page.setRequestInterception(true);
page.on("request", async (q) => {
  if (!q.url().endsWith("compensation.json")) return q.continue();
  const j = await (await fetch(q.url())).json();
  j.extra = j.extra.replace(/<tr>/g, '<tr data-old="1">');
  q.respond({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
});
await page.setViewport({ width: 1180, height: 820 });
await page.goto(URL, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" }); await sleep(600);
const ev = (f, ...a) => page.evaluate(f, ...a);
const KEY = "보수운영규정:별표2";
const openLaw = async (law) => { await ev((l) => { R.law = l; R.topic = "0"; showTab("read"); drawRead(); }, law); await sleep(900); };
const clickRc = (minus) => ev((k, m) => { document.querySelector(`#r-body [data-brc="${k}"]${m ? '[data-d="-"]' : ":not([data-d])"}`).click(); }, KEY, minus);
const prog = () => ev(() => document.getElementById("r-prog").textContent);

await openLaw("보수운영규정");
ok("페이지에 넣은 별표가 파일보다 우선", await ev(() => !document.querySelector('#r-body tr[data-old]')));
ok("별표마다 회독 버튼", await ev(() => document.querySelectorAll("#r-body .chap[id] .chap-rc").length) === 22);
ok("시작은 0회독", await ev((k) => !S.reads[k], KEY));
ok("진행 줄에 별표 집계", /별표 0\/22/.test(await prog()), await prog());
const lastRead = () => ev(() => JSON.stringify((S.rd && S.rd.last) || {}));
const last0 = await lastRead();
await clickRc(); await sleep(150);
ok("+1 기록", await ev((k) => S.reads[k] === 1, KEY));
ok("제목이 읽음 표시", await ev(() => document.getElementById("byeol-보수운영규정-2").classList.contains("read")));
ok("목차에 체크", await ev(() => document.querySelector('#r-toc [data-tj="byeol-보수운영규정-2"] .ck').textContent === "✓"));
ok("진행 줄 1/22", /별표 1\/22/.test(await prog()));
ok("이어 읽기 위치는 그대로", last0 === await lastRead());
ok("이동 목록 제목에 버튼 글자 없음", await ev(() => ![...document.querySelectorAll("#r-jump option")].some((o) => o.value.startsWith("byeol-") && /회독/.test(o.textContent))));
await clickRc(true); await sleep(150);
ok("➖ 로 되돌림", await ev((k) => S.reads[k] === 0, KEY));

const rows = await ev(() => {
  let t = document.getElementById("byeol-보수운영규정-2");
  while (t && !t.matches(".tw")) t = t.nextElementSibling;
  return [...t.querySelectorAll("tr")].map((r) => [...r.cells].map((c) => c.textContent.trim()));
});
const amt = (s) => (rows.find((r) => (r[1] || "").includes(s)) || [])[2];
for (const [who, won] of [
  ["가. 혈액관리본부 본부장 및 실·국장", "460,000"], ["나. 연구관리부장", "360,000"],
  ["다. 혈액관리본부 팀장: 전문의사", "360,000"], ["→ 혈액관리본부 팀장: 일반의사", "288,000"],
  ["라. 혈액관리본부 소속기관 부(팀)장: 전문의사", "288,000"], ["→ 혈액관리본부 소속기관 부(팀)장: 일반의사", "216,000"],
  ["마. 기타: 전문의사", "216,000"], ["→ 기타: 일반의사", "180,000"],
  ["가. 2급 보직자", "150,000"], ["라. 3급이하 비보직자", "80,000"], ["가. 부장급연구원", "240,000"], ["라. 연구원", "80,000"]])
  ok(`표: ${who}`, amt(who) === won, amt(who));
ok("한 칸에 금액 한 개", rows.every((r) => !/\d,\d{3}.*\d,\d{3}/.test(r[2] || "")));

await ev(() => openPeek("b|보수운영규정:2")); await sleep(300);
await ev(() => document.querySelector("#pk [data-pkread]").click()); await sleep(300);
ok("참조 패널에서도 +1", await ev((k) => S.reads[k] === 1, KEY));
ok("패널 버튼에 표시", await ev(() => document.querySelector("#pk [data-pkread]").textContent === "✓1"));
await ev(() => closePeek());

for (const [w, h, name] of [[1180, 820, "land"], [820, 1180, "port"], [390, 844, "phone"]]) {
  for (const theme of ["light", "dark"]) {
    await page.setViewport({ width: w, height: h });
    await ev((t) => { document.documentElement.dataset.theme = t; S.theme = t; }, theme);
    await ev(() => { document.getElementById("byeol-보수운영규정-2").scrollIntoView(); }); await sleep(250);
    await page.screenshot({ path: `tests/byeol-${name}-${theme}.png` });
  }
}
await page.setViewport({ width: 1180, height: 820 });

await openLaw("정관");
ok("정관 별표도 버튼", await ev(() => !!document.querySelector('#r-body [data-brc="정관:별표1"]')));
await openLaw("인사관리시행규칙");
ok("인사서식 키", await ev(() => !!document.querySelector('#r-body [data-brc="인사관리시행규칙:인사서식25"]')));
ok("JS 오류 없음", errors.length === 0, errors.join(";"));
console.log(res.join("\n")); await browser.close();
