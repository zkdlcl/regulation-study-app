/* ───────── 대조·숫자: 규정별 칩 (study_subject.py 가 표마다 section.tsec[data-cat] 로 감쌈) ───────── */
const TCAT_KEY = 'om-tcat';
function tcatSet(k){
  const p = $('#p-table'); if (!p) return;
  if (!$(`.tchips [data-tcat="${k}"]`, p)) k = 'all';
  $$('.tchips [data-tcat]', p).forEach(b => { const on = b.dataset.tcat === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $$('.tsec', p).forEach(s => { const c = s.dataset.cat.split(' '); s.hidden = !(k === 'all' || c.includes(k) || c.includes('all')); });
  p.dataset.tview = k;
  try { localStorage.setItem(TCAT_KEY, k); } catch (e) {}
}
/* 오늘 과제가 가리키는 표가 숨어 있으면 '전체'로 */
function tcatReveal(n){
  const h = document.getElementById('table-' + n), s = h && h.closest('.tsec');
  if (s && s.hidden) tcatSet('all');
}
const _rTableCat = renderers.table;
renderers.table = function(){
  const p = $('#p-table'), first = !p.dataset.init;
  _rTableCat();
  if (!first) return;
  let k = 'all'; try { k = localStorage.getItem(TCAT_KEY) || 'all'; } catch (e) {}
  tcatSet(k);
  p.addEventListener('click', e => { const b = e.target.closest(".tchips [data-tcat]"); if (b) tcatSet(b.dataset.tcat); });
};
/* 18번 표 아래 통상·평균임금 구분 (study_wage.py): 단계 칩 · 행 펼치기 · 가리고 풀기 · 함정 OX. 학습 기록(S)은 건드리지 않는다. */
document.addEventListener('click', e => {
  const w = e.target.closest('#p-table .wg'); if (!w || e.target.closest('[data-kbart]')) return;
  const st = e.target.closest('[data-wgstep]');
  if (st){
    $$('[data-wgstep]', w).forEach(b => { const on = b === st; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-wgpane]', w).forEach(p => { p.hidden = p.dataset.wgpane !== st.dataset.wgstep; });
    return;
  }
  const r = e.target.closest('[data-wgrow]');
  if (r){
    const tr = r.closest('tr'), f = tr.nextElementSibling, open = f.hidden;
    f.hidden = !open; tr.classList.toggle('open', open); r.setAttribute('aria-expanded', open);
    return;
  }
  const a = e.target.closest('[data-wgans]');
  if (a){ const on = a.getAttribute('aria-expanded') !== 'true'; a.setAttribute('aria-expanded', on); return; }
  const all = e.target.closest('[data-wgall]');
  if (all){
    const on = all.getAttribute('aria-pressed') !== 'true';
    all.setAttribute('aria-pressed', on); all.classList.toggle('on', on); all.textContent = on ? '다시 가리기' : '전부 펼치기';
    $$('[data-wgans]', all.closest('.wg-pane')).forEach(b => b.setAttribute('aria-expanded', on));
    return;
  }
  const ox = e.target.closest('[data-wgox]');
  if (ox){
    const li = ox.closest('.wg-ox'), right = ox.dataset.wgox === li.dataset.ans;
    $$('[data-wgox]', li).forEach(b => { b.classList.toggle('on', b === ox); b.setAttribute('aria-pressed', b === ox); });
    const res = $('.wg-oxr', li); res.hidden = false;
    li.classList.toggle('ok', right); li.classList.toggle('ng', !right);
    $('.wg-mark', li).textContent = right ? '맞음' : '다시 보기';
  }
});
