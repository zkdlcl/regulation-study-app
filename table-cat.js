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
