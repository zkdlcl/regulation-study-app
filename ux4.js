
/* ═════════ 참조 패널(조문 팝업) · 공통 가리기 버튼 · 회독 목차 · 오늘 2단 ═════════ */

/* 조문 조회는 한 곳으로 모아 둔다 (나중에 규정을 파일에서 불러오는 방식으로 바뀌어도 이 두 함수만 바꾸면 된다) */
const artLookup = async (law, no) => { try { await loadLaw(law); } catch (e) { return null; } return D.articles.find(a => a.type === 'a' && a.law === law && a.no === no) || null; };
const lawArticles = law => D.articles.filter(a => a.type === 'a' && a.law === law);

/* 별표 키: '5'·'5의2' = 별표 제5호·제5호의2, '서25'·'서7의2' = 인사서식 제25호·제7호의2 */
const BYEOL_NO = /^(서?)(\d+)(?:의(\d+))?$/;
const byeolLabel = no => { const m = BYEOL_NO.exec(no); return m ? (m[1] ? '인사서식' : '별표') + ' 제' + m[2] + '호' + (m[3] ? '의' + m[3] : '') : '별표 ' + no; };
const byeolIdOf = (law, head) => { const m = /^\[(별표|인사서식)(?:\s*제(\d+)호(?:의(\d+))?)?\]/.exec(head); return m ? 'byeol-' + law + '-' + (m[1] === '인사서식' ? '서' : '') + (m[2] || 1) + (m[3] ? '의' + m[3] : '') : ''; };
/* 회독 기록 키: 조문과 같은 S.reads 에 '규정:별표5의2'·'규정:인사서식25' 로 넣는다 (기출 근거 DB·복습 카드의 조문 키와 같은 모양) */
const byeolReadKey = (law, no) => law + ':' + (no.startsWith('서') ? '인사서식' + no.slice(1) : '별표' + no);
const byeolDomKey = id => { const [, law, no] = id.split('-'); return byeolReadKey(law, no); };
/* 별표·인사서식 참조 (뒤의 '의N' 은 '제5호의 6'처럼 띄어 써도 읽고, '의 구분' 같은 뒷말은 건드리지 않는다) */
const XRE2 = /(인사서식|별표)(?:\s*(?:제\s*)?(\d+)\s*호?(?:\s*의\s*(\d+)(?=[에와과의을를이가는은도로,.)\s]|$))?)?|제\s*(\d+)\s*조(?:\s*의\s*(\d+))?|제\s*(\d+)\s*호(?:\s*의\s*(\d+)(?=[에와과의을를이가는은도로,.)\s]|$))?/g;
/* 원문 글자와 실제 서식이 다른 참조: 제3조의2 '별표 제25호의 선임증' 은 인사서식 제25호 */
const XB_ALIAS = new Map([['인사관리시행규칙:25', '인사관리시행규칙:서25']]);
/* 본문 속 '제N조'·'별표 제N호'·'인사서식 제N호' 를 눌러서 열 수 있는 링크로 바꾼다 (회독 본문의 규칙과 동일) */
function linkifyNodes(els, lawOf){
  els.forEach(el => {
    const defLaw = lawOf(el), w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (w.nextNode()){ const n = w.currentNode; if (!n.parentElement.closest('.b, .xr')) nodes.push(n); }
    nodes.forEach(n => {
      const t = n.nodeValue; XRE2.lastIndex = 0; let m, last = 0, out = null, prev = null;
      while ((m = XRE2.exec(t))){
        let key, kind, law;
        if (m[6]){   /* '별표 제5호 내지 제5호의6' 의 뒤쪽 끝: 앞 참조와 같은 규정·종류로 따로 링크 */
          if (!prev || !/^\s*(?:내지|~|∼|및|,)\s*$/.test(t.slice(prev.end, m.index))) continue;
          law = prev.law; kind = 'b'; key = law + ':' + (prev.pfx === '인사서식' ? '서' : '') + m[6] + (m[7] ? '의' + m[7] : '');
          if (!XB.has(key)) continue;
        } else {
          law = lawFromPre(t.slice(Math.max(0, m.index - 30), m.index), defLaw);
          if (!law) continue;
          if (m[1]){
            if (m[1] === '인사서식' && !m[2]) continue;
            kind = 'b'; key = law + ':' + (m[1] === '인사서식' ? '서' : '') + (m[2] || 1) + (m[3] ? '의' + m[3] : '');
            if (!XB.has(key)){ const al = XB_ALIAS.get(key); if (!al || !XB.has(al)) continue; key = al; }
          } else { key = law + ':' + m[4] + (m[5] ? '의' + m[5] : ''); kind = 'a'; if (!XA.has(key)) continue; }
        }
        if (!out) out = document.createDocumentFragment();
        out.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sp = document.createElement('span'); sp.className = 'xr'; sp.dataset.x = kind + '|' + key; sp.title = '누르면 팝업으로 열기'; sp.textContent = m[0];
        out.appendChild(sp); last = m.index + m[0].length;
        prev = kind === 'b' ? {end: last, law, pfx: m[1] || (prev && prev.pfx)} : null;
      }
      if (out){ out.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(out, n); }
    });
  });
}
function byeolHtml(law, n){
  if (law === '정관') return '<div class="chap">[별표] 분사무소 설치 현황 (제3조의2 관련)</div><div class="tw"><table><tr><th>명칭</th><th>소재지</th></tr>' + D.byeol.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + '</table></div>';
  const parts = ((D.extra && D.extra[law]) || '').split(/(?=<div class="chap">\[(?:별표|인사서식))/), head = '<div class="chap">[' + byeolLabel(n) + ']';
  return parts.find(p => p.startsWith(head)) || '';
}

/* ── 참조 패널 ── */
const PK = {stack: [], keep: false, src: null, srcTop: 0};
/* 폭이 넓은 화면(≥1024px)에서는 패널이 본문을 덮지 않고 오른쪽에 나란히 놓인다 */
const PK_SPLIT_MQ = matchMedia('(min-width:1024px)');
const pkSplit = () => PK_SPLIT_MQ.matches;
const pkOpen = () => !!($('#pk') && !$('#pk').hidden);
const pkBlocking = () => pkOpen() && !pkSplit();   /* 덮는 방식일 때만 아래 버튼을 숨긴다 */
function applySplit(){ document.body.classList.toggle('pk-split', pkOpen() && pkSplit()); }
function pkEnsure(){
  if ($('#pk')) return;
  const o = document.createElement('div'); o.id = 'pk'; o.className = 'pk-ov'; o.hidden = true;
  o.innerHTML = `<div class="pk-scrim" id="pk-scrim"></div>
  <aside class="pk-pan" role="dialog" aria-modal="true" aria-label="참조 조문">
    <div class="pk-top"><button class="pk-ib" id="pk-back" title="뒤로" aria-label="뒤로">←</button><div class="pk-ti" id="pk-ti"></div><button class="pk-ib" id="pk-x" title="닫기 (Esc)" aria-label="닫기">✕</button></div>
    <div class="pk-tools" id="pk-tools"></div>
    <div class="pk-body" id="pk-body"></div>
  </aside>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'pk-scrim' || t.id === 'pk-x') return closePeek();
    if (t.id === 'pk-back') return pkBack();
    const m = t.closest('[data-pkmode]'); if (m){ PK.mode = m.dataset.pkmode; return renderPeek(); }
    if (t.closest('[data-pkamend]')) return setAmend(!S.showAmend);
    const rd = t.closest('[data-pkread]'); if (rd){ const k = rd.dataset.pkread; S.reads[k] = (S.reads[k] || 0) + 1; save(); if ($('#p-read').dataset.init) drawRead(true); renderPeek(); return; }
    const go = t.closest('[data-pkgo]'); if (go){ const k = go.dataset.pkgo; if (pkSplit()){ PK.keep = true; showTab('read'); PK.keep = false; } else { closePeek(); showTab('read'); } setTimeout(() => goRef('a|' + k), 80); return; }
    const nb = t.closest('[data-pknb]'); if (nb){ PK.stack[PK.stack.length - 1] = 'a|' + nb.dataset.pknb; renderPeek(); }
  });
  /* 좌우로 쓸어서 이전·다음 조문 */
  let sx = 0, sy = 0;
  $('#pk-body').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
  $('#pk-body').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 80 || Math.abs(dy) > 50) return;
    const b = $(dx < 0 ? '[data-pknb][data-dir="next"]' : '[data-pknb][data-dir="prev"]', $('#pk')); if (b) b.click();
  }, {passive: true});
}
function openPeek(x, fromPanel){
  pkEnsure();
  PK.stack = (pkOpen() && fromPanel) ? PK.stack.concat([x]) : [x];   /* 패널 안에서 누르면 쌓고, 본문에서 누르면 바꾼다 */
  if (!(pkOpen() && fromPanel)) PK.mode = '0';   /* 링크로 여는 조문·별표는 가리지 않은 원문으로 연다 (패널 안 버튼으로만 가리기) */
  $('#pk').hidden = false; applySplit(); renderPeek(); updFab();
}
function closePeek(){
  const o = $('#pk'); if (!o) return;
  const wasSplit = document.body.classList.contains('pk-split');
  o.hidden = true; PK.stack = []; applySplit(); updFab();
  /* 나란히 보기를 닫으면 본문 폭이 돌아오므로, 누르고 있던 줄이 제자리에 오게 보정 */
  if (wasSplit && PK.src && document.contains(PK.src)){ const d = PK.src.getBoundingClientRect().top - PK.srcTop; if (Math.abs(d) > 2) window.scrollBy(0, d); }
  PK.src = null;
}
addEventListener('resize', () => { if (pkOpen()){ applySplit(); updFab(); } });
function pkBack(){ if (PK.stack.length > 1){ PK.stack.pop(); renderPeek(); } else closePeek(); }
async function renderPeek(){
  const x = PK.stack[PK.stack.length - 1]; if (!x) return;
  const [kind, key] = x.split('|'), [law, no] = key.split(':');
  const box = $('#pk-body'), ti = $('#pk-ti'), tools = $('#pk-tools');
  $('#pk-back').textContent = PK.stack.length > 1 ? `← ${PK.stack.length - 1}` : '←';
  const ib = (attr, ico, tip, on, extra) => `<button class="pk-ib" ${attr} title="${tip}" aria-label="${tip}" ${on === undefined ? '' : `aria-pressed="${!!on}"`} ${extra || ''}>${ico}</button>`;
  const modeSeg = `<span class="pk-grp">${[['0', '👁', '원문 그대로'], ['1', '①', '① 숫자·주체 가리기'], ['2', '②', '② 핵심어 + 일부 낱말 가리기'], ['3', '③', '③ 대부분 가리기']].map(m => ib(`data-pkmode="${m[0]}"`, m[1], m[2], (PK.mode || '0') === m[0])).join('')}</span>`;
  const amendBtn = ib('data-pkamend="1"', '📝', '개정·신설 표시 ' + (S.showAmend ? '끄기' : '켜기'), S.showAmend);
  let root = document.createElement('div'); root.className = 'pk-art';
  if (kind === 'b'){
    try { await loadLaw(law); } catch (e) { /* 아래에서 '찾지 못했습니다' 표시 */ }
    ti.innerHTML = `<span class="badge">${esc(law)}</span> <b>${esc(byeolLabel(no))}</b>`;
    const rk = byeolReadKey(law, no), rn = S.reads[rk] || 0, bh = byeolHtml(law, no);
    tools.innerHTML = '<div class="pk-bar">' + modeSeg + amendBtn + '<span class="pk-sp"></span>' + (bh ? ib(`data-pkread="${esc(rk)}"`, rn ? '✓' + rn : '＋1', '회독 +1 (지금 ' + rn + '회독)', rn > 0) : '') + '</div>';
    root.innerHTML = bh || '<p class="mute">별표를 찾지 못했습니다.</p>';
    linkifyNodes($$('.ln, td', root), () => law);
  } else {
    const a = await artLookup(law, no);
    if (!a){ ti.textContent = key; tools.innerHTML = ''; root.innerHTML = '<p class="mute">조문을 찾지 못했습니다.</p>'; }
    else {
      const list = lawArticles(law), i = list.findIndex(z => z.no === a.no), prev = list[i - 1], next = list[i + 1], n = S.reads[artId(a)] || 0;
      ti.innerHTML = `<span class="badge">${esc(law)}</span> <b>${esc(nl(a.no))}</b> <span class="mute">(${esc(a.title || '')})</span>`;
      tools.innerHTML = '<div class="pk-bar">' + modeSeg + amendBtn + '<span class="pk-sp"></span>'
        + ib(`data-pknb="${esc(prev ? artId(prev) : '')}" data-dir="prev"`, '◀', prev ? '이전 ' + nl(prev.no) : '이전 없음', undefined, prev ? '' : 'disabled')
        + ib(`data-pknb="${esc(next ? artId(next) : '')}" data-dir="next"`, '▶', next ? '다음 ' + nl(next.no) : '다음 없음', undefined, next ? '' : 'disabled')
        + ib(`data-pkread="${esc(artId(a))}"`, n ? '✓' + n : '＋1', '회독 +1 (지금 ' + n + '회독)', n > 0)
        + ib(`data-pkgo="${esc(artId(a))}"`, '↗', '원문에서 보기') + '</div>';
      root.innerHTML = a.html;
      linkifyNodes($$('.ln, td', root), () => law);
    }
  }
  const pm = PK.mode || '0'; $('#pk').dataset.pkrd = pm;
  if (pm === '2' || pm === '3') clozeIn(root, +pm);
  box.innerHTML = ''; box.appendChild(root); box.scrollTop = 0;
}
/* 참조 링크는 어느 화면에서 눌러도 현재 화면을 떠나지 않고 패널로 연다 */
document.addEventListener('click', e => {
  const x = e.target.closest('.xr'); if (!x) return;
  e.preventDefault(); e.stopPropagation(); const sel = getSelection(); if (sel) sel.removeAllRanges();
  const inPanel = !!x.closest('#pk');
  const top0 = x.getBoundingClientRect().top;
  openPeek(x.dataset.x, inPanel);
  if (!inPanel){
    PK.src = x; PK.srcTop = top0;
    /* 나란히 보기로 본문 폭이 줄어도 누른 줄이 화면에서 움직이지 않게 보정 */
    if (pkSplit()){ const d = x.getBoundingClientRect().top - top0; if (Math.abs(d) > 2) window.scrollBy(0, d); }
  }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pk') && !$('#pk').hidden) closePeek(); });
/* 패널·개정 탭의 빈칸을 눌러서 확인 */
document.addEventListener('click', e => { const b = e.target.closest('.b'); if (b && !b.closest('#r-body') && b.closest('#pk, #p-rev')) b.classList.toggle('rev'); });

/* ── 가리기 모드는 한 곳에서 관리: 회독 본문·참조 패널·개정 탭에 같이 적용 ── */
function setMode(v){
  R.mode = String(v); saveRd(); document.body.dataset.rd = R.mode;
  if ($('#p-read').dataset.init) drawRead(true);
  if ($('#pk') && !$('#pk').hidden) renderPeek();
  if ($('#p-rev').classList.contains('on')) renderers.rev();
  updFab();
}
const MODE_SHORT = {'0':'원문', '1':'① 숫자·주체', '2':'② 핵심어+일부', '3':'③ 대부분'};
function updFab(){
  let f = $('#fab-mode');
  if (!f){
    f = document.createElement('button'); f.id = 'fab-mode'; f.className = 'fab-mode'; f.hidden = true; document.body.appendChild(f);
    f.onclick = () => setMode((+R.mode + 1) % 4);
  }
  const on = $('#p-read').classList.contains('on') || $('#p-rev').classList.contains('on');
  f.hidden = !on || pkBlocking();
  f.innerHTML = `<span class="ft-full">👁 ${MODE_SHORT[R.mode]}</span><span class="ft-short">👁${R.mode === '0' ? '' : ' ' + R.mode}</span>`;
  f.setAttribute('aria-label', '가리기 모드 바꾸기 (지금: ' + MODE_SHORT[R.mode] + ')'); f.title = '가리기: ' + MODE_SHORT[R.mode] + ' (누르면 다음 단계)';
  let g = $('#fab-amend');
  if (!g){
    g = document.createElement('button'); g.id = 'fab-amend'; g.className = 'fab-mode fab-amend'; g.hidden = true; document.body.appendChild(g);
    g.onclick = () => setAmend(!S.showAmend);
  }
  g.hidden = !$('#p-read').classList.contains('on') || pkBlocking();
  g.innerHTML = `<span class="ft-full">📝 개정표시 ${S.showAmend ? 'ON' : 'OFF'}</span><span class="ft-short">📝${S.showAmend ? ' ✓' : ''}</span>`; g.setAttribute('aria-pressed', !!S.showAmend); g.setAttribute('aria-label', '개정·신설 표시 ' + (S.showAmend ? '끄기' : '켜기')); g.title = '개정·신설 표시 ' + (S.showAmend ? '끄기' : '켜기');
  applyAmend();
}
/* 개정·신설 표시(<개정 …>)는 기본으로 숨기고, 버튼으로 켠다. 개정 탭에서는 항상 보인다 */
function applyAmend(){ document.body.classList.toggle('show-amend', !!S.showAmend); }
function setAmend(v){ S.showAmend = !!v; save(); updFab(); if ($('#pk') && !$('#pk').hidden) renderPeek(); }
/* 검색 결과 미리보기에서도 개정 표시는 뺀다 */
const stripAmend = h => String(h).replace(/<span class="amend">[\s\S]*?<\/span>/g, '');
findIndex = function(){
  if (F.idx) return F.idx;
  F.idx = [].concat(
    D.articles.filter(a => a.type === 'a').map(a => ({k:'law', sc:a.law, a, t:nl(a.no) + '(' + a.title + ')', h:a.title, x:plain(stripAmend(a.html))})),
    (D.exam || []).map(e => ({k:'exam', sc:'exam', e, t:exLabel(e), h:'', x:e.q + '\n정답 ' + e.a + '\n' + plain(e.ex || '')})),
    D.cards.map(c => ({k:'card', sc:'card', c, t:c.q, h:c.q, x:c.a + ' ' + (c.src || '') + ' ' + (c.alt || []).join(' ')}))
  );
  return F.idx;
};
const _showTab = showTab;
showTab = function(id){ if (pkOpen() && !PK.keep) closePeek(); _showTab(id); try { updFab(); } catch(e){} };

/* 개정 탭: 빈칸·참조 링크도 같은 규칙으로 */
plainBlanks = h => h;
const _rRev = renderers.rev;
renderers.rev = function(){
  if (needAllLaws()){
    $('#p-rev').innerHTML = '<div class="note">⏳ 모든 규정을 불러오는 중…</div>';
    loadAllLaws().then(() => renderers.rev());
    return;
  }
  _rRev();
  { const w = lawsMissingNote(); if (w) $('#p-rev').insertAdjacentHTML('afterbegin', w); }
  const p = $('#p-rev');
  linkifyNodes($$('.rv-item .ln', p), el => { const l = el.closest('.rv-item').querySelector('.law'); return l ? l.textContent : '조직법'; });
  if (R.mode === '2' || R.mode === '3') clozeIn(p, +R.mode);
};

/* ── 회독 목차 사이드바 (가로 화면) ── */
function syncAppendixJump(){
  const jump = $('#r-jump'); if (!jump) return;
  const headings = $$('#r-body .chap[id^="byeol-"]');
  if (!headings.length || jump.querySelector('[data-appendices]')) return;
  const groups = {};   /* 별표 / 인사서식 두 묶음 */
  headings.forEach(h => {
    const kind = h.textContent.startsWith('[인사서식') ? '인사서식' : '별표';
    if (!groups[kind]){ groups[kind] = document.createElement('optgroup'); groups[kind].label = kind; groups[kind].dataset.appendices = '1'; }
    const label = h.cloneNode(true); $$('.amend, .chap-rc', label).forEach(a => a.remove());
    let title = label.textContent.trim();
    if (title.endsWith(']') && h.nextElementSibling?.matches('.ln')) title += ' ' + h.nextElementSibling.textContent.trim();
    const option = document.createElement('option'); option.value = h.id; option.textContent = title; groups[kind].appendChild(option);
  });
  Object.values(groups).forEach(g => jump.appendChild(g));
}
function syncToc(){
  const body = $('#r-body'); if (!body) return;
  let wrap = $('.rd-wrap');
  if (!wrap){
    wrap = document.createElement('div'); wrap.className = 'rd-wrap';
    const aside = document.createElement('aside'); aside.id = 'r-toc'; aside.setAttribute('aria-label', '목차');
    const main = document.createElement('div'); main.className = 'rd-main';
    body.parentNode.insertBefore(wrap, $('#r-crumb'));
    main.appendChild($('#r-crumb')); main.appendChild(body); wrap.append(aside, main);
    aside.addEventListener('click', e => { const b = e.target.closest('[data-tj]'); if (!b) return; const j = $('#r-jump'); j.value = b.dataset.tj; j.dispatchEvent(new Event('change')); });
  }
  const jump = $('#r-jump'); let h = '';
  const navigable = o => o.value.startsWith('a-') || o.value.startsWith('byeol-');
  const item = o => { const id = o.value.slice(2), k = o.value.startsWith('a-') ? id : byeolDomKey(o.value), n = S.reads[k] || 0, off = rdSkip(k); return `<button class="toc-a${off ? ' off' : ''}" data-tj="${esc(o.value)}" data-id="${esc(id)}"><span class="ck">${off ? '✕' : n > 1 ? n : n ? '✓' : ''}</span><span>${esc(o.textContent.trim())}</span></button>`; };
  [...jump.children].forEach(c => {
    if (c.tagName === 'OPTION' && navigable(c)) h += item(c);
    if (c.tagName === 'OPTGROUP'){
      const first = c.querySelector('option');
      h += `<button class="toc-ch" data-tj="${esc(first ? first.value : '')}">${esc(c.label)}</button>` + [...c.querySelectorAll('option')].filter(navigable).map(item).join('');
    }
  });
  $('#r-toc').innerHTML = h || '<p class="small mute" style="padding:8px">목차가 없습니다.</p>';
  tocSpy();
}
let tocRaf = 0;
function tocSpy(){
  tocRaf = 0; const aside = $('#r-toc'); if (!aside || !aside.offsetParent) return;
  const top = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 100) + 40;
  let cur = null; for (const a of $$('#r-body .art, #r-body .chap[id^="byeol-"]')){ if (a.getBoundingClientRect().top > top) break; cur = a; }
  $$('#r-toc .toc-a.on').forEach(b => b.classList.remove('on'));
  if (!cur) return;
  const b = $$('#r-toc .toc-a').find(b => b.dataset.tj === cur.id); if (!b) return;
  b.classList.add('on');
  const bt = b.offsetTop, bh = b.offsetHeight; if (bt < aside.scrollTop + 8) aside.scrollTop = bt - 40; else if (bt + bh > aside.scrollTop + aside.clientHeight - 8) aside.scrollTop = bt + bh - aside.clientHeight + 40;
}
addEventListener('scroll', () => { if (!tocRaf && $('#p-read').classList.contains('on')) tocRaf = requestAnimationFrame(tocSpy); }, {passive: true});
const _syncChips = syncChips;
syncChips = function(){ syncAppendixJump(); _syncChips(); try { syncToc(); } catch(e){ console.warn(e); } };

/* ── 오늘 탭: 가로 화면에서 2단 (왼쪽: 일정·추천·밀린 일 / 오른쪽: 오늘 할 일) ── */
function todayCols(){
  const p = $('#p-today'); if (p.querySelector(':scope > .td-l')) return;
  const kids = [...p.children], l = document.createElement('div'), r = document.createElement('div');
  l.className = 'td-l'; r.className = 'td-r';
  kids.forEach(k => (k.matches('.sch, .rec-card, .late-card, .past-card') ? l : r).appendChild(k));
  p.append(l, r);
}
const _todayEnh2 = todayEnhance;
todayEnhance = function(){ _todayEnh2(); try { todayCols(); } catch(e){ console.warn(e); } };

/* 회독 본문의 참조 링크도 같은 규칙으로 만든다 (다른 규정으로의 링크 포함) */
const rcX = (k, off) => `<button class="rc-x" data-rskip="${esc(k)}" aria-pressed="${off}" aria-label="${off ? '회독 제외 해제' : '회독에서 제외'}" title="${off ? '회독 제외 해제' : '회독에서 제외'}">${off ? '↩' : '✕'}</button>`;
linkRefs = function(){
  let bAll = 0, bRead = 0;
  /* 조문: 회독 버튼 앞에 ✕. 제외하면 본문을 접고(CSS) 회독 버튼을 ↩ 하나로 바꾼다 */
  $$('#r-body .art[id^="a-"]').forEach(el => {
    const h = $('.art-h', el), key = el.id.slice(2), off = rdSkip(key); if (!h) return;
    el.classList.toggle('skip', off);
    if (off){ el.classList.remove('read'); $$('.rc', h).forEach(b => b.remove()); h.insertAdjacentHTML('beforeend', rcX(key, true)); }
    else { const b = $('.rc', h); if (b) b.insertAdjacentHTML('beforebegin', rcX(key, false)); }
  });
  $$('#r-body .chap').forEach(c => {
    const id = byeolIdOf(R.law, c.textContent); if (!id) return;
    c.id = id;
    const key = byeolDomKey(id), k = esc(key), n = S.reads[key] || 0;
    const off = rdSkip(key);
    c.classList.toggle('skip', off);
    if (off){
      for (let x = c.nextElementSibling; x && !x.matches('.chap, .art, .ch-h, .sc-h'); x = x.nextElementSibling) x.classList.add('rd-hide');
      c.insertAdjacentHTML('beforeend', `<span class="chap-rc">${rcX(key, true)}</span>`);
      return;
    }
    bAll++; if (n) bRead++;
    c.classList.toggle('read', n > 0);
    c.insertAdjacentHTML('beforeend', `<span class="chap-rc">${rcX(key, false)}${n ? `<button class="rc minus" data-brc="${k}" data-d="-" aria-label="회독 1 줄이기">➖</button>` : ''}<button class="rc ${n ? 'has' : ''}" data-brc="${k}">${n ? '✅ ' + n + '회독 +1' : '회독 +1'}</button></span>`);
  });
  const nOff = Object.keys(S.rskip || {}).filter(k => k.startsWith(R.law + ':')).length;
  const pg = $('#r-prog'); if (pg && (bAll || nOff)) pg.textContent = pg.textContent.replace(/(1회독 이상 \d+\/\d+조)/, `$1${bAll ? ` · 별표 ${bRead}/${bAll}` : ''}${nOff ? ` · 제외 ${nOff}` : ''}`);
  linkifyNodes($$('#r-body .ln, #r-body td'), () => R.law);
};
/* 별표 회독 버튼: '이어 읽기' 위치(setLast)는 조문 기준이므로 건드리지 않는다 */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-brc]'); if (!b) return;
  const k = b.dataset.brc, d = b.dataset.d === '-' || e.shiftKey ? -1 : 1;
  S.reads[k] = Math.max(0, (S.reads[k] || 0) + d); saveRd(); drawRead(true);
});
/* 회독 제외 ✕/↩: S.rskip 은 켜고 끄기만 하고 S.reads 는 건드리지 않는다 (해제하면 회독 수가 그대로 돌아온다) */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rskip]'); if (!b) return;
  const k = b.dataset.rskip; S.rskip = S.rskip || {};
  if (S.rskip[k]) delete S.rskip[k]; else S.rskip[k] = 1;
  saveRd(); drawRead(true);
});
/* 아직 불러오지 않은 규정으로 이동할 때는 불러온 뒤에 이동 */
const _goRef = goRef;
goRef = async function(x){
  const law = x.split('|')[1].split(':')[0];
  try { await loadLaw(law); } catch (e) { toast('규정을 불러오지 못했습니다.'); return; }
  _goRef(x);
};
