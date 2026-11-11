import puppeteer from "puppeteer-core";

/* 국제인도법 조약·의정서 용어 링크: 본문 링크 → 우측 참조 패널에 수록본 원문 줄 그대로, 빈칸·문맥 구분, 다른 규정에는 없음 */
const URL = process.env.TEST_URL || "http://localhost:8765/index.html";
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

await openLaw("운영규정");
ok("다른 규정에는 용어 링크 없음", await ev(() => !document.querySelector("#r-body .xr-t")));
await openLaw("국제인도법");
const miss = await ev(() => D.ihlTerms.filter((t) => !document.querySelector(`#r-body [data-x="t|${t.id}"]`)).map((t) => t.id));
ok("모든 용어가 본문에 링크로 있음", miss.length === 0, miss.join());
ok("빈칸 안 글자는 링크로 만들지 않음", await ev(() => !document.querySelector("#r-body .b .xr-t, #r-body .xr-t .b")));
ok("다시 그려도 링크가 겹치지 않음", await ev(() => { drawRead(true); return !document.querySelector("#r-body .xr .xr"); }));
/* 문맥 구분: 연도가 빈칸이어도 1954년 헤이그협약은 문화재 협약으로, 절에 따라 '제2의정서'가 다른 문서로 */
const ctx = await ev(() => {
  const ids = (no, re) => [...document.querySelectorAll(`[id="a-국제인도법:${no}"] .xr-t`)].filter((e) => re.test(e.textContent)).map((e) => e.dataset.x.slice(2));
  return { h54: ids("제17장 3-4)", /헤이그/), p2c: ids("제17장 3-4)", /^제2의정서$/), p2a: ids("제8장 10)", /^제2의정서$/), h07: ids("제6장 2)", /헤이그/), g06: [...document.querySelectorAll('[id="a-국제인도법:제4장 2)"] td')].filter((td) => /1906년 제네바 제협약/.test(td.textContent)).flatMap((td) => [...td.querySelectorAll('[data-x="t|gc"]')]).length };
});
ok("1954년 헤이그협약 → 문화재 협약", ctx.h54.length > 0 && ctx.h54.every((i) => i === "hague54"), JSON.stringify(ctx.h54));
ok("제17장의 제2의정서 → 1954년 헤이그협약", ctx.p2c.length > 0 && ctx.p2c.every((i) => i === "hague54"));
ok("제8장의 제2의정서 → 제2추가의정서", ctx.p2a.length === 1 && ctx.p2a[0] === "ap2");
ok("1907년 헤이그협약 → 헤이그협약", ctx.h07.length > 0 && ctx.h07.every((i) => i === "hague"));
ok("1906년 제네바 제협약은 1949년 협약으로 잇지 않음", ctx.g06 === 0);

/* 패널: 발췌 줄이 원문 줄과 글자까지 같다 */
await ev((s) => document.querySelector(s).scrollIntoView({ block: "center" }), A("제5장 5)"));
const top0 = await ev((s) => Math.round(document.querySelector(s).getBoundingClientRect().top), `${A("제5장 5)")} .xr-t[data-x="t|ca3"]`);
await page.click(`${A("제5장 5)")} .xr-t[data-x="t|ca3"]`); await sleep(700);
ok("패널 열림 · 제목", await ev(() => !document.querySelector("#pk").hidden && /공통 제3조/.test(document.querySelector("#pk-ti").textContent)));
ok("나란히 보기에서 누른 줄 제자리", Math.abs((await ev((s) => Math.round(document.querySelector(s).getBoundingClientRect().top), `${A("제5장 5)")} .xr-t[data-x="t|ca3"]`)) - top0) <= 2);
const same = await ev(() => {
  const sq = (s) => s.replace(/\s+/g, ""), bad = [];
  const by = Object.fromEntries(D.articles.filter((a) => a.type === "a" && a.law === "국제인도법").map((a) => [a.no, sq(Object.assign(document.createElement("div"), { innerHTML: a.html }).textContent)]));
  document.querySelectorAll("#pk-body .itm-sec").forEach((sec) => sec.querySelectorAll(":scope > .ln, tr").forEach((u) => { if (!by[sec.dataset.no].includes(sq(u.textContent))) bad.push(sec.dataset.no); }));
  const sum = [...document.querySelectorAll("#pk-body .itm-sum")].every((q) => Object.values(by).some((t) => t.includes(sq(q.textContent))));
  return { bad, sum, n: document.querySelectorAll("#pk-body .itm-sec > .ln").length };
});
ok("발췌 줄이 원문과 같음", same.bad.length === 0 && same.n >= 12, JSON.stringify(same));
ok("요약 문장도 원문 그대로", same.sum);
ok("패널 안에서 자기 자신은 링크 아님", await ev(() => !document.querySelector('#pk-body .xr-t[data-x="t|ca3"]')));
ok("다른 절 칩", await ev(() => document.querySelectorAll("#pk-body .itm-chip").length >= 3));
await page.click('#pk [data-pkmode="1"]'); await sleep(300);
ok("가리기 단계 유지", await ev(() => document.querySelector("#pk").dataset.pkrd === "1" && /공통 제3조/.test(document.querySelector("#pk-ti").textContent)));
await page.click('#pk [data-pkmode="0"]'); await sleep(300);
await page.click('#pk-body .xr-t[data-x="t|ap2"]'); await sleep(600);
ok("패널 안 용어 → 쌓임", await ev(() => PK.stack.join(">") === "t|ca3>t|ap2" && /제2추가의정서/.test(document.querySelector("#pk-ti").textContent)));
await page.click("#pk-body .itm-src .xr"); await sleep(700);
ok("출처 절 열기 → 조문 패널, 그 안에도 용어 링크", await ev(() => PK.stack.length === 3 && PK.stack[2].startsWith("a|국제인도법:") && !!document.querySelector("#pk-body .xr-t")));
await page.click("#pk-back"); await sleep(400); await page.click("#pk-back"); await sleep(400);
ok("뒤로 두 번 → 처음 용어", await ev(() => PK.stack.join(">") === "t|ca3"));
/* 모든 용어 패널이 비지 않는다 */
const empty = await ev(async () => { const out = []; for (const t of D.ihlTerms){ PK.stack = ["t|" + t.id]; await renderPeek(); if (document.querySelectorAll("#pk-body .itm-sec").length !== t.refs.length) out.push(t.id); } return out; });
ok("모든 용어 패널에 발췌", empty.length === 0, empty.join());
await page.keyboard.press("Escape"); await sleep(300);

/* 폰: 패널이 덮는 방식으로 열리고 가로 넘침 없음 */
await page.setViewport({ width: 390, height: 844 }); await sleep(400);
await ev((s) => document.querySelector(s).scrollIntoView({ block: "center" }), A("제6장 3)"));
await page.click(`${A("제6장 3)")} .xr-t[data-x="t|ap1"]`); await sleep(700);
ok("폰: 패널 열림 · 가로 넘침 없음", await ev(() => !document.querySelector("#pk").hidden && document.querySelector("#pk-body").scrollWidth <= document.querySelector("#pk-body").clientWidth + 1));
await page.screenshot({ path: "tests/ihl-terms-phone.png" });
ok("페이지 오류 없음", errors.length === 0, errors.join(" / "));
console.log(res.join("\n"));
await browser.close();
