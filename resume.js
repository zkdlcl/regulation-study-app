
/* ═══════════════ 진단 기록 + 진행 중 세션 복구 ═══════════════
   폰에서 카드·뻥뚫 도중 화면이 다시 로드되면(앱 전환·키보드·메모리 부족 등) 진행이 사라졌다.
   1) 진단: 부팅·오류·긴 작업·화면 숨김·크기 변화를 기기에 남기고 db 의 diag/<기기> 문서로 올린다(학습 기록 state/progress 와 별개).
      직전 생존 신호(5초마다)를 남겨, 다음 부팅 때 정상 종료(pagehide)였는지 갑자기 끊겼는지 구분한다.
   2) 복구: 진행 중인 복습 카드(Q)·뻥뚫(BT) 상태와 입력 중인 글자를 기기에 저장하고, 20분 안에 다시 열리면 이어서 연다. */
const DIAG = (() => {
  const ls = {
    get(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  };
  let dev = ls.get('diag-dev'); if (!dev){ dev = Math.random().toString(36).slice(2, 10); ls.set('diag-dev', dev); }
  const log = ls.get('diag-log') || [];
  let dirtyN = 0;
  const add = (type, info) => { log.push(Object.assign({t: Date.now(), type}, info || {})); if (log.length > 300) log.splice(0, log.length - 300); ls.set('diag-log', log); dirtyN++; };
  const tab = () => { try { return curTab() || ''; } catch(e){ return ''; } };
  const sess = () => { try { return Q.sess ? 'quiz' : (BT.sess && !BT.done) ? 'bt' : X.sess ? 'exam' : ''; } catch(e){ return ''; } };
  const vw = () => innerWidth + 'x' + innerHeight;
  const hb = ls.get('diag-hb');
  add('boot', hb ? {prev: hb.end ? 'closed' : 'cut', gap: Math.round((Date.now() - hb.t) / 1000), prevTab: hb.tab, prevSess: hb.sess, vw: vw()} : {prev: 'first', vw: vw(), ua: navigator.userAgent.slice(0, 120)});
  let ended = false;   /* pagehide 뒤에 오는 visibilitychange 가 종료 표시를 덮지 않게 */
  const beat = end => { if (end) ended = true; ls.set('diag-hb', {t: Date.now(), tab: tab(), sess: sess(), end: ended}); };
  beat(); setInterval(() => beat(), 5000);
  let doc = null, lastFlush = 0;
  async function flush(force){
    if (!doc || (!dirtyN && !force)) return;
    if (!force && Date.now() - lastFlush < 15000) return;
    lastFlush = Date.now(); const n = dirtyN; dirtyN = 0;
    try { await doc.set({dev, upd: Date.now(), ua: navigator.userAgent.slice(0, 160), log: JSON.stringify(log)}); } catch(e){ dirtyN += n; }
  }
  addEventListener('pageshow', e => { if (e.persisted){ ended = false; add('pageshow', {bf: 1}); beat(); } });
  addEventListener('pagehide', () => { beat(true); add('pagehide', {tab: tab(), sess: sess()}); flush(true); });
  document.addEventListener('visibilitychange', () => {
    const s = document.visibilityState; add('vis', {s, tab: tab(), sess: sess()}); beat();
    if (s === 'hidden') flush(true);
  });
  addEventListener('error', e => add('error', {m: String(e.message || '').slice(0, 200), at: String(e.filename || '').slice(-40) + ':' + e.lineno, st: String((e.error && e.error.stack) || '').slice(0, 500), tab: tab()}));
  addEventListener('unhandledrejection', e => add('reject', {m: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 300), tab: tab()}));
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => add('resize', {vw: vw(), tab: tab(), sess: sess()}), 500); });
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.duration >= 700) add('long', {ms: Math.round(e.duration), tab: tab(), sess: sess()}); })).observe({type: 'longtask'}); } catch(e){}
  setInterval(() => flush(), 60000);
  (async () => {
    try {
      if (!(window.claude && window.claude.use)) return;
      const db = await window.claude.use('db'); if (!db) return;
      doc = db.doc('diag/' + dev); flush(true);
    } catch(e){}
  })();
  return {add, log, flush, dev};
})();

const SNAP = (() => {
  const KEY_S = 'sess-snap', TTL = 20 * 60 * 1000;
  let tm = 0, restoring = false;
  function take(){
    if (restoring) return;
    const s = {t: Date.now()};
    try {
      if (Q.sess && Q.queue[Q.i]){
        const inp = document.getElementById('q-in');
        s.q = {queue: Q.queue, i: Q.i, sess: Q.sess, hist: Q.hist, study: Q.study, retry: Q.retry, tag: Q.tag, group: Q.group, typed: inp ? inp.value : ''};
      }
      if (BT.sess && !BT.done && BT.queue[BT.i]){
        s.bt = {ids: BT.queue.map(artId), laws: [...new Set(BT.queue.map(a => a.law))], i: BT.i, res: BT.res, salts: BT.salts, keeps: BT.keeps || {}, only: BT.only ? Object.fromEntries(Object.entries(BT.only).map(([k, v]) => [k, [...v]])) : null, checked: BT.checked,
          lv: BT.lv, md: BT.md, shuf: BT.shuf, max: BT.max, inputs: [...document.querySelectorAll('#bt-art .bt-in')].map(x => x.value)};
      }
      if (s.q || s.bt) localStorage.setItem(KEY_S, JSON.stringify(s)); else localStorage.removeItem(KEY_S);
    } catch(e){}
  }
  const soon = () => { clearTimeout(tm); tm = setTimeout(take, 300); };
  ['#p-quiz', '#p-bt'].forEach(sel => {
    const p = document.querySelector(sel); if (!p) return;
    p.addEventListener('input', soon); p.addEventListener('click', soon); p.addEventListener('keydown', soon);
  });
  addEventListener('pagehide', take);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') take(); });

  async function restore(){
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY_S) || 'null'); } catch(e){}
    if (!s || Date.now() - s.t > TTL || (Q.sess || BT.sess)) return;
    restoring = true;
    try {
      if (s.q){
        Object.assign(Q, {queue: s.q.queue, i: s.q.i, sess: s.q.sess, hist: s.q.hist || [], study: s.q.study, retry: s.q.retry, tag: s.q.tag, group: s.q.group});
        showTab('quiz'); drawCard();
        const inp = document.getElementById('q-in'); if (inp && s.q.typed) inp.value = s.q.typed;
        DIAG.add('restore', {kind: 'quiz', i: s.q.i, n: s.q.queue.length});
        toast(`복습 카드 ${s.q.i + 1}/${s.q.queue.length} 이어서`);
      } else if (s.bt){
        await Promise.all(s.bt.laws.map(l => lawReady(l) ? null : loadLaw(l)));
        const q = s.bt.ids.map(id => D.articles.find(a => a.type === 'a' && artId(a) === id)).filter(Boolean);
        if (q.length !== s.bt.ids.length) return;
        Object.assign(BT, {queue: q, i: s.bt.i, res: s.bt.res || [], salts: s.bt.salts || {}, keeps: s.bt.keeps || {}, only: s.bt.only ? Object.fromEntries(Object.entries(s.bt.only).map(([k, v]) => [k, new Set(v)])) : null, lv: s.bt.lv, md: s.bt.md, shuf: s.bt.shuf, max: s.bt.max, sess: true, done: false});
        if (s.bt.checked) BT.i++;          /* 채점까지 끝난 조문은 기록이 이미 저장됐다 → 다음 조문부터 */
        showTab('bt'); drawBt();
        if (!s.bt.checked) document.querySelectorAll('#bt-art .bt-in').forEach((x, k) => { if (s.bt.inputs[k]) x.value = s.bt.inputs[k]; });
        DIAG.add('restore', {kind: 'bt', i: BT.i, n: q.length});
        toast(`뻥뚫 ${Math.min(BT.i + 1, q.length)}/${q.length} 이어서`);
      }
    } catch(e){ DIAG.add('error', {m: '복구 실패: ' + String(e.message || e).slice(0, 200)}); }
    finally { restoring = false; take(); }
  }
  /* 첫 화면·서버 동기화가 자리 잡은 뒤 복구한다 */
  setTimeout(restore, 1200);
  return {take, restore};
})();
