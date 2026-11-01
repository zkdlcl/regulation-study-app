/* ═════ 규정 데이터: 앞의 3종(조직법·정관·운영규정)은 페이지에 들어 있고, 나머지는 처음 열 때 파일에서 불러온다 ═════ */
const LAW_INDEX = D.lawIndex || [];
const BASE_LAWS = ['조직법', '정관', '운영규정'];
const LAW_LIST = BASE_LAWS.concat(LAW_INDEX.map(l => l.law));
const LAW_STATE = {};                                   /* 규정 이름 → 'loaded' 또는 불러오는 중인 Promise */
const lawReady = law => BASE_LAWS.includes(law) || LAW_STATE[law] === 'loaded';
const allLawsReady = () => LAW_INDEX.every(l => lawReady(l.law));
function loadLaw(law){
  if (lawReady(law)) return Promise.resolve();
  if (LAW_STATE[law]) return LAW_STATE[law];
  const ix = LAW_INDEX.find(l => l.law === law);
  if (!ix) return Promise.reject(new Error('알 수 없는 규정: ' + law));
  const p = fetch(ix.file).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
    j.articles.forEach(a => { a.law = law; D.articles.push(a); });
    D.extra = D.extra || {}; if (j.extra) D.extra[law] = (D.extraFix && D.extraFix[law]) || j.extra;
    LAW_STATE[law] = 'loaded';
    try { _amendItems = null; } catch (e) { /* 개정 탭이 아직 정의되기 전 */ }
    try { F.idx = null; } catch (e) { /* 검색이 아직 정의되기 전 */ }
  }).catch(e => { delete LAW_STATE[law]; throw e; });
  LAW_STATE[law] = p;
  return p;
}
let ALL_TRIED = false;                                   /* 전체 불러오기를 한 번 시도했는지 (실패해도 무한 반복하지 않도록) */
const loadAllLaws = () => Promise.allSettled(LAW_INDEX.map(l => loadLaw(l.law))).then(rs => { ALL_TRIED = true; return rs.filter(r => r.status === 'rejected').length; });
const needAllLaws = () => !ALL_TRIED && !allLawsReady();
const lawsMissingNote = () => allLawsReady() ? '' : '<div class="note">⚠️ 일부 규정을 불러오지 못해 지금 불러온 규정만 보입니다. <button class="rc" data-lawsretry="1">다시 불러오기</button></div>';
document.addEventListener('click', e => {
  if (!e.target.closest('[data-lawsretry]')) return;
  ALL_TRIED = false; const cur = TABS.find(t => $('#p-' + t[0]).classList.contains('on')); if (cur && renderers[cur[0]]) renderers[cur[0]]();
});
/* 불러오는 동안 안내 문구, 실패하면 다시 시도 버튼 */
function lawLoading(sel, law, then){
  const el = $(sel); if (!el) return;
  el.innerHTML = `<div class="note">⏳ <b>${esc(law)}</b> 불러오는 중…</div>`;
  loadLaw(law).then(then).catch(err => {
    el.innerHTML = `<div class="note">⚠️ <b>${esc(law)}</b> 자료를 불러오지 못했습니다 (${esc(err.message)}). 인터넷 연결을 확인한 뒤 다시 시도하세요.<br><button class="b-red" data-lawretry="1" style="margin-top:8px">다시 시도</button></div>`;
    el.querySelector('[data-lawretry]').onclick = () => lawLoading(sel, law, then);
  });
}
/* 조직법·정관·운영규정 말고는 주제(순위) 대신 장(章) 단위로 범위를 나눈다: 'c3' = 제3장 */
const _inTopic = inTopic;
inTopic = (a, t) => (typeof t === 'string' && t[0] === 'c') ? a.ch === +t.slice(1) : _inTopic(a, t);
const _topicOpts = topicOpts;
topicOpts = function(law){
  if (BASE_LAWS.includes(law)) return _topicOpts(law);
  const ix = LAW_INDEX.find(l => l.law === law);
  return '<option value="0">전체 조문</option>' + (ix ? ix.chapters.map(c => `<option value="c${c.i}">${esc(c.title)}</option>`).join('') : '');
};
/* 참조 링크 대상: 새 규정의 조문·별표도 눌러서 열 수 있게 */
LAW_INDEX.forEach(l => { l.keys.forEach(k => XA.add(l.law + ':' + k)); l.byeol.forEach(n => XB.add(l.law + ':' + n)); });
const LAW_ALIAS = new Map([['조직법', '조직법'], ['정관', '정관'], ['직원운영규정', '운영규정'], ['운영규정', '운영규정'], ['인사관리시행규칙', '인사관리시행규칙'], ['보수운영규정', '보수운영규정'],
  ['재무규정', '재무규정'], ['여비규정', '여비규정'], ['감사운영규정', '감사운영규정'], ['국제인도법', '국제인도법'], ['규약', '국제적십자규약'], ['국제적십자운동규약', '국제적십자규약'], ['적십자운동규약', '국제적십자규약']]);
/* 참조 앞에 법령 이름이 있으면 그 규정으로, 모르는 법령(「민법」 등)이면 null(링크 안 함), 없으면 현재 규정 */
function lawFromPre(pre, def){
  let m = pre.match(/「([^」]{1,30})」\s*$/);
  if (m) return LAW_ALIAS.get(m[1].replace(/^대한적십자사\s*/, '').replace(/\s+/g, '')) || null;
  m = pre.match(/(?:^|[^가-힣])(조직법|정관|직원\s*운영규정|인사관리\s*시행규칙|보수\s*운영규정|재무규정|여비규정|감사\s*운영규정|국제인도법|규약)\s*$/);
  if (m) return LAW_ALIAS.get(m[1].replace(/\s+/g, ''));
  if (/」\s*$/.test(pre)) return null;
  return def;
}
/* 화면이 한가할 때 나머지 규정도 미리 받아 둔다 (검색·개정 탭이 바로 열리도록) */
setTimeout(() => { (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => loadAllLaws().catch(() => {})); }, 6000);
