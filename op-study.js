/* 전 과목 구조도: 읽기 전 가볍게 보는 안내. 학습 기록에는 쓰지 않는다. */
const OPStudy = (() => {

  const groups = {
    1:[['1','적용과 분류'],['5','용어와 인사체계']],
    2:[['8','임용과 채용'],['10의4','여러 채용 형태'],['11','승진과 제한'],['13','고시와 합격'],['18','임용권과 결격'],['23','수습과 신규임용']],
    3:[['24','보수와 이용 기준']], 4:[['26','교육과 연수'],['27','평정과 포상']],
    5:[['29','직원의 의무'],['37','당직과 출장'],['41','근무시간과 휴일'],['45','휴가의 종류'],['46','휴가 계산과 착임']],
    6:[['50','신분보장과 면직'],['53','휴직 사유·기간·시간 단축'],['55','휴직 효력과 직위해제'],['56','정년과 명예퇴직']],
    7:[['57','징계 사유·종류·효력'],['59','위원회의 관할'],['60','절차·구성·진술'],['63','의결·통고·처분'],['65의2','기록말소'],['66','이의신청과 시말서']]
  };
  const hints = {1:'누구에게 적용하고, 어떤 용어를 쓰는지',2:'어떻게 채용하고, 임용하고, 승진하는지',3:'보수와 시설이용의 기준은 어디에 있는지',4:'교육·연수와 평정·포상은 어디에 있는지',5:'매일 지킬 의무와 출장·근무·휴가는 어디에 있는지',6:'신분보장·휴직·직위해제·정년은 어떻게 나뉘는지',7:'징계 사유·위원회·의결·처분·이의신청은 어디에 있는지'};
  const models = new Map();
  const subjects = LAW_LIST.slice();
  let law = '운영규정', view = 0, forced = null, focusBefore = null, request = 0, phase = 'ready', explicitDay = null;
  function entryNo(a){
    if (law === '국제인도법') return (a.no.match(/(\d+(?:-\d+)?)\)$/) || [])[1] ? '문단 ' + a.no.match(/(\d+(?:-\d+)?)\)$/)[1] : a.no;
    if (law === '유관법령') return (a.no.match(/제\d+조(?:의\d+)?$/) || [a.no])[0];
    return nl(a.no);
  }
  const range = as => {
    if (!as.length) return '';
    if (law === '국제인도법') return as.length+'개 문단';
    return entryNo(as[0])+(as.length > 1 ? '–'+entryNo(as[as.length-1]) : '');
  };
  function model(name){
    if (models.has(name)) return models.get(name);
    if (!lawReady(name)) return null;
    const source = D.articles.filter(a => a.law === name), chapters = [];
    let current = null, section = null;
    for (const a of source){
      if (a.type === 'h' && a.lv === 1){
        current = {n:chapters.length+1,title:a.text,arts:[],sections:[]}; chapters.push(current); section = null;
      } else if (a.type === 'h' && a.lv > 1 && current){
        section = {title:a.text,arts:[]}; current.sections.push(section);
      } else if (a.type === 'a'){
        if (!current){current = {n:1,title:'머리말',arts:[],sections:[]}; chapters.push(current);}
        current.arts.push(a);
        if (!section){ section = {title:'수록 조문',arts:[]}; current.sections.push(section); }
        section.arts.push(a);
      }
    }
    chapters.forEach(c => {
      if (name === '운영규정') c.groups = groups[c.n].map(([start,title],i) => {
        const from = c.arts.findIndex(a => a.no === start);
        const end = i+1 < groups[c.n].length ? c.arts.findIndex(a => a.no === groups[c.n][i+1][0]) : c.arts.length;
        if(from < 0 || end <= from) throw new Error('운영규정 구조도 범위 확인 필요: '+start);
        return {title,arts:c.arts.slice(from,end)};
      });
      else {
        c.groups = [];
        c.sections.filter(s => s.arts.length).forEach(s => {
          // 원문 절 구분은 유지하고, 한 노드에 긴 목록을 몰아 넣지 않는다.
          const title=name==='국제인도법'&&s.title==='수록 조문'?'수록 문단':s.title;
          for(let i=0;i<s.arts.length;i+=6) c.groups.push({title:title+(s.arts.length>6 ? ' · '+(Math.floor(i/6)+1) : ''),arts:s.arts.slice(i,i+6)});
        });
      }
    });
    const result = {law:name,chapters,count:source.filter(a => a.type==='a').length};
    const all = result.chapters.flatMap(c => c.groups.flatMap(g => g.arts));
    if(all.length !== result.count || new Set(all.map(artId)).size !== result.count) throw new Error(name+' 구조도 조문 누락·중복');
    models.set(name,result); return result;
  }
  function daySubjects(text){
    // 긴 이름을 먼저 소비해 '보수운영규정'을 '운영규정'으로 중복 선택하지 않는다.
    let remaining = String(text).replace(/\s+/g,''); const found = [];
    const aliases = {'국제적십자규약':['국제적십자운동규약','국제적십자규약'],'유관법령':['유관법령']};
    [...subjects].sort((a,b)=>b.length-a.length).forEach(name => {
      const options = aliases[name] || [name];
      if(options.some(s => remaining.includes(s))){
        found.push(name); options.forEach(s => { remaining = remaining.split(s).join(''); });
      }
    });
    return subjects.filter(s => found.includes(s));
  }
  function context(){
    const next = SCHED.find(s => s.n && !s.prep && s.d >= todayKey());
    const prep = next ? schedPrep(next).out : [];
    const day = D.days[dayIdx === null ? pickDay() : dayIdx];
    // 일일표의 마지막 날짜가 지나면 자동 선택된 과거 범위 대신 다음 스터디를 따른다.
    // 사용자가 과거 날짜를 직접 골랐을 때는 그날 범위를 유지한다.
    const useDay=day&&(day.date>=todayKey() || explicitDay===dayIdx || !prep.length);
    let names = useDay ? daySubjects(day.title) : [];
    if(!names.length && useDay) names = daySubjects(day.goals.map(g=>g.t).join(' '));
    if(!names.length) names = [...new Set(prep.map(p=>p.law))];
    return names.map(name => ({law:name,topic:(prep.find(p=>p.law===name)||{}).topic || '0'}));
  }
  // 읽기 탭에서 연 경우(forced)는 읽기 범위, 그 밖에는 오늘·다음 스터디의 범위를 따른다.
  const topicOf = name => forced && forced.law === name ? forced.topic : (context().find(p=>p.law===name)||{}).topic || '0';
  function rangeArts(){
    const t = topicOf(law);
    return t === '0' ? [] : D.articles.filter(a => a.law === law && a.type === 'a' && inTopic(a, t));
  }
  function rangeLabel(){
    const t = topicOf(law);
    try { return t[0] === 'g' ? GR(t).label.replace(/^\S+\s/,'').replace(/\s*\(.*$/,'') : D.topics[t] || law; } catch(e){ return law; }
  }
  function wanted(){
    const set = new Set(rangeArts().map(artId));
    return set.size ? model(law).chapters.filter(c => c.arts.some(a => set.has(artId(a)))).map(c => c.n) : [];
  }
  function caption(c){
    if(law === '운영규정') return hints[c.n];
    const sections = c.sections.filter(s=>s.title!=='수록 조문').map(s=>s.title);
    const items = sections.length ? sections : c.arts.map(a=>a.title);
    return items.slice(0,3).join(' · ')+(items.length>3 ? ' …' : '');
  }
  function overview(){
    const m=model(law), selected=wanted(), countLabel=law==='국제인도법' ? '개 문단' : '개 조문';
    return `<div class="om-root"><span class="om-eyebrow">전체 지도</span><strong>${esc(law === '운영규정' ? '직원 운영규정' : law)}</strong><span>${m.chapters.length}개 묶음 · ${m.count}${countLabel}</span></div>
      <div class="om-branches">${m.chapters.map(c=>`<button type="button" class="om-chapter ${selected.includes(c.n)?'om-focus':''}" data-om-view="${c.n}"><div class="om-node-head"><span class="om-number">${String(c.n).padStart(2,'0')}</span>${selected.includes(c.n)?'<span class="om-tag">공부 범위</span>':''}</div><strong>${esc(c.title.replace(/^제\d+장\s*/,''))}</strong><span>${esc(caption(c))}</span><small>${esc(range(c.arts))} · ${c.arts.length}${countLabel} ↗</small></button>`).join('')}</div>
      <p class="om-caption">묶음을 누르면 그 안의 내용이 펼쳐집니다. 전체에서 어디쯤인지 가볍게 살펴보세요.${law === '유관법령' ? ' 유관법령은 앱에 수록된 발췌 조문만 보여 줍니다.' : ''}</p>`;
  }
  const unit = () => law==='국제인도법' ? '개 문단' : '개 조문';
  const entity = (g,arts) => `<section class="om-entity"><div class="om-entity-head"><span class="om-node-dot" aria-hidden="true"></span><h3>${esc(g.title)}</h3><small>${arts.length}${unit()}</small></div><ul>${arts.map(a=>`<li data-map-art="${esc(artId(a))}"><span class="om-art-no">${esc(entryNo(a))}</span><span class="om-art-title">${esc(a.title)}</span></li>`).join('')}</ul></section>`;
  // 오늘 범위: 범위에 든 묶음만 구조도 → 펼치면 상세구조도
  function rangeView(){
    const set=new Set(rangeArts().map(artId)), cs=model(law).chapters.filter(c=>c.arts.some(a=>set.has(artId(a))));
    const open=set.size<=30;
    return `<div class="om-root"><span class="om-eyebrow">오늘 읽을 범위</span><strong>${esc(rangeLabel())}</strong><span>${cs.length}개 묶음 · ${set.size}${unit()}</span></div>
      <div class="om-range">${cs.map((c,i)=>{
        const gs=c.groups.map(g=>[g,g.arts.filter(a=>set.has(artId(a)))]).filter(x=>x[1].length);
        return `<details class="om-rng" ${open||i===0?'open':''}><summary><span class="om-number">${String(c.n).padStart(2,'0')}</span><strong>${esc(c.title.replace(/^제\d+장\s*/,''))}</strong><small>${gs.reduce((n,x)=>n+x[1].length,0)}${unit()}</small></summary><div class="om-entities">${gs.map(x=>entity(x[0],x[1])).join('')}</div></details>`;}).join('')}</div>
      <p class="om-caption">묶음을 누르면 상세 구조(조문·문단 목록)가 접히고 펼쳐집니다. 선은 포함 관계일 뿐 절차의 선후가 아닙니다.</p>`;
  }
  function detail(){
    const c=model(law).chapters.find(c=>c.n===view);
    return `<div class="om-root"><span class="om-eyebrow">묶음 안의 지도</span><strong>${esc(c.title)}</strong><span>${esc(caption(c))}</span></div>
      <div class="om-entities">${c.groups.map(g=>entity(g,g.arts)).join('')}</div>
      <p class="om-caption">조문·문단 제목은 수록된 원문에서 가져왔습니다. 선은 내용의 포함 관계를 뜻하며, 법적 절차나 선후 요건을 뜻하지 않습니다. 별표·부록은 원문 회독에서 확인하세요.</p>`;
  }
  function draw(){
    const dialog=document.getElementById('op-map'), m=model(law), current=m&&m.chapters.find(c=>c.n===view);
    const sc=['.om-laws','.om-nav'].map(q=>{const e=dialog.querySelector(q);return e?e.scrollLeft:0;});
    const hasRange=!!m&&rangeArts().length>0;
    const target=view===-1 ? 0 : view===0 ? wanted()[0] || 1 : view < (m?m.chapters.length:0) ? view+1 : 0;
    const next=m&&m.chapters.find(c=>c.n===target);
    dialog.innerHTML=`<div class="om-shell"><div class="om-header"><div><span class="om-eyebrow">공부 전, 큰 틀만</span><h2 id="om-title">${esc(law)} 한눈에</h2></div><button type="button" class="om-close" data-om-close aria-label="구조도 닫기">✕</button></div><p class="om-intro">전체 구조를 보고, 오늘 읽을 부분의 위치만 잡아보세요.</p>
      <div class="om-sticky"><nav class="om-laws" aria-label="구조도 과목">${subjects.map(s=>`<button type="button" data-om-law="${esc(s)}" aria-pressed="${law===s}">${esc(s)}</button>`).join('')}</nav>
      ${phase==='loading'?'<div class="om-loading" role="status">원문 목차를 불러오는 중…</div>':phase==='error'?'<div class="om-loading" role="alert">목차를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.<br><button type="button" class="b-line" data-om-retry>다시 시도</button></div>':`
      <nav class="om-nav ${m.chapters.length>10?'om-many':''}" aria-label="구조도 범위">${hasRange?`<button type="button" class="om-today" data-om-view="-1" aria-pressed="${view===-1}">오늘 범위</button>`:''}<button type="button" data-om-view="0" aria-pressed="${view===0}">전체 구조</button>${m.chapters.map(c=>`<button type="button" data-om-view="${c.n}" aria-pressed="${view===c.n}" title="${esc(c.title)}">${esc(c.title)}</button>`).join('')}</nav></div>
      <div class="om-canvas">${current?detail():view===-1&&hasRange?rangeView():overview()}</div><div class="om-footer"><button type="button" class="b-line" data-om-view="${target}">${view===0?'이어서 · '+(next?next.title:'전체 구조'):next?'다음 묶음 보기':'전체 구조 보기'}</button><button type="button" class="b-red" data-om-read>이제 원문 읽기</button></div>`}</div>`;
    dialog.scrollTop=0;
    // 다시 그려도 칩 줄의 가로 위치를 유지하고, 선택한 칩을 가운데로 — 매번 옆으로 끌지 않게
    dialog.querySelectorAll('.om-laws,.om-nav').forEach((nav,i)=>{
      const on=nav.querySelector('[aria-pressed=true]');
      nav.scrollLeft=sc[i]||0;
      if(on){const x=on.offsetLeft-(nav.clientWidth-on.offsetWidth)/2;nav.scrollLeft=Math.max(0,x);}
    });
  }
  function close(){document.getElementById('op-map').close();}
  async function select(name){
    if(!subjects.includes(name)) return;
    law=name;view=topicOf(name)!=='0'?-1:0;phase='loading';const token=++request;draw();
    try {
      await loadLaw(name);
      if(token!==request || !document.getElementById('op-map').open) return;
      model(name);phase='ready';draw();
    } catch(e){if(token===request && document.getElementById('op-map').open){phase='error';draw();}}
  }
  async function launch(name,topic){
    forced = name && topic ? {law:name,topic:String(topic)} : null;
    let dialog=document.getElementById('op-map');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='op-map';dialog.setAttribute('aria-labelledby','om-title');document.body.appendChild(dialog);
      dialog.addEventListener('close',()=>{request++;if(focusBefore&&focusBefore.isConnected)focusBefore.focus({preventScroll:true});});
      dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
    }
    if(!dialog.open){focusBefore=document.activeElement;dialog.showModal();}
    await select(name || (context()[0]||{law:'조직법'}).law);
  }
  function attach(){
    const scopes=context(); if(!scopes.length)return;
    const first=document.querySelector('#p-today .td-r input[data-chk]'),card=first&&first.closest('.card');
    if(!card || card.querySelector('[data-om-launch]'))return;
    const row=document.createElement('div');row.className='om-task';
    row.innerHTML=`<span class="om-task-icon" aria-hidden="true">🗺</span><div><span class="om-eyebrow">시작 전에 · 선택 안내</span><button type="button" data-om-launch>${esc(scopes.map(s=>s.law).join('·'))} 큰 틀 먼저 보기 ↗</button><small>구조도만 가볍게 보고, 아래 할 일을 이어가세요.</small></div>`;
    card.insertBefore(row,first.closest('.goal, .check'));
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#p-today [data-day]');if(b)explicitDay=+b.dataset.day;
  },true);
  document.addEventListener('click',e=>{
    const rng=e.target.closest('[data-om-range]');if(rng){launch(R.law,R.topic);return;}
    const global=e.target.closest('[data-om-global]');if(global){launch();return;}
    if(e.target.closest('[data-om-launch]')){launch();return;}
    const b=e.target.closest('#op-map button');if(!b)return;
    if(b.hasAttribute('data-om-close')){close();return;}
    if(b.hasAttribute('data-om-law')){select(b.dataset.omLaw);return;}
    if(b.hasAttribute('data-om-retry')){select(law);return;}
    if(b.hasAttribute('data-om-view')){view=+b.dataset.omView;draw();document.querySelector('#op-map [data-om-view="'+view+'"]').focus({preventScroll:true});return;}
    if(b.hasAttribute('data-om-read')){
      const topic=view<=0?topicOf(law):'0',art=view>0?model(law).chapters.find(c=>c.n===view).arts[0]:null;
      close();R.law=law;R.topic=topic;showTab('read');if(art)goRef('a|'+artId(art));
    }
  });
  // 읽기 탭: 읽기 전에 지금 범위의 구조도·상세구조도를 본다
  function attachRead(){
    const seg=document.querySelector('#r-today'); if(!seg||document.querySelector('[data-om-range]'))return;
    const b=document.createElement('button');b.type='button';b.setAttribute('data-om-range','');b.setAttribute('aria-label','이 범위 구조도 보기');b.title='이 범위 구조도';
    b.innerHTML=globalIcon+'<span>범위 구조도</span>';seg.after(b);
    // '오늘 범위' 버튼은 범위 칩 줄과 겹쳐서 뺀다(사용자 요청)
    seg.remove();
  }
  const today=renderers.today;
  renderers.today=function(){today.apply(this,arguments);attach();};
  // 어느 탭에 있든, 오늘의 과목과 무관하게 전체 지도를 열 수 있다.
  const globalIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/></svg>';
  const readDraw=drawRead;drawRead=function(){readDraw.apply(this,arguments);try{attachRead();}catch(e){}};
  try{attachRead();}catch(e){}
  const globalButton=document.createElement('button');globalButton.type='button';globalButton.className='om-global';
  globalButton.setAttribute('data-om-global','');globalButton.setAttribute('aria-label','전체 과목 구조도 열기');
  globalButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/></svg><span>구조도</span>';
  document.querySelector('#tabs [data-id="read"]').after(globalButton);
  return {subjects,model,launch,get chapters(){return (model(law)||{chapters:[]}).chapters;}};
})();
