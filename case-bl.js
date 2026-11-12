/* ── 사례형·원문 빈칸 (kb/study/cases.py) ──
   · 묶음 'case' 를 기출·오답 묶음 목록에 붙인다.
   · 문항 kind 'bl': 원문 문장의 핵심 낱말이 [[…]] 로 표시돼 있고, 한 글자당 □ 하나로 보여 준다.
     원문 낱말 그대로 입력해야 정답(띄어쓰기만 무시, 동의어는 오답). 틀리면 해당 항·호·목 원문을 인용한다. */
(function(){
  if (!XG.some(g => g[0] === 'case')){
    const i = Math.max(...['st3', 'st4', 'st5'].map(id => XG.findIndex(g => g[0] === id)));
    XG.splice(i < 0 ? 2 : i + 1, 0, ['case', '📕 사례형·빈칸 · 직원운영규정']);
  }
  const BL = {id: null, vals: []};
  const parts = q => { const out = [], re = /\[\[(.+?)\]\]/g; let last = 0, m; while ((m = re.exec(q))){ out.push({t: q.slice(last, m.index)}); out.push({a: m[1]}); last = re.lastIndex; } out.push({t: q.slice(last)}); return out; };
  const pat = a => a.replace(/[가-힣0-9A-Za-z]/g, '□');
  const nz = s => String(s == null ? '' : s).replace(/\s+/g, '');
  const cur = () => (X.sess && !X.done && X.queue[X.i]) || null;

  const _drawX = drawX;
  drawX = function(){
    const e = cur();
    if (!e || e.kind !== 'bl') return _drawX();
    const ps = parts(e.q), ans = ps.filter(p => p.a !== undefined).map(p => p.a);
    if (BL.id !== e.id){ BL.id = e.id; BL.vals = ans.map(() => ''); }
    const done = X.picked !== null;
    let bi = 0;
    const sentence = ps.map(p => {
      if (p.t !== undefined) return esc(p.t);
      const i = bi++, v = BL.vals[i] || '', ok = nz(v) === nz(p.a);
      if (!done) return `<input class="bl-in" data-i="${i}" value="${esc(v)}" placeholder="${pat(p.a)}" size="${Math.max(3, [...p.a].length + 1)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="빈칸 ${i + 1}">`;
      return ok ? `<span class="bl-ok">${esc(p.a)}</span>` : `<span class="bl-no">${esc(v || '(빈칸)')}</span><span class="bl-fix">${esc(p.a)}</span>`;
    }).join('');
    const bad = ans.map((a, i) => ({a, v: BL.vals[i] || '', i})).filter(x => nz(x.v) !== nz(x.a));
    const res = !done ? '' : bad.length
      ? `<div class="xres">❌ 오답 — 틀린 빈칸 ${bad.length}개</div>
         <div class="xex bl-cite"><b>📖 ${esc(e.ref)}</b><br>「${esc(e.clause)}」</div>
         <ul class="bl-diff">${bad.map(x => `<li>${x.i + 1}번 빈칸: 내 답 <s>${esc(x.v || '(빈칸)')}</s> → 원문 <b>${esc(x.a)}</b></li>`).join('')}</ul>
         ${e.tip ? `<p class="small mute">${esc(e.tip)}</p>` : ''}
         <p class="small mute">원문 낱말 그대로 써야 정답입니다(띄어쓰기만 무시, 동의어는 오답).</p>`
      : `<div class="xres">✅ 정답입니다</div><div class="xex bl-cite"><b>📖 ${esc(e.ref)}</b><br>「${esc(e.clause)}」</div>`;
    $('#p-exam').innerHTML = `
    <div class="row"><span class="mute small grow">${X.i + 1} / ${X.queue.length} · ${esc(exLabel(e))}</span><button class="b-line" id="x-end">끝내기</button></div>
    <div class="bar" style="margin:6px 0"><i style="width:${pct(X.i, X.queue.length)}%"></i></div>
    <div class="card">
      <span class="badge">원문 빈칸</span>${e.cs ? `<span class="badge t">${esc(e.cs)} · ${esc(e.k || '')}</span>` : ''}${exWrong(e) ? '<span class="badge">📕 오답노트</span>' : ''}
      <p class="small mute" style="margin:8px 0 0">원문 문장의 □ 한 칸이 글자 하나입니다. 원문 낱말 그대로 입력하세요.</p>
      <div class="xq bl-q">${sentence}</div>
      ${res}
      ${done ? `<button class="b-red" id="x-next">${X.i + 1 < X.queue.length ? '다음 문제 ▶' : '결과 보기'}</button>` : '<button class="b-red" id="bl-check">채점</button>'}
    </div>
    <p class="mute small">Enter: 다음 빈칸 · 마지막 빈칸에서 Enter 는 채점</p>`;
    if (!done) setTimeout(() => { const f = $('#p-exam .bl-in'); if (f) f.focus(); }, 0);
  };

  /* 유형 필터: 객관식·OX 에서는 빈칸을 빼고, '빈칸' 칩을 새로 둔다 */
  const _xq = xQueue;
  xQueue = function(){
    const k = X.kind;
    if (k !== 'bl' && k !== 'mc') return _xq();
    X.kind = '';
    let q; try { q = _xq(); } finally { X.kind = k; }
    return q.filter(e => k === 'bl' ? e.kind === 'bl' : e.kind !== 'sa' && e.kind !== 'bl');
  };

  const pane = $('#p-exam');
  pane.addEventListener('input', e => { const t = e.target.closest('.bl-in'); if (t) BL.vals[+t.dataset.i] = t.value; });
  pane.addEventListener('click', e => {
    if (!e.target.closest('#bl-check')) return;
    const q = cur(); if (!q || q.kind !== 'bl' || X.picked !== null) return;
    const ans = parts(q.q).filter(p => p.a !== undefined).map(p => p.a);
    $$('#p-exam .bl-in').forEach(inp => { BL.vals[+inp.dataset.i] = inp.value; });
    const ok = ans.every((a, i) => nz(BL.vals[i]) === nz(a));
    xGrade(ok, 'bl');
  });
  pane.addEventListener('keydown', e => {
    const t = e.target.closest('.bl-in'); if (!t || e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const all = $$('#p-exam .bl-in'), i = all.indexOf(t);
    if (i < all.length - 1) all[i + 1].focus(); else { const b = $('#bl-check'); if (b) b.click(); }
  });
  /* 빈칸 문제에서 숫자키 1~5 가 보기 선택으로 채점되지 않게 막는다 */
  document.addEventListener('keydown', e => {
    const q = cur();
    if (q && q.kind === 'bl' && /^[1-5]$/.test(e.key) && !e.target.closest('input,textarea,select')) e.stopImmediatePropagation();
  }, true);
})();
