/* ═════ 국제인도법 조약·의정서 용어 링크 (kb/ihl_terms.json → D.ihlTerms) ═════
   본문의 '제1추가의정서'·'공통 제3조' 같은 표기를 규정 참조 링크(.xr)처럼 만들고, 누르면 우측 참조 패널에
   그 문서를 설명하는 수록본 원문 줄을 그대로 모아 보여 준다(뻥뚫 대비: 문구를 바꾸지 않는다).
   패널 종류 't|<용어 id>' — 조문('a|')·별표('b|')와 같은 쌓기·뒤로 가기·가리기 단계를 쓴다. */
(() => {
  const TERMS = D.ihlTerms; if (!TERMS || !TERMS.length) return;
  const LAW = '국제인도법', T = Object.fromEntries(TERMS.map(t => [t.id, t]));
  const sq = s => s.replace(/\s+/g, '');
  /* 표기 → 후보 용어들(같은 표기가 절에 따라 다른 문서를 가리킬 수 있다: '제2의정서') */
  const CAND = new Map();
  TERMS.forEach(t => t.al.forEach(al => {
    const o = typeof al === 'string' ? {a: al} : al, k = sq(o.a);
    if (!CAND.has(k)) CAND.set(k, []);
    CAND.get(k).push({id: t.id, in: o.in || null, nb: o.nb ? new RegExp(o.nb) : null});
  }));
  /* 긴 표기부터, 글자 사이 띄어쓰기는 무시 ('제1 추가의정서'·'유엔 헌장') */
  const RE = new RegExp([...CAND.keys()].sort((a, b) => b.length - a.length)
    .map(k => [...k].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).join('|'), 'g');
  const pick = (m, pre, no) => { const c = (CAND.get(sq(m)) || []).find(c => (!c.in || c.in.includes(no)) && !(c.nb && c.nb.test(pre))); return c ? c.id : ''; };
  /* 글에서 표기를 찾아 [시작, 끝, 용어 id] 로 돌려준다 */
  const scan = (t, no) => { const out = []; let m; RE.lastIndex = 0; while ((m = RE.exec(t))){ const id = pick(m[0], t.slice(Math.max(0, m.index - 12), m.index), no); if (id) out.push([m.index, m.index + m[0].length, id]); } return out; };

  /* 표기는 줄 전체 글에서 찾는다: 연도 같은 낱말이 빈칸(.b)이라 글 조각이 나뉘어도 '1954년 헤이그협약'을 알아보고,
     링크는 빈칸 밖 글자에만 건다(빈칸은 그대로 가려진다). */
  function link(els, noOf, self){
    els.forEach(el => {
      const hits = scan(el.textContent, noOf(el)).filter(h => h[2] !== self); if (!hits.length) return;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = []; let pos = 0;
      while (w.nextNode()){ const n = w.currentNode, len = n.nodeValue.length; if (!n.parentElement.closest('.b, .xr, .ihx')) nodes.push([n, pos]); pos += len; }
      nodes.forEach(([n, at]) => {
        const t = n.nodeValue, end = at + t.length, parts = [];
        hits.forEach(([s, e, id]) => {
          let a = Math.max(s, at) - at, b = Math.min(e, end) - at; if (a >= b) return;
          while (a < b && /\s/.test(t[a])) a++; while (b > a && /\s/.test(t[b - 1])) b--;
          if (b - a >= 2) parts.push([a, b, id]);
        });
        if (!parts.length) return;
        const out = document.createDocumentFragment(); let last = 0;
        parts.forEach(([a, b, id]) => {
          out.appendChild(document.createTextNode(t.slice(last, a)));
          const sp = document.createElement('span'); sp.className = 'xr xr-t'; sp.dataset.x = 't|' + id; sp.title = T[id].name + ' — 누르면 원문 발췌 열기'; sp.textContent = t.slice(a, b);
          out.appendChild(sp); last = b;
        });
        out.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(out, n);
      });
    });
  }

  /* 절의 원문을 줄 단위(.ln, 표는 행)로 나눈다 — 빌드 검사(build_artifact.py)와 같은 기준 */
  const unitsOf = a => { const d = document.createElement('div'); d.innerHTML = a.html; return [...d.querySelectorAll('.ln, tr')].filter(e => !(e.matches('.ln') && e.closest('tr'))); };
  const arts = () => D.articles.filter(a => a.type === 'a' && a.law === LAW);
  const short = a => (a.no.length > 14 ? '' : a.no + ' ') + (a.title || a.no);
  /* 용어가 나오는 절 목록(발췌에 쓴 절 제외)은 한 번만 계산 */
  let MENT = null;
  const mentions = id => {
    if (!MENT){ MENT = {}; arts().forEach(a => { const d = document.createElement('div'); d.innerHTML = a.html; new Set(scan(d.textContent, a.no).map(h => h[2])).forEach(i => (MENT[i] = MENT[i] || []).push(a)); }); }
    const core = new Set(T[id].refs.map(r => r[0])); return (MENT[id] || []).filter(a => !core.has(a.no));
  };

  async function renderTerm(id){
    const t = T[id], box = $('#pk-body'), ti = $('#pk-ti'), tools = $('#pk-tools');
    $('#pk-back').textContent = PK.stack.length > 1 ? `← ${PK.stack.length - 1}` : '←';
    const root = document.createElement('div'); root.className = 'pk-art itm';
    if (!t){ ti.textContent = id; tools.innerHTML = ''; root.innerHTML = '<p class="mute">용어를 찾지 못했습니다.</p>'; box.innerHTML = ''; box.appendChild(root); return; }
    try { await loadLaw(LAW); } catch (e) { /* 아래에서 빈 발췌로 표시 */ }
    ti.innerHTML = `<span class="badge">${LAW}</span> <b>${esc(t.name)}</b>${t.yr ? ` <span class="mute small">${esc(t.yr)}</span>` : ''}`;
    const pm = PK.mode || '0';
    tools.innerHTML = '<div class="pk-bar"><span class="pk-grp">' + [['0', '👁', '원문 그대로'], ['1', '①', '① 숫자·주체 가리기'], ['2', '②', '② 핵심어 + 일부 낱말 가리기'], ['3', '③', '③ 대부분 가리기']]
      .map(m => `<button class="pk-ib" data-pkmode="${m[0]}" title="${m[2]}" aria-label="${m[2]}" aria-pressed="${pm === m[0]}">${m[1]}</button>`).join('') + '</span><span class="pk-sp"></span><span class="mute small">원문 발췌</span></div>';
    const by = Object.fromEntries(arts().map(a => [a.no, a]));
    let h = (t.sum || []).map(s => `<blockquote class="itm-sum">${esc(s)}</blockquote>`).join('');
    t.refs.forEach(([no, idx]) => {
      const a = by[no]; if (!a) return;
      const us = unitsOf(a), sel = idx === '*' ? us : idx.map(i => us[i]).filter(Boolean); if (!sel.length) return;
      let body = '', rows = '';
      const flush = () => { if (rows){ body += `<div class="tw"><table>${rows}</table></div>`; rows = ''; } };
      sel.forEach(u => { if (u.tagName === 'TR') rows += u.outerHTML; else { flush(); body += u.outerHTML; } }); flush();
      h += `<section class="itm-sec" data-no="${esc(no)}"><div class="itm-src"><span class="xr" data-x="a|${esc(LAW + ':' + no)}" title="이 절 전체 열기">${esc(short(a))}</span></div>${body}</section>`;
    });
    const ms = mentions(id);
    if (ms.length) h += `<div class="itm-more"><div class="itm-l">이 문서가 나오는 다른 절 ${ms.length}</div><div class="itm-chips">${ms.map(a => `<span class="xr itm-chip" data-x="a|${esc(LAW + ':' + a.no)}">${esc(short(a))}</span>`).join('')}</div></div>`;
    root.innerHTML = h || '<p class="mute">발췌가 없습니다.</p>';
    $('#pk').dataset.pkrd = pm;
    if (pm === '2' || pm === '3') clozeIn(root, +pm);
    $$('.itm-sec', root).forEach(sec => link($$('.ln, td', sec), () => sec.dataset.no, id));
    box.innerHTML = ''; box.appendChild(root); box.scrollTop = 0;
  }

  /* 참조 패널: 용어는 여기서 그리고, 국제인도법 조문을 연 경우에는 그 안의 용어도 링크로 바꾼다 */
  const _renderPeek = renderPeek;
  renderPeek = async function(){
    const x = PK.stack[PK.stack.length - 1]; if (!x) return;
    if (x.startsWith('t|')) return renderTerm(x.slice(2));
    await _renderPeek.apply(this, arguments);
    if (x.startsWith('a|' + LAW + ':') && PK.stack[PK.stack.length - 1] === x) link($$('#pk-body .ln, #pk-body td'), () => x.slice(LAW.length + 3));
  };

  /* 회독 본문 */
  const _drawRead = drawRead;
  drawRead = function(){
    const ret = _drawRead.apply(this, arguments);
    try { if (R.law === LAW) link($$('#r-body .ln, #r-body td'), el => { const a = el.closest('.art[id^="a-"]'); return a ? a.id.slice(LAW.length + 3) : ''; }); } catch (e) { /* 링크 실패가 본문 표시를 막지 않게 */ }
    return ret;
  };
  window.IHT = {scan, terms: TERMS};
})();
