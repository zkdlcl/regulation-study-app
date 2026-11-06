import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const url=process.env.TEST_URL || 'http://127.0.0.1:8766/index.html';
try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1180,height:960});
  await page.goto(url,{waitUntil:'networkidle0'});
  await page.evaluate(()=>showTab('today'));
  const before=await page.evaluate(()=>JSON.stringify(S));
  const subjects=await page.evaluate(()=>OPStudy.subjects);
  assert.equal(subjects.length,11);
  let total=0;
  for(const law of subjects){
    await page.evaluate(law=>OPStudy.launch(law),law);
    await page.$eval('.om-nav [data-om-view="0"]',e=>e.click());
    const result=await page.evaluate(law=>{
      const m=OPStudy.model(law), expected=D.articles.filter(a=>a.law===law&&a.type==='a');
      return {count:m.count,expected:expected.map(a=>[artId(a),a.title]),actual:m.chapters.flatMap(c=>c.groups.flatMap(g=>g.arts.map(a=>[artId(a),a.title]))),chapters:m.chapters.map(c=>({n:c.n,title:c.title,groups:c.groups.map(g=>g.title)}))};
    },law);
    assert.deepEqual(result.actual,result.expected,law+' 조문·문단 제목 및 순서 일치');
    assert.equal(await page.$$eval('.om-chapter',es=>es.length),result.chapters.length);
    for(const chapter of result.chapters){
      await page.$eval(`.om-nav [data-om-view="${chapter.n}"]`,e=>e.click());
      assert.equal(await page.$eval('.om-root strong',e=>e.textContent),chapter.title);
      const titles=await page.$$eval('.om-art-title',es=>es.map(e=>e.textContent));
      const expected=await page.evaluate(n=>OPStudy.chapters.find(c=>c.n===n).arts.map(a=>a.title),chapter.n);
      assert.deepEqual(titles,expected);
    }
    if(law==='정관') assert.ok(result.chapters[1].groups.includes('제1절 전국대의원총회'));
    if(law==='국제적십자규약') assert.equal(result.chapters[0].title,'전문');
    if(law==='국제인도법') assert.equal(result.chapters[0].title,'머릿글');
    total+=result.count;
    console.log(`PASS ${law}: ${result.chapters.length}개 묶음, ${result.count}개 조문·문단`);
  }
  assert.equal(total,649);
  assert.equal(await page.evaluate(()=>JSON.stringify(S)),before,'모든 지도 열람 시 학습 기록 보존');
  for(const [law,view] of [['조직법',2],['정관',2],['국제인도법',2]]){
    await page.evaluate(law=>OPStudy.launch(law),law);
    await page.$eval(`.om-nav [data-om-view="${view}"]`,e=>e.click());
    await page.screenshot({path:`tests/map-${law}.png`});
  }
  for(const viewport of [{width:820,height:1180},{width:390,height:844}]){
    await page.setViewport(viewport);
    for(const law of subjects){
      await page.evaluate(law=>OPStudy.launch(law),law);
      assert.ok(await page.$eval('#op-map',e=>e.scrollWidth<=e.clientWidth+1),law+' 지도 가로 넘침 없음');
    }
  }
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:'tests/map-all-mobile-dark.png'});
  await page.$eval('[data-om-close]',e=>e.click());
  await page.evaluate(()=>{
    dayIdx=D.days.findIndex(d=>/^조직법/.test(d.title));showTab('today');
    document.querySelector('[data-day="'+dayIdx+'"]').click();
  });
  assert.match(await page.$eval('[data-om-launch]',e=>e.textContent),/조직법/);
  assert.equal(await page.$$eval('#p-today > *',es=>es.length),2);
  assert.equal(await page.$$eval('#p-today .om-task input',es=>es.length),0);
  await page.evaluate(()=>{
    const dates=D.days.map(d=>d.date),schedule=SCHED.map(s=>s.d);
    try {
      D.days.forEach(d=>d.date='2000-01-01');
      SCHED.filter(s=>s.n<=4).forEach(s=>s.d='2000-01-01');SCHED.filter(s=>s.n===5).forEach(s=>s.d='2099-01-01');
      dayIdx=D.days.length-1;renderers.today();
    } finally {D.days.forEach((d,i)=>d.date=dates[i]);SCHED.forEach((s,i)=>s.d=schedule[i]);}
  });
  assert.match(await page.$eval('[data-om-launch]',e=>e.textContent),/보수운영규정/,'일일표 종료 후 다음 스터디 과목 안내(4차 인사관리시행규칙 10/29 이후 → 5차)');
  console.log('PASS 전 과목 648개 항목 보존, 과목별 일일 안내, 모바일·태블릿·다크 화면');

  // 새 브라우저 페이지에서 실패/재시도와 늦게 도착한 응답을 재현한다.
  const retry=await browser.newPage();let fail=true,release;
  await retry.setRequestInterception(true);
  retry.on('request',req=>{
    if(req.url().endsWith('/audit.json')&&fail)req.respond({status:503,body:'unavailable'});
    else if(req.url().endsWith('/personnel.json')){release=()=>req.continue();}
    else req.continue();
  });
  await retry.goto(url,{waitUntil:'load'});
  await retry.evaluate(()=>OPStudy.launch('감사운영규정'));
  assert.ok(await retry.$('[data-om-retry]'));
  fail=false;await retry.$eval('[data-om-retry]',e=>e.click());
  await retry.waitForSelector('.om-chapter');
  await retry.evaluate(()=>{OPStudy.launch('인사관리시행규칙');});
  await retry.waitForFunction(()=>document.querySelector('.om-loading'));
  await retry.evaluate(()=>OPStudy.launch('조직법'));
  assert.match(await retry.$eval('#om-title',e=>e.textContent),/^조직법/);
  await new Promise(r=>setTimeout(r,100));
  assert.ok(release);release();
  await retry.waitForFunction(()=>lawReady('인사관리시행규칙'));
  assert.match(await retry.$eval('#om-title',e=>e.textContent),/^조직법/);
  await retry.$eval('.om-nav [data-om-view="2"]',e=>e.click());
  await retry.$eval('[data-om-read]',e=>e.click());
  assert.equal(await retry.evaluate(()=>R.law),'조직법');
  assert.equal(await retry.$eval('#op-map',e=>e.open),false);
  assert.deepEqual(errors,[]);
  console.log('PASS 로딩 실패·재시도·응답 순서 경합·장 원문 연결');
} finally {await browser.close();}
