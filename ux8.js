
/* ═════════ ux8 · 3시간 사용 피드백 (docs/개선요청-2026-10-18.md) ═════════ */

/* ── 회독: 범위의 '지금 회독' = 가장 적게 읽은 조문의 회독 수 + 1 (1회독 끝나면 2회독으로 이어짐) ── */
function readRound(list){ return list.length ? Math.min(...list.map(a => S.reads[artId(a)] || 0)) + 1 : 1; }
resumeTarget = function(){
  const c = candArts(); if (!c.length) return null;
  const cnt = a => S.reads[artId(a)] || 0;
  const m = readRound(c) - 1, mx = Math.max(...c.map(cnt));
  const un = a => cnt(a) <= m;
  /* 범위 안에 회독 수가 섞여 있으면(중간에 2회독이 끼어 있어도) 읽어야 할 범위의 맨 처음으로 간다 */
  if (mx > m) return c.find(un) || null;
  /* 회독 수가 모두 같으면 마지막으로 읽은 조문의 다음으로 간다 (끝이면 처음으로) */
  const last = S.rd && S.rd.last && S.rd.last[R.law];
  const i = c.findIndex(a => artId(a) === last);
  return c.slice(i + 1).find(un) || c.find(un) || null;
};

/* ── 탭을 옮겨도 진행 중인 복습 카드·뻥뚫·기출 화면은 다시 그리지 않는다 (입력·정답 공개·무작위 빈칸 유지) ── */
const KEEP_TAB = {quiz: () => !!Q.sess, bt: () => BT.sess, exam: () => X.sess};
const TAB_Y = {};
const curTab = () => (TABS.find(t => { const p = document.getElementById('p-' + t[0]); return p && p.classList.contains('on'); }) || [])[0];
const _showTab8 = showTab;
showTab = function(id){
  const cur = curTab(); if (cur) TAB_Y[cur] = window.scrollY;
  const p = document.getElementById('p-' + id);
  if (!(KEEP_TAB[id] && KEEP_TAB[id]() && p && p.childElementCount)) return _showTab8(id);
  const r = renderers[id]; renderers[id] = null;
  try { _showTab8(id); } finally { renderers[id] = r; }
  window.scrollTo(0, TAB_Y[id] || 0);
};

/* ── 뻥뚫 ── */
/* 빈칸마다 조문 안 순번(data-k)을 붙여 '틀린 칸만 다시'에 쓴다. 화면 키보드 숨김이면 inputmode=none */
btBuild = function(a){
  const root = document.createElement('div'); root.innerHTML = a.html;
  $$('.b', root).forEach(b => {
    const t = b.classList.contains('b1') ? 1 : b.classList.contains('b2') ? 2 : 0;
    const keep = BT.lv === 1 ? t === 1 : BT.lv === 2 ? t > 0 : false;
    if (!keep) b.replaceWith(document.createTextNode(b.textContent));
  });
  root.normalize();
  if (BT.lv === 3){ const id = artId(a); CZ_SALT = BT.shuf ? (BT.salts[id] = BT.salts[id] || Math.random().toString(36).slice(2, 7)) : ''; try { clozeIn(root); } finally { CZ_SALT = ''; } }
  let bl = $$('.b', root), keep = null;
  const only = BT.only && BT.only[artId(a)];
  if (only) keep = only;
  else if (BT.max > 0 && bl.length > BT.max){
    /* 고른 칸은 세션 동안 조문별로 기억한다 — 다시 그리거나 복구해도 같은 칸 */
    const id = artId(a), prev = (BT.keeps = BT.keeps || {})[id];
    keep = new Set(prev && prev.length === BT.max && prev.every(i => i < bl.length) ? prev : (BT.keeps[id] = btShuffle(bl.map((_, i) => i)).slice(0, BT.max)));
  }
  bl.forEach((b, i) => { b.dataset.k = i; });
  if (keep){ bl.forEach((b, i) => { if (!keep.has(i)) b.replaceWith(document.createTextNode(b.textContent)); }); bl = bl.filter((_, i) => keep.has(i)); }
  bl.forEach(b => {
    const ans = b.textContent, n = [...ans].length;
    if (BT.md === 'type'){
      const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'bt-in'; inp.dataset.ans = ans; inp.dataset.k = b.dataset.k;
      inp.style.width = Math.max(3.4, n * 1.05 + 1.6) + 'em'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', '빈칸');
      if (!S.btkb) inp.inputMode = 'none';
      if (BT.ch) inp.placeholder = czCho(ans);
      b.replaceWith(inp);
    } else {
      const s = document.createElement('span'); s.className = 'bt-tap'; s.dataset.ans = ans; s.dataset.k = b.dataset.k; s.textContent = ans; b.replaceWith(s);
    }
  });
  return root;
};
btCheck = function(){
  if (BT.checked) return;
  const ae = document.activeElement; if (ae && ae.blur) ae.blur();       /* 포커스된 칸이 disabled 되며 선택 영역이 남던 문제 */
  const ins = $$('#bt-art .bt-in'); let ok = 0; const miss = [];
  ins.forEach(inp => {
    const good = btNorm(inp.value) === btNorm(inp.dataset.ans);
    inp.classList.add(good ? 'ok' : 'no'); inp.disabled = true;
    if (good) ok++; else { miss.push(+inp.dataset.k); const fx = document.createElement('span'); fx.className = 'bt-fix'; fx.textContent = inp.dataset.ans; inp.after(fx); }
  });
  const sel = getSelection(); if (sel) sel.removeAllRanges();
  $('#bt-res').innerHTML = `<div class="${ok === ins.length ? 'note' : 'xex'}"><b>${ok} / ${ins.length}</b> ${ok === ins.length ? '모두 맞혔습니다 ✅' : '· 틀린 칸의 정답을 초록색으로 표시했습니다.'}</div>`;
  BT.miss = miss; btRecord(ok, ins.length);
};
const _btRecord8 = btRecord;
btRecord = function(ok, tot){
  const id = artId(BT.queue[BT.i]);
  _btRecord8(ok, tot);
  const r = BT.res[BT.res.length - 1];
  r.miss = BT.miss || $$('#bt-art [data-ans]').map(x => +x.dataset.k); BT.miss = null;
  /* 뻥뚫로 푼 조문은 회독 +1 (같은 날 같은 조문은 한 번) */
  S.btRd = S.btRd || {}; const tk = todayKey();
  if (S.btRd[id] !== tk){ S.btRd[id] = tk; S.reads[id] = (S.reads[id] || 0) + 1; save(); }
  const nx = $('#bt-next'); if (nx) nx.focus({preventScroll: true});   /* Enter = 다음 조문 */
};
/* 틀린 조문만 다시 → 그때 틀린 칸만 빈칸으로 */
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest || !t.closest('#p-bt')) return;
  if (t.id === 'bt-retry'){ BT.only = {}; BT.res.filter(r => r.ok < r.tot).forEach(r => { BT.only[r.id] = new Set(r.miss || []); }); }
  else if (t.id === 'bt-home' || t.id === 'bt-start'){ BT.only = null; BT.salts = {}; BT.keeps = {}; }
}, true);
/* 처음 열고 Tab → 첫 빈칸 */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.shiftKey || !$('#p-bt').classList.contains('on') || !BT.sess || BT.done || BT.checked) return;
  if (e.target.closest && e.target.closest('#bt-art')){
    /* 마지막 빈칸에서 Tab → 초성 힌트를 건너뛰고 채점 버튼 (Enter/Space 로 바로 채점) */
    const ins = $$('#bt-art .bt-in'), ck = $('#bt-check');
    if (ck && ins.length && e.target === ins[ins.length - 1]){ e.preventDefault(); ck.focus(); }
    return;
  }
  const ins = $$('#bt-art .bt-in'), f = ins.find(i => !i.value) || ins[0]; if (!f) return;
  e.preventDefault(); f.focus();
});

/* 범위: 스터디 1회독 차수(1~8차) 박스 → 여러 법령이면 법령 칩 → 장·절은 select */
const BT_UNITS = SCHED.filter(s => s.n && s.n <= 8).map(s => { const o = schedPrep(s).out; return {n: s.n, d: s.d, k: s.k, laws: [...new Set(o.map(x => x.law))], topic: o[0] ? o[0].topic : '0'}; });
const btUnit = () => {
  const u = BT_UNITS.find(x => x.n === S.btunit);
  if (u && u.laws.includes(BT.law) && (BT.law !== '운영규정' || BT.topic === '0' || btTopicIn(u, BT.topic))) return u;
  return BT_UNITS.find(x => x.laws.includes(BT.law) && (BT.law !== '운영규정' || btTopicIn(x, BT.topic))) || BT_UNITS.find(x => x.laws.includes(BT.law)) || null;
};
function btTopicIn(u, t){ if (t === u.topic) return true; const g = GR(u.topic); return !!(g && /^\d+$/.test(t) && g.topics.includes(+t)); }
function btUnitOpts(u, law){
  if (law === '운영규정' && GR(u.topic)){
    const g = GR(u.topic);
    return [{v: g.id, l: g.label.replace(/^\S+\s/, '').replace(/\s*\(.*$/, '') + ' 전체'}].concat(g.topics.map(k => ({v: String(k), l: topicShort(k)})));
  }
  return btTopics(law).filter(t => !t.g);
}
function btUnitProg(u){
  let tot = 0, done = 0;
  u.laws.forEach(l => {
    const ix = LAW_INDEX.find(x => x.law === l);
    if (lawReady(l)){
      const as = D.articles.filter(a => a.type === 'a' && a.law === l && (l !== '운영규정' || inTopic(a, u.topic)));
      tot += as.length; done += as.filter(a => btRec(artId(a))).length;
    } else if (ix){ tot += ix.count; done += Object.keys(S.bt || {}).filter(k => k.startsWith(l + ':')).length; }
  });
  return {tot, done};
}
const _drawBtHome8 = drawBtHome;
drawBtHome = function(){
  _drawBtHome8();
  const p = $('#p-bt'), seg = $('.seg-scroll', p); if (!seg) return;         /* 불러오는 중 화면 */
  const u = btUnit(), nx = SCHED.find(s => s.n && !s.prep && s.d >= todayKey());
  seg.outerHTML = `<div class="bt-units">${BT_UNITS.map(x => { const pr = btUnitProg(x);
    return `<button class="bt-u${nx && nx.n === x.n ? ' next' : ''}" data-btu="${x.n}" aria-pressed="${!!(u && u.n === x.n)}"><span class="bt-u-h"><b>${x.n}차</b><span class="mute small">${fmtD(x.d)}</span></span><span class="bt-u-k">${esc(x.k)}</span><span class="bt-u-p"><span class="bar"><i style="width:${pct(pr.done, pr.tot)}%"></i></span><span class="mute small">${pr.done}/${pr.tot}</span></span></button>`; }).join('')}</div>`;
  const row = $('[data-btt]', p) && $('[data-btt]', p).closest('.cs-row');
  if (row && u){
    const laws = u.laws.length > 1 ? `<div class="cs">${u.laws.map(l => `<button data-bl="${esc(l)}" aria-pressed="${BT.law === l}">${esc(l)}</button>`).join('')}</div>` : '';
    const opts = btUnitOpts(u, BT.law);
    row.innerHTML = `<span class="cs-lab">범위</span><div class="bt-scope">${laws}<select id="bt-sel" data-csel="native" aria-label="장·절">${opts.map(o => `<option value="${esc(o.v)}" ${o.v === BT.topic ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>`;
  }
  const mdRow = $('[data-md]', p) && $('[data-md]', p).closest('.cs-row');
  if (mdRow && BT.md === 'type') mdRow.insertAdjacentHTML('afterend', `<div class="cs-row"><span class="cs-lab">화면 키보드</span><div class="cs">${[[0, '숨김 (블루투스 키보드)'], [1, '보이기']].map(m => `<button data-btkb="${m[0]}" aria-pressed="${(S.btkb || 0) === m[0]}">${m[1]}</button>`).join('')}</div></div>`);
};
$('#p-bt').addEventListener('click', e => {
  const u = e.target.closest('[data-btu]');
  if (u){ const x = BT_UNITS.find(z => z.n === +u.dataset.btu); S.btunit = x.n; BT.law = x.laws.includes(BT.law) ? BT.law : x.laws[0]; BT.topic = BT.law === '운영규정' ? x.topic : '0'; btPrefs(); drawBtHome(); return; }
  const k = e.target.closest('[data-btkb]'); if (k){ S.btkb = +k.dataset.btkb; save(); drawBtHome(); }
});
$('#p-bt').addEventListener('change', e => { if (e.target.id === 'bt-sel'){ BT.topic = e.target.value; btPrefs(); drawBtHome(); } });

/* ── 오늘: 목표 글자를 누르면 그 화면으로, 체크는 체크박스로만 ── */
const _todayEnh8 = todayEnhance;
todayEnhance = function(){ _todayEnh8(); try { goalRows(); } catch(e){ console.warn(e); } };
function goalRows(){
  $$('#p-today label.check').forEach(lab => {
    const inp = $('input[data-chk]', lab), sp = $(':scope > span', lab); if (!inp || !sp) return;
    const row = document.createElement('div'); row.className = lab.className + ' goal';
    const ck = document.createElement('label'); ck.className = 'goal-ck'; ck.setAttribute('aria-label', '완료 표시'); ck.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'goal-t'; b.dataset.goal = inp.dataset.chk; b.innerHTML = sp.innerHTML;
    if (inp.checked) row.classList.add('done');
    row.append(ck, b); lab.replaceWith(row);
  });
}
function goalNav(key){
  const [i, j] = key.slice(1).split('.').map(Number), d = D.days[i], g = d && d.goals[j]; if (!g) return;
  if(g.table){
    showTab('table');
    requestAnimationFrame(()=>{
      if(!$('#p-table').classList.contains('on'))return;
      if(typeof tcatReveal==='function')tcatReveal(g.table);
      const target=document.getElementById('table-'+g.table);if(!target)return;
      $$('#p-table .table-target').forEach(el=>el.classList.remove('table-target'));
      target.classList.add('table-target');target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
    });
    return;
  }
  if (g.go){   /* plan-gen.js 가 만든 과제: 규정·탭을 직접 지정 */
    if (g.go === 'bt' && g.law){ BT.law = g.law; BT.topic = '0'; }
    if (g.go === 'read' && g.law){ R.law = g.law; R.topic = '0'; saveRd(); }
    return showTab(g.go);
  }
  const t = g.t.replace(/<[^>]+>/g, ''), title = d.title;
  const law = (t.match(/조직법|정관|운영규정/) || [])[0] || (/운영규정/.test(title) ? '운영규정' : /^정관/.test(title) ? '정관' : '조직법');
  const toRead = ref => { R.law = law; R.topic = '0'; saveRd(); showTab('read'); if (ref) setTimeout(() => goRef(ref), 80); };
  let m;
  if (/🧠|카드/.test(t)){
    if (!Q.sess){
      const tm = t.match(/([\d·~,\s]+)번\s*주제/), nums = [];
      if (tm) tm[1].split(/[·,\s]+/).filter(Boolean).forEach(x => { const r = x.split('~').map(Number); for (let n = r[0]; n <= (r[1] || r[0]); n++) nums.push(n); });
      if (nums.length){ Q.group = 'all'; Q.topics = new Set(nums); }
    }
    return showTab('quiz');
  }
  if (/📊/.test(t) || (/표/.test(t) && !/별표/.test(t))) return showTab('table');
  if (/💬/.test(t)) return showTab('ask');
  if (/🔬/.test(t)) return showTab('lab');
  /* '별표 제1~6호'처럼 '조' 없이 별표만 있는 목표는 조문(제1조)이 아니라 별표로 간다 */
  const bno = x => { const b = x.match(/(인사서식|별표)\s*제?\s*(\d+)(?:\s*호?\s*의\s*(\d+))?/); return b && (b[1] === '인사서식' ? '서' : '') + b[2] + (b[3] ? '의' + b[3] : ''); };
  if (!/제\s*\d+조/.test(t) && (m = bno(t))) return toRead('b|' + law + ':' + m);
  if ((m = t.match(/제(\d+)(?:조의(\d+))?(?:[~·]\d+)*조?/))) return toRead('a|' + law + ':' + m[1] + (m[2] ? '의' + m[2] : ''));
  if ((m = bno(t))) return toRead('b|' + law + ':' + m);
  if (/기출|문항/.test(t)) return showTab('exam');
  toRead(null);
}
$('#p-today').addEventListener('click', e => { const b = e.target.closest('[data-goal]'); if (b) goalNav(b.dataset.goal); });

/* ── 스터디 3주차 문제 묶음(전권능) ── */
if (!XG.some(g => g[0] === "st3")) XG.splice(2, 0, ["st3", "📕 스터디 3주차 · 운영규정 6~7장 문제"]);
if (!XG.some(g => g[0] === "st4")) XG.splice(XG.findIndex(g => g[0] === "st3") + 1, 0, ["st4", "📕 스터디 4주차 · 보수운영규정 문제"]);
if (!XG.some(g => g[0] === "st5")) XG.splice(XG.findIndex(g => g[0] === "st4") + 1, 0, ["st5", "📕 스터디 5주차 · 국제인도법 문제"]);

/* 원본에 그림이 포함된 문제: 지문 아래 표시한다. 최초 답은 해설에서만 보인다. */
const _drawXStudyImage = drawX;
drawX = function(){
  _drawXStudyImage();
  const e = !X.done && X.queue[X.i], q = $('#p-exam .xq');
  if (!e || !e.image || !q) return;
  const img = document.createElement('img');
  img.src = e.image; img.alt = e.imageAlt || '문제 원본 그림';
  img.style.cssText = 'display:block;max-width:100%;height:auto;margin:12px 0';
  q.after(img);
};

/* ── 헤더 통합 검색 (탭 목록의 검색 대신) ── */
(function(){
  const hd = $('.hd'); if (!hd || $('#gsearch')) return;
  const wrap = document.createElement('label'); wrap.className = 'gs';
  wrap.innerHTML = '<span class="gs-ic" aria-hidden="true">🔍</span><input id="gsearch" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="통합검색" aria-label="통합 검색">';
  hd.querySelector('h1').after(wrap);
  const inp = $('#gsearch'); let tm = 0;
  const run = () => {
    F.q = inp.value;
    if (curTab() !== 'find') showTab('find');
    const fq = $('#f-q'); if (fq) fq.value = F.q;
    clearTimeout(tm); tm = setTimeout(findRun, 150);
  };
  inp.addEventListener('input', run);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); run(); } else if (e.key === 'Escape') inp.blur(); });
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'))) return;
    e.preventDefault(); inp.focus(); inp.select();
  });
})();
const _rFind8 = renderers.find;
renderers.find = function(){ const g = $('#gsearch'); if (g && g.value !== F.q) g.value = F.q; _rFind8(); };

/* ── 복습 카드: 질문 위에 규정·조문 제목, 답의 출처 조문은 눌러서 원문 패널 ── */
const LAW_RX = new RegExp('^(' + LAW_LIST.join('|') + ')');
function srcArts(src){
  const out = []; let law = null;
  String(src || '').split(/\s*·\s*/).forEach(seg => {
    const m = seg.match(LAW_RX); if (m) law = m[1];
    for (const x of seg.matchAll(/제(\d+)조(?:의(\d+))?/g)) if (law) out.push({law, no: x[1] + (x[2] ? '의' + x[2] : '')});
  });
  return out;
}
function cardCtx(c){
  if (/^【/.test(c.q)) return '';                                   /* 새 규정 카드는 질문에 이미 들어 있음 */
  const keys = [c.a].concat(c.alt || []).map(norm).filter(k => k.length >= 2), seen = new Set(), parts = [];
  srcArts(c.src).forEach(({law, no}) => {
    if (seen.has(law + ':' + no)) return; seen.add(law + ':' + no);
    const a = D.articles.find(z => z.type === 'a' && z.law === law && z.no === no);
    const tt = a && a.title && !keys.some(x => norm(a.title).includes(x)) ? '(' + a.title + ')' : '';   /* 제목에 답이 보이면 뺀다 */
    const prev = parts[parts.length - 1];
    parts.push({law, s: (prev && prev.law === law ? '' : law + ' ') + nl(no) + tt});
  });
  return parts.map(x => x.s).join(' · ');
}
const srcLaw = src => (String(src || '').match(LAW_RX) || [])[1] || null;
function cardSrcLinks(c){
  $$('#p-quiz .ans .src').forEach(el => {
    if (el.dataset.lk) return; el.dataset.lk = '1';
    el.textContent = el.textContent.replace(/\s*·\s*원문 회독 탭에서 확인/, '');
    linkifyNodes([el], () => srcLaw(c.src));
  });
}
const _drawCard8 = drawCard;
drawCard = function(){
  _drawCard8();
  const c = Q.sess && Q.queue[Q.i], q = $('#p-quiz .card .q'); if (!c || !q) return;
  const h = cardCtx(c); if (h) q.insertAdjacentHTML('beforebegin', `<div class="q-ctx">${esc(h)}</div>`);
  cardSrcLinks(c);
};
const _reveal8 = reveal;
reveal = function(){ _reveal8(); const c = Q.queue[Q.i]; if (c) cardSrcLinks(c); };

/* ── 기출: 기출 근거 DB 가 없는 문항도 정답·해설 속 조문을 눌러서 원문 패널 ── */
const _drawX8 = drawX;
drawX = function(){
  _drawX8.apply(this, arguments);
  const e = X.queue && X.queue[X.i], ex = $('#p-exam .xex');
  if (!e || !ex || KB.items[e.id]) return;
  const law = LAW_ALIAS.get(String(e.area || '').replace(/\s+/g, '')) || null;
  linkifyNodes([ex], () => law);
};
