import puppeteer from 'puppeteer-core';

/* 5주차 원본 그림·복수정답·최초 답 표시와 학습 기록 분리를 검증한다. */
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(), errors = [], failures = [];
page.on('pageerror', e => errors.push(e.message));
const ok = (name, value) => { console.log(`${value ? 'PASS' : 'FAIL'}  ${name}`); if (!value) failures.push(name); };
try {
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 700));
  const data = await page.evaluate(() => {
    const es = D.exam.filter(e => e.grp === 'st5');
    const authors = Object.groupBy(es, e => e.area);
    return {
      count: es.length, authors: Object.values(authors).map(x => x.length),
      ids: new Set(es.map(e => e.id)).size,
      clean: es.every(e => !/틀림|정답:|\[image/.test(e.q)),
      choices: es.filter(e => e.kind === 'mc').every(e => /①/.test(e.q) && /②/.test(e.q) && /③/.test(e.q) && /④/.test(e.q)),
      answers: ['st5-구현지-1', 'st5-박준규-7', 'st5-최강락-7', 'st5-신승현-7'].map(id => es.find(e => e.id === id).a).join('|'),
      records: Object.keys(S.ex).filter(id => id.startsWith('st5-')).length,
      imageId: es.filter(e => e.image).map(e => e.id).join(','),
      mine: es.every(e => !!e.my), order: XG.map(g => g[0]).join(','),
    };
  });
  ok('56개 고유 문항·8명 각 7문항', data.count === 56 && data.ids === 56 && data.authors.length === 8 && data.authors.every(n => n === 7));
  ok('출제자 정답·복수정답 전사', data.answers === 'X|⑤|③,④|②');
  ok('지문에 정정 메모·깨진 그림 참조 없음', data.clean);
  ok('객관식 16문항의 보기 누락 없음', data.choices);
  ok('최초 답은 보존하되 풀이 기록은 자동 생성하지 않음', data.mine && data.records === 0);
  ok('문화재 그림이 전권능 5번에만 연결됨', data.imageId === 'st5-전권능-5');
  ok('묶음 순서', data.order.includes('st4,st5,case'));
  await page.evaluate(() => showTab('exam'));
  ok('기출 탭에 5주차 56문항 표시', await page.evaluate(() => [...document.querySelectorAll('#p-exam .pk')].some(el => /5주차/.test(el.textContent) && /56/.test(el.textContent))));
  await page.evaluate(() => {
    X.sess = true; X.done = false; X.queue = [D.exam.find(e => e.id === 'st5-전권능-5')];
    X.i = 0; X.picked = null; X.shown = false; drawX();
  });
  await page.waitForFunction(() => document.querySelector('#p-exam .xq + img')?.naturalWidth > 0);
  for (const [w, h] of [[1180, 820], [820, 1180], [390, 844]]) {
    for (const dark of [false, true]) {
      await page.setViewport({ width: w, height: h });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
      await page.screenshot({ path: `tests/st5-${w}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      ok(`그림·지문 표시 및 가로 넘침 없음 ${w} ${dark ? '다크' : '라이트'}`, await page.evaluate(() => !!document.querySelector('#p-exam .xq + img') && document.documentElement.scrollWidth <= innerWidth));
    }
  }
  await page.evaluate(() => {
    X.queue = [D.exam.find(e => e.id === 'st5-최강락-7')]; X.i = 0; X.picked = null; X.shown = false; drawX();
  });
  ok('채점 전 최초 답 비공개', !(await page.$('.xex')));
  await page.click('[data-xc="③"]');
  await page.click('[data-xc="④"]');
  await page.click('#x-multi');
  ok('③·④ 복수 선택 채점·최초 답 표시', await page.evaluate(() => S.ex['st5-최강락-7']?.last === true && /처음 풀 때 내 답: ③,④/.test(document.querySelector('.xex')?.textContent)));
  ok('브라우저 오류 없음', errors.length === 0);
} finally {
  await browser.close();
}
if (failures.length) process.exitCode = 1;
