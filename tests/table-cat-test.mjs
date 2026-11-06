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

  /* 18번 아래 통상·평균임금 구분: 단계 칩 · 행 펼치기 · 가리고 풀기 · OX · 원문 열기 */
  const wg = (f, ...a) => page.evaluate(f, ...a);
  ok("18번 안 통상·평균임금 구분", await wg(() => !!document.querySelector("#table-18").closest(".tsec").querySelector(".wg")));
  ok("단계 칩 3개·첫 칸 개념", await wg(() => { const c = [...document.querySelectorAll("#p-table [data-wgstep]")]; const v = [...document.querySelectorAll("#p-table [data-wgpane]")].filter((p) => !p.hidden).map((p) => p.dataset.wgpane); return c.length === 3 && JSON.stringify(v) === '["concept"]'; }));
  const concept = await wg(() => document.querySelector('#p-table [data-wgpane="concept"]').textContent);
  ok("개념: 암기 문구·책의상·하명실연", concept.includes("통상은 정·하·명 / 평균 예외는 하·명·실·연 / 지급기준액은 책·의·상 빼기") && concept.includes("책·의·상 = 직책보조비 / 의사 및 약사 등 확보조정비 / 상여수당 월할금액") && concept.includes("3묶음"));
  ok("개념: 설명용 계산 구분 표시", concept.includes("설명용 계산 · 원문 아님"));
  await ev(() => document.querySelector("#p-table .wg").scrollIntoView());
  await page.screenshot({ path: "tests/wage-concept.png" });
  await ev(() => document.querySelector('#p-table [data-wgstep="calc"]').click()); await sleep(150);
  ok("계산 칸으로 전환", await wg(() => !document.querySelector('#p-table [data-wgpane="calc"]').hidden && document.querySelector('#p-table [data-wgpane="concept"]').hidden));
  const calcTxt = await wg(() => document.querySelector('#p-table [data-wgpane="calc"]').textContent);
  ok("계산: 합계 1,050·885·98,333.33원", calcTxt.includes("1,050") && calcTxt.includes("885") && calcTxt.includes("8,850,000원 ÷ 90일 = 1일 약 98,333.33원") && calcTxt.includes("연습용 가정"));
  await ev(() => [...document.querySelectorAll("#p-table [data-wgrow]")].find((b) => b.textContent === "명절상여금").click()); await sleep(100);
  const flow = await wg(() => { const b = [...document.querySelectorAll("#p-table [data-wgrow]")].find((x) => x.textContent === "명절상여금"); const f = b.closest("tr").nextElementSibling; return !f.hidden && b.getAttribute("aria-expanded") === "true" ? f.textContent : ""; });
  ok("명절상여금 행 펼침: 120 → 월 10 → 30", flow.includes("이전 1년 지급액 120만 원 → 12개월로 펴면 월 10만 원 → 3개월에 대응하는 금액은 30만 원 → 평균임금 산정기초에 반영"), flow);
  await ev(() => document.querySelector('#p-table [data-wgpane="calc"]').scrollIntoView());
  await page.screenshot({ path: "tests/wage-calc.png" });
  await ev(() => document.querySelector('#p-table [data-wgstep="quiz"]').click()); await sleep(150);
  ok("가리고 풀기: 7칸 가려짐", await wg(() => { const a = [...document.querySelectorAll('#p-table [data-wgpane="quiz"] [data-wgans]')]; return a.length === 7 && a.every((b) => b.getAttribute("aria-expanded") === "false" && getComputedStyle(b.querySelector(".wg-a")).visibility === "hidden"); }));
  await ev(() => document.querySelectorAll('#p-table [data-wgpane="quiz"] [data-wgans]')[4].click());
  ok("한 칸 펼침: 실적평가급 60", await wg(() => { const b = document.querySelectorAll('#p-table [data-wgpane="quiz"] [data-wgans]')[4]; return b.getAttribute("aria-expanded") === "true" && b.textContent.includes("240 ÷ 12 × 3 = 60"); }));
  await ev(() => document.querySelector("#p-table [data-wgall]").click());
  ok("전부 펼치기", await wg(() => [...document.querySelectorAll('#p-table [data-wgpane="quiz"] [data-wgans]')].every((b) => b.getAttribute("aria-expanded") === "true")));
  await ev(() => { const l = document.querySelectorAll("#p-table .wg-ox"); l[0].querySelector('[data-wgox="O"]').click(); l[1].querySelector('[data-wgox="X"]').click(); });
  ok("OX: 틀림·맞음 표시와 해설", await wg(() => { const l = document.querySelectorAll("#p-table .wg-ox"); return l.length === 3 && l[0].classList.contains("ng") && l[1].classList.contains("ok") && !l[0].querySelector(".wg-oxr").hidden && l[0].textContent.includes("최근 3개월 실제 지급액으로 반영"); }));
  await ev(() => document.querySelector('#p-table [data-wgpane="quiz"]').scrollIntoView());
  await page.screenshot({ path: "tests/wage-quiz.png" });
  await ev(() => document.querySelector('#p-table .wg-ox .kbchip[data-kbart="보수운영규정:3"]').click()); await sleep(400);
  const peek = await wg(() => { const v = [...document.querySelectorAll("body *")].filter((x) => x.offsetParent !== null && /“평균임금”이란/.test(x.textContent) && !x.closest("#p-table")); return v.length > 0; });
  ok("원문 칩 → 제3조 원문 열림", peek);
  await page.screenshot({ path: "tests/wage-peek.png" });
  await page.keyboard.press("Escape"); await sleep(200);
  await ev(() => document.querySelector('#p-table [data-wgstep="concept"]').click());

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
