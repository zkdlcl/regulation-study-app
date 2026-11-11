import puppeteer from "puppeteer-core";

/* 회독: ① 범위·이동 칩 줄이 지금 읽는 곳을 따라간다 ② 국제인도법 원문 그림·박스가 가리키는 줄 아래에 붙는다 */
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [["port", 820, 1180, "light"], ["land", 1180, 820, "dark"], ["phone", 390, 844, "light"]];
for (const [name, w, h, scheme] of shots) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.goto("http://localhost:8765/index.html", { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: "load" }); await sleep(800);
  const ev = (f, ...a) => page.evaluate(f, ...a);
  await ev(() => { R.law = "국제인도법"; R.topic = "0"; showTab("read"); drawRead(); }); await sleep(1500);
  const ids = await ev(() => [...document.querySelectorAll('#r-body .art[id^="a-"]')].map((e) => e.id));
  const goto = async (id) => { await ev((id) => { const el = document.getElementById(id); window.scrollBy(0, el.getBoundingClientRect().top - 150); }, id); await sleep(700); };
  /* 칩 상태: 표시된 칩 글자와, 그 칩이 줄 안에 보이는지 */
  const chips = () => ev(() => {
    /* 칩이 줄보다 길면(폰) 앞머리가 보이면 된다 */
    const vis = (b) => { const row = b.closest(".cs"); if (!row.offsetParent) return null; const r = b.getBoundingClientRect(), q = row.getBoundingClientRect(); return r.left >= q.left - 1 && (r.right <= q.right + 1 || r.width > q.width - 20); };
    const one = (attr) => { const b = document.querySelector(`#r-chips [${attr}][data-cur]`); return b ? { t: b.textContent, vis: vis(b) } : null; };
    return { topic: one("data-topic"), jump: one("data-jump"), n: document.querySelectorAll("#r-chips [data-cur]").length };
  });

  /* ① 뒤쪽 장으로 내려가면 두 줄 모두 그 장 칩으로 옮겨 간다 */
  const far = ids.find((i) => /제17장 3-1\)/.test(i));
  await goto(far);
  let c = await chips();
  ok(`${name} 범위 칩이 읽는 장을 표시`, c.topic && /제17장/.test(c.topic.t), JSON.stringify(c.topic));
  ok(`${name} 범위 칩이 줄 안에 보임`, c.topic && c.topic.vis === true);
  if (c.jump && c.jump.vis !== null) { ok(`${name} 이동 칩이 읽는 장을 표시`, /제17장/.test(c.jump.t), JSON.stringify(c.jump)); ok(`${name} 이동 칩이 줄 안에 보임`, c.jump.vis === true); }
  ok(`${name} 표시는 줄마다 하나`, c.n === 2, String(c.n));
  /* 칩을 보려고 맨 위로 올라와도 읽던 장이 그대로 표시되고 보인다 */
  await ev(() => window.scrollTo(0, 0)); await sleep(500);
  c = await chips();
  ok(`${name} 맨 위로 올라와도 읽던 장 유지`, c.topic && /제17장/.test(c.topic.t) && c.topic.vis === true, JSON.stringify(c.topic));
  await page.screenshot({ path: `tests/read-focus-${name}-chips.png` });
  await goto(ids.find((i) => /제3장 1\)/.test(i)));
  c = await chips();
  ok(`${name} 앞쪽으로 돌아오면 칩도 따라옴`, c.topic && /제3장/.test(c.topic.t) && c.topic.vis === true, JSON.stringify(c.topic));
  /* 회독 +1(제자리 다시 그리기) 뒤에도 표시가 남는다 */
  await goto(far);
  await page.click(`[id="${far}"] .rc:not(.minus)`); await sleep(500);
  c = await chips();
  ok(`${name} 회독 +1 뒤에도 칩 유지`, c.topic && /제17장/.test(c.topic.t) && c.topic.vis === true, JSON.stringify(c.topic));
  await page.click(`[id="${far}"] .rc.minus`); await sleep(400);

  /* ② 그림: 가리키는 줄 바로 아래 */
  const fig = await ev((id) => {
    const el = document.getElementById(id), f = el.querySelector(".ihf"), img = f && f.querySelector("img");
    return { prev: f && f.previousElementSibling.textContent.slice(-12), ok: !!img && img.complete && img.naturalWidth > 50, cap: f && f.querySelector("figcaption").textContent };
  }, far);
  ok(`${name} 방패 그림이 '(그림 다음 페이지)' 줄 아래`, fig.ok && /그림 다음 페이지\)$/.test(fig.prev), JSON.stringify(fig));
  const emb = ids.find((i) => /표장의 사용.*6\)/.test(i));
  const e6 = await ev((id) => [...document.getElementById(id).querySelectorAll(".ihf")].map((f) => f.querySelectorAll("img").length), emb);
  ok(`${name} 표장 절: 맨 위 그림 3개 + (그림 2) 아래 1개`, e6.join() === "3,1", e6.join());
  const total = await ev(() => ({ figs: document.querySelectorAll("#r-body .ihf img").length, boxes: document.querySelectorAll("#r-body .ihf-box").length }));
  ok(`${name} 그림 12개·박스 14개`, total.figs === 12 && total.boxes === 14, JSON.stringify(total));
  if (total.figs !== 12) console.log(await ev(() => [...document.querySelectorAll('#r-body .art[data-ihf="1"]')].map((e) => e.id.slice(-8) + ":" + e.querySelectorAll(".ihf img").length).join(" ")));
  await goto(emb); await page.screenshot({ path: `tests/read-focus-${name}-fig.png` });

  /* ② 박스: 접혀 있다가 누르면 그 자리에서 원문이 펼쳐진다 */
  const b10 = ids.find((i) => /제10장 2\)/.test(i));
  await goto(b10);
  await page.click(`[id="${b10}"] .ihf-box summary`); await sleep(300);
  const bx = await ev((id) => { const d = document.getElementById(id).querySelector(".ihf-box"); return { open: d.open, t: d.querySelector(".ihf-bb").textContent.slice(0, 20), lines: d.querySelectorAll(".ihf-bb .ln").length }; }, b10);
  ok(`${name} 박스 펼침(억류·구금 부분만)`, bx.open && /^무력충돌 시 발생하는 장기 구금/.test(bx.t) && bx.lines === 3, JSON.stringify(bx));
  await page.screenshot({ path: `tests/read-focus-${name}-box.png` });
  await page.click(`[id="${b10}"] .ihf-box summary`); await sleep(200);
  ok(`${name} 박스 접으면 비움`, (await ev((id) => document.getElementById(id).querySelector(".ihf-bb").childElementCount, b10)) === 0);

  /* 가리기 ③ 에서도 그림 자리는 같다 */
  await ev(() => { const m = document.querySelector("#r-mode"); m.value = "3"; m.dispatchEvent(new Event("change")); }); await sleep(700);
  const f3 = await ev((id) => { const f = document.getElementById(id).querySelector(".ihf"); return f && f.previousElementSibling === document.getElementById(id).querySelectorAll(".ln")[0]; }, far);
  ok(`${name} 가리기 ③ 에서도 같은 줄 아래`, f3 === true);

  /* 다른 규정(주제 단위)도 범위 칩이 따라간다 */
  await ev(() => { const m = document.querySelector("#r-mode"); m.value = "0"; m.dispatchEvent(new Event("change")); R.law = "운영규정"; R.topic = "0"; drawRead(); }); await sleep(1200);
  await ev(() => { const el = document.getElementById("a-운영규정:60"); window.scrollBy(0, el.getBoundingClientRect().top - 150); }); await sleep(700);
  c = await chips();
  ok(`${name} 운영규정 범위 칩 표시·보임`, c.topic && c.topic.vis === true, JSON.stringify(c));
  ok(`${name} 운영규정에는 그림 없음`, (await ev(() => document.querySelectorAll("#r-body .ihf").length)) === 0);
  await page.close();
}
ok("페이지 오류 없음", errors.length === 0, errors.join(" / "));
console.log(res.join("\n"));
await browser.close();
