/* ═════ 국제인도법 이해 층: 해석 · 원어 · 팁 · 비교 · 연표 (kb/ihl_study.json → D.ihlStudy) ═════
   - 국제인도법 회독에서만, 데이터가 있는 절의 머리 밑에 아이콘 칩 줄을 붙인다
   - 칩은 전역 모드(한 번 고르면 모든 절에 같은 층이 열림), 같은 칩을 다시 누르면 닫힘
   - 해석은 원문을 쉬운 말로 옮긴 보조 설명이며 원문이 우선한다(표시로 구분) */
(() => {
  const IS = D.ihlStudy; if (!IS) return;
  const LAW = '국제인도법';
  const svg = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    easy: svg('<path d="M4 5h16M4 10h10M4 15h16M4 20h8"/>'),
    en: svg('<path d="M4 5h7M7.5 5v2c0 4-2 7-4 8M5 11c1.5 2 3.5 3 6 3.5"/><path d="M13 21l4-10 4 10M14.5 17.5h5"/>'),
    tip: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
    vs: svg('<rect x="3" y="4" width="7.5" height="16" rx="2"/><rect x="13.5" y="4" width="7.5" height="16" rx="2"/>'),
    tl: svg('<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h6M4 17h6"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  };
  const NAME = {easy: '쉬운 해석', en: '원어(영문)', tip: '이해 팁', vs: '헷갈리는 쌍', tl: '연표'};
  const ls = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
              set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }};
  let mode = ls.get('ihx-mode') || '';
  let tlCore = ls.get('ihx-tl') !== 'all';

  const layers = a => ['easy', 'en', 'tip', 'vs', 'tl'].filter(k => k === 'easy' ? a.easy : k === 'en' ? a.en : k === 'tip' ? a.tip : k === 'vs' ? (a.pairs || []).length : a.timeline);

  function pairHtml(id){
    const p = IS.pairs[id]; if (!p) return '';
    const side = (s, k) => `<div class="ihx-side" data-side="${k}"><button class="ihx-cover" data-ihxcover="${k}" aria-label="${esc(s.h)} 가리기·보이기">${ICON.eye}</button><h5>${esc(s.h)}</h5><ul>${s.pts.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    return `<div class="ihx-pair"><div class="ihx-pt">${esc(p.title)}</div><div class="ihx-vs">${side(p.a, 'a')}<span class="ihx-vsm" aria-hidden="true">vs</span>${side(p.b, 'b')}</div></div>`;
  }
  function timelineHtml(art){
    const rows = [...art.querySelectorAll('table tr')].map(tr => [...tr.children]).filter(c => c.length >= 3 && c[0].tagName === 'TD');
    if (!rows.length) return '';
    const items = rows.map(c => {
      const core = c[0].textContent.includes('○'), y = c[1].textContent.trim();
      return `<li class="ihx-ti${core ? ' core' : ''}${/^\(/.test(y) ? ' war' : ''}"><span class="ihx-ty">${esc(y)}</span><div class="ihx-td">${c[2].innerHTML}</div></li>`;
    }).join('');
    return `<div class="ihx-tlbar"><button class="chip${tlCore ? ' on' : ''}" data-ihxtl="core" aria-pressed="${tlCore}">○ 핵심만</button><button class="chip${tlCore ? '' : ' on'}" data-ihxtl="all" aria-pressed="${!tlCore}">전체</button></div><ol class="ihx-tl${tlCore ? ' core-only' : ''}">${items}</ol>`;
  }
  function body(art, a, k){
    if (k === 'easy') return `<ol class="ihx-easy">${a.easy.map(t => `<li>${esc(t)}</li>`).join('')}</ol><p class="ihx-foot">원문을 쉬운 말로 옮긴 해설입니다. 시험은 위 원문 표현으로 나옵니다.</p>`;
    if (k === 'en') return `<div class="ihx-en">${a.en.map(([ko, en, n]) => `<div class="ihx-term"><b>${esc(ko)}</b><span class="ihx-eng" lang="en">${esc(en)}</span>${n ? `<small>${esc(n)}</small>` : ''}</div>`).join('')}</div>`;
    if (k === 'tip') return `<div class="ihx-tip">${ICON.tip}<p>${esc(a.tip)}</p></div>`;
    if (k === 'vs') return a.pairs.map(pairHtml).join('');
    if (k === 'tl') return timelineHtml(art);
    return '';
  }
  function paint(el){
    const a = IS.arts[el.dataset.ihx], box = el.querySelector('.ihx'); if (!a || !box) return;
    const ks = layers(a), k = ks.includes(mode) ? mode : '';
    box.querySelectorAll('[data-ihxk]').forEach(b => { const on = b.dataset.ihxk === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const pane = box.querySelector('.ihx-pane');
    pane.hidden = !k;
    pane.innerHTML = k ? `<div class="ihx-h">${ICON[k]}<span>${NAME[k]}</span></div>${body(el, a, k)}` : '';
  }
  function attach(el){
    if (el.dataset.ihx !== undefined) return;
    const key = el.id.slice(2); if (!key.startsWith(LAW + ':')) return;
    const no = key.slice(LAW.length + 1), a = IS.arts[no]; if (!a) return;
    el.dataset.ihx = no;
    const h = el.querySelector('.art-h'); if (!h) return;
    const box = document.createElement('div'); box.className = 'ihx';
    box.innerHTML = `<div class="ihx-chips" role="group" aria-label="이해 도움">${layers(a).map(k => `<button class="ihx-c" data-ihxk="${k}" title="${NAME[k]}" aria-label="${NAME[k]}" aria-pressed="false">${ICON[k]}</button>`).join('')}</div><div class="ihx-pane" hidden></div>`;
    h.after(box);
    paint(el);
  }
  const scan = root => (root.matches && root.matches('.art[id^="a-"]') ? [root] : root.querySelectorAll ? root.querySelectorAll('.art[id^="a-"]') : []).forEach(attach);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && scan(n)))).observe(document.body, {childList: true, subtree: true});
  scan(document.body);
  const repaint = () => document.querySelectorAll('.art[data-ihx]').forEach(paint);

  document.addEventListener('click', ev => {
    const c = ev.target.closest('[data-ihxk]');
    if (c){
      const art = c.closest('.art'), top = art.getBoundingClientRect().top;
      mode = mode === c.dataset.ihxk ? '' : c.dataset.ihxk; ls.set('ihx-mode', mode);
      repaint();
      window.scrollBy(0, art.getBoundingClientRect().top - top);   /* 누른 절이 제자리에 있게 */
      return;
    }
    const v = ev.target.closest('[data-ihxcover]');
    if (v){ const s = v.closest('.ihx-side'); s.classList.toggle('covered'); v.setAttribute('aria-pressed', s.classList.contains('covered')); return; }
    const t = ev.target.closest('[data-ihxtl]');
    if (t){ tlCore = t.dataset.ihxtl === 'core'; ls.set('ihx-tl', tlCore ? '' : 'all'); repaint(); }
  });
  window.IHX = {paint, repaint, get mode(){ return mode; }};
})();
