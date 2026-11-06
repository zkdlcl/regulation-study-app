import puppeteer from "puppeteer-core";

/* 대조·숫자: 규정별 칩·주체 표 빈칸·암기 그림·과제 이동 시 숨은 표 열기·화면 캡처 */
const URL = process.env.TEST_URL || "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const res = [], errors = [];
const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"}  ${n} ${x}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1180, height: 820 });
  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("om-tcat"));
  await page.reload({ waitUntil: "load" }); await sleep(600);
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const shown = () => ev(() => [...document.querySelectorAll("#p-table .tsec:not([hidden]) h3")].map((h) => h.id));
  const snapshot = await ev(() => JSON.stringify(S));

  await ev(() => showTab("table")); await sleep(300);
  ok("칩 7개", (await ev(() => document.querySelectorAll("#p-table .tchips [data-tcat]").length)) === 7);
  ok("기본 전체 18개 표", (await shown()).length === 18);
  ok("백지 복원 맨 끝", (await shown()).at(-1) === "table-14");

  await ev(() => document.querySelector('[data-tcat="subj"]').click());
  const subj = await shown();
  ok("주체 칩: 2·8·15·16·17 + 백지", JSON.stringify(subj) === JSON.stringify(["table-2", "table-8", "table-15", "table-16", "table-17", "table-14"]), subj.join(","));
  ok("칩 aria-pressed", await ev(() => document.querySelector('[data-tcat="subj"]').getAttribute("aria-pressed") === "true"));
  await page.screenshot({ path: "tests/table-cat-subj.png" });

  await ev(() => document.querySelector('[data-tcat="pay"]').click());
  ok("보수 칩: 15·18 + 백지", JSON.stringify(await shown()) === JSON.stringify(["table-15", "table-18", "table-14"]));
  const blank = await ev(() => { const b = [...document.querySelectorAll("#table-15 ~ .tw .bk")]; return { n: b.length, first: b[0] && b[0].textContent }; });
  ok("보수 주체 빈칸 17칸 이상", blank.n >= 17, JSON.stringify(blank));
  await ev(() => { document.querySelector("#p-table .mnemo summary").click(); });
  await sleep(300);
  const img = await ev(() => { const i = document.querySelector("#p-table .mnemo img"); return i && i.complete && i.naturalWidth; });
  ok("암기 그림 열림", img > 0, img);
  await page.screenshot({ path: "tests/table-cat-pay.png" });

  await ev(() => document.querySelector("#p-table #hideall").click());
  ok("가리기 후 빈칸 가려짐", await ev(() => document.querySelector("#p-table").classList.contains("hideall")));
  await ev(() => document.querySelector("#p-table #hideall").click());

  await page.reload({ waitUntil: "load" }); await sleep(600);
  await ev(() => showTab("table")); await sleep(300);
  ok("고른 칩 기억", await ev(() => document.querySelector("#p-table").dataset.tview === "pay"));

  await ev(() => { const i = D.days.findIndex((d) => d.date === "2026-10-18"); goalNav("d" + i + ".2"); });
  await page.waitForFunction(() => document.activeElement.id === "table-10", { timeout: 3000 }).catch(() => {});
  ok("숨은 표로 가는 과제 → 전체로 바뀌고 10번 표", await ev(() => document.activeElement.id === "table-10" && document.querySelector("#p-table").dataset.tview === "all"));

  for (const [w, h, n] of [[820, 1180, "port"], [390, 844, "phone"]]) {
    await page.setViewport({ width: w, height: h });
    await ev(() => document.querySelector('[data-tcat="fin"]').click()); await sleep(200);
    ok(`${n} 가로 넘침 없음`, await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ev(() => document.getElementById("table-16").scrollIntoView());
    await page.screenshot({ path: `tests/table-cat-fin-${n}.png` });
  }
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await ev(() => document.querySelector('[data-tcat="aud"]').click()); await sleep(200);
  await ev(() => document.getElementById("table-17").scrollIntoView());
  await page.screenshot({ path: "tests/table-cat-aud-dark.png" });

  ok("학습 기록 그대로", (await ev(() => JSON.stringify(S))) === snapshot);
  ok("페이지 오류 없음", errors.length === 0, errors.join(" | "));
} finally { await browser.close(); }
console.log(res.join("\n"));
