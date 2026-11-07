import puppeteer from "puppeteer-core";

/* 규정 듣기: 듣기 버튼, 재생, 조문 이동, 배속, 트랙 전환, 이어 듣기, 보고 있는 조문부터 */
const URL = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
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
const vis = (s) => ev((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }, s);
const openLaw = async (law) => { await ev((l) => { R.law = l; R.topic = "0"; showTab("read"); drawRead(); }, law); await sleep(900); };

ok("다른 탭에는 듣기 버튼 없음", !(await vis("#tts-fab")));
await openLaw("운영규정");
ok("음원 없는 규정에는 듣기 버튼 없음", !(await vis("#tts-fab")));
await openLaw("보수운영규정");
ok("보수운영규정에 듣기 버튼", await vis("#tts-fab"));
await page.click("#tts-fab"); await sleep(1500);
ok("재생 시작", await ev(() => !TTS.A.paused && TTS.A.currentTime > 0), await ev(() => TTS.A.currentTime));
ok("플레이어 표시, 듣기 버튼 숨김", (await vis("#tts-bar")) && !(await vis("#tts-fab")));
ok("현재 조문 이름", (await ev(() => document.querySelector("#tts-now").textContent)).length > 0);

const t0 = await ev(() => TTS.A.currentTime);
await page.click('#tts-bar [data-t="next"]'); await sleep(500);
ok("다음 조문 이동", (await ev(() => TTS.A.currentTime)) > t0, await ev(() => document.querySelector("#tts-now").textContent));
await page.click('#tts-bar [data-t="rate"]'); await sleep(100);
ok("배속 변경", (await ev(() => TTS.A.playbackRate)) === 1.25);
await page.click('#tts-bar [data-t="list"]'); await sleep(100);
ok("트랙 칩 11개", (await ev(() => document.querySelectorAll("#tts-list .tts-chip").length)) === 11);
await page.screenshot({ path: "tests/tts-tablet.png" });

await page.click('#tts-list [data-tti="7"]'); await sleep(1500);
ok("Q&A 트랙 전환·재생", await ev(() => TTS.st.ti === 7 && !TTS.A.paused && TTS.A.currentTime > 0));
ok("Q 표시", /^Q\d/.test(await ev(() => document.querySelector("#tts-now").textContent)));
const mark = await ev(() => D.tts["보수운영규정"].tracks[7].marks[1].t);
await page.click('#tts-bar [data-t="next"]'); await sleep(800);
ok("Q 사이 이동", Math.abs((await ev(() => TTS.A.currentTime)) - mark) < 3, mark);
await page.click('#tts-bar [data-t="toggle"]'); await sleep(200);
ok("일시정지", await ev(() => TTS.A.paused));
const pos = await ev(() => JSON.parse(localStorage.getItem("tts-pos"))["보수운영규정"]);
ok("이어 듣기 위치 저장", pos && pos.ti === 7, JSON.stringify(pos));
await page.click('#tts-bar [data-t="close"]'); await sleep(100);
ok("닫기", !(await vis("#tts-bar")) && (await vis("#tts-fab")));

await page.reload({ waitUntil: "load" }); await sleep(600);
await openLaw("보수운영규정");
await page.click("#tts-fab"); await sleep(1800);
ok("새로고침 뒤 이어 듣기(Range 없는 서버 포함)", await ev((p) => TTS.st.ti === 7 && TTS.A.currentTime >= p.t - 1 && !TTS.A.paused, pos), await ev(() => TTS.A.currentTime));

await ev(() => document.getElementById("a-보수운영규정:15").scrollIntoView()); await sleep(200);
await page.click('#tts-bar [data-t="here"]'); await sleep(1800);
ok("보고 있는 조문부터", /제1[45]조|제15조/.test(await ev(() => document.querySelector("#tts-now").textContent)), await ev(() => document.querySelector("#tts-now").textContent));

await ev(() => { TTS.A.currentTime = TTS.A.duration - .3; }); await sleep(1500);
ok("장 끝나면 다음 장", (await ev(() => TTS.st.ti)) === 3, await ev(() => TTS.st.ti));

await ev(() => { document.documentElement.dataset.theme = "dark"; });
await page.setViewport({ width: 390, height: 844 }); await sleep(300);
await page.click('#tts-bar [data-t="list"]'); await sleep(200);
ok("폰 너비 가로 넘침 없음", await ev(() => document.querySelector("#tts-bar").scrollWidth <= innerWidth));
await page.screenshot({ path: "tests/tts-phone.png" });
/* 국제인도법 해설(narration) 시범: 목차·이전/다음 구간 */
await page.setViewport({ width: 1180, height: 820 });
await page.click('#tts-bar [data-t="close"]'); await sleep(100);
await ev(() => localStorage.removeItem("tts-pos"));
await openLaw("국제인도법");
ok("국제인도법 듣기 버튼", await vis("#tts-fab"));
await page.click("#tts-fab"); await sleep(1500);
ok("해설 재생 시작(머릿글 05편부터)", await ev(() => TTS.st.law === "국제인도법" && TTS.st.ti === 0 && !TTS.A.paused && TTS.A.currentTime > 0 && TTS.A.src.endsWith("/ihl/05.mp3")));
await ev(() => { if (!TTS.st.list) TTS.act("list"); }); await sleep(100);
const ORDER = ["05", "01", "02", "03", "06", "07", "08", "09", "10", "11", "12", "13"];
ok("해설 칩만 12개(빈 묶음 숨김)", await ev(() => document.querySelectorAll("#tts-list .tts-chip").length === 12 && document.querySelectorAll("#tts-list .tts-g").length === 1 && document.querySelector("#tts-list .tts-g span").textContent === "해설"));
ok("재생 순서 05→01→02→03→06~13, 파일 구분", await ev((o) => D.tts["국제인도법"].tracks.map((t) => t.file).join() === o.map((n) => `data/tts/ihl/${n}.mp3`).join(), ORDER));
ok("SOURCE 작성분 37절만 목차", await ev(() => D.tts["국제인도법"].tracks.reduce((a, t) => a + t.marks.length, 0) === 37));
const ihl1 = ORDER.indexOf("01");
ok("01편 목차 4구간 시간·제목 유지", JSON.stringify(await ev((i) => D.tts["국제인도법"].tracks[i].marks.map((m) => [m.t, m.label]), ihl1)) === JSON.stringify([[3.79, "국제인도법이 다루는 두 가지"], [176.47, "같은 법을 가리키는 이름들"], [221.11, "제네바법과 헤이그법"], [350.18, "군사적 필요와 인도"]]));
await page.click('#tts-bar [data-t="here"]'); await sleep(300);
ok("해설에서 '보고 있는 조문부터'는 오류 없이 무시", await ev(() => TTS.st.ti === 0));
/* 모든 편: 칩 전환·재생·길이·구간 차례 이동 */
for (let ti = 0; ti < ORDER.length; ti++){
  await ev(() => { if (!TTS.st.list) TTS.act("list"); }); await sleep(100);
  await page.click(`#tts-list [data-tti="${ti}"]`); await sleep(1500);
  const n = ORDER[ti];
  ok(`${n}편 전환·재생`, await ev((ti, n) => TTS.st.ti === ti && !TTS.A.paused && TTS.A.currentTime > 0 && TTS.A.src.endsWith(`/ihl/${n}.mp3`), ti, n));
  ok(`${n}편 길이`, Math.abs((await ev(() => TTS.A.duration)) - (await ev((ti) => D.tts["국제인도법"].tracks[ti].sec, ti))) < 2, await ev(() => TTS.A.duration));
  const ms = await ev((ti) => D.tts["국제인도법"].tracks[ti].marks.map((m) => [m.t, m.label]), ti);
  for (let i = 0; i < ms.length; i++){
    await page.click('#tts-bar [data-t="next"]'); await sleep(900);
    ok(`${n}편 다음 구간 ${i + 1}`, Math.abs((await ev(() => TTS.A.currentTime)) - ms[i][0]) < 2 && (await ev(() => document.querySelector("#tts-now").textContent)) === ms[i][1], await ev(() => TTS.A.currentTime));
  }
  if (n === "01"){
    await ev(() => { TTS.A.currentTime = 380; }); await sleep(600);
    await page.click('#tts-bar [data-t="prev"]'); await sleep(800);
    ok("이전: 현재 구간 처음", Math.abs((await ev(() => TTS.A.currentTime)) - ms[3][0]) < 2);
    await page.click('#tts-bar [data-t="prev"]'); await sleep(800);
    ok("이전: 앞 구간", Math.abs((await ev(() => TTS.A.currentTime)) - ms[2][0]) < 2, await ev(() => document.querySelector("#tts-now").textContent));
    await page.screenshot({ path: "tests/tts-ihl.png" });
  }
}
/* 편 끝 → 다음 편(교재 순서), 첫 구간 '이전' → 앞 편 마지막 구간 */
await page.click(`#tts-list [data-tti="0"]`); await sleep(1500);
await ev(() => { TTS.A.currentTime = TTS.A.duration - .3; }); await sleep(1800);
ok("05편 끝나면 01편", await ev(() => TTS.st.ti === 1 && TTS.A.src.endsWith("/ihl/01.mp3")), await ev(() => TTS.st.ti));
await ev(() => { if (!TTS.st.list) TTS.act("list"); }); await sleep(100);
await page.click(`#tts-list [data-tti="4"]`); await sleep(1500);
await page.click('#tts-bar [data-t="prev"]'); await sleep(1500);
ok("06편 처음에서 이전 → 03편 마지막 구간", await ev(() => TTS.st.ti === 3 && TTS.A.src.endsWith("/ihl/03.mp3")) && Math.abs((await ev(() => TTS.A.currentTime)) - 237.65) < 2, await ev(() => TTS.A.currentTime));
/* 이어 듣기는 파일 기준: 트랙 순서가 바뀌어도 같은 편 */
await page.click(`#tts-list [data-tti="9"]`); await sleep(1500);
await page.click('#tts-bar [data-t="toggle"]'); await sleep(200);
const ip = await ev(() => JSON.parse(localStorage.getItem("tts-pos"))["국제인도법"]);
ok("해설 이어 듣기 위치에 파일 저장", ip && ip.f === "data/tts/ihl/11.mp3", JSON.stringify(ip));
await ev(() => { const s = JSON.parse(localStorage.getItem("tts-pos")); s["국제인도법"].ti = 0; localStorage.setItem("tts-pos", JSON.stringify(s)); });
await page.reload({ waitUntil: "load" }); await sleep(600);
await openLaw("국제인도법");
await page.click("#tts-fab"); await sleep(1800);
ok("순서 번호가 어긋나도 파일로 이어 듣기", await ev(() => TTS.st.ti === 9 && TTS.A.src.endsWith("/ihl/11.mp3")));
for (const [w, h, nm] of [[1180, 820, "tablet"], [820, 1180, "portrait"], [390, 844, "phone"]]){
  for (const th of ["light", "dark"]){
    await ev((th) => { document.documentElement.dataset.theme = th; }, th);
    await page.setViewport({ width: w, height: h }); await sleep(300);
    await ev(() => { if (!TTS.st.list) TTS.act("list"); }); await sleep(150);
    ok(`해설 목록 ${nm}·${th} 가로 넘침 없음`, await ev(() => document.querySelector("#tts-bar").scrollWidth <= innerWidth && document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `tests/tts-ihl-${nm}-${th}.png` });
  }
}

ok("JS 오류 없음", errors.length === 0, errors.join(" | "));
console.log(res.join("\n"));
await browser.close();
