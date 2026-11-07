
/* ═══════════════ 규정 듣기: 미리 만든 MP3 재생 (음원은 tools/tts_build.py, 목차는 D.tts) ═══════════════
   화면이 꺼져도 이어지도록 <audio> + Media Session 을 쓴다. 이어 듣기 위치·배속은 기기별 편의라 localStorage 에 둔다. */
const TTS = (() => {
  const svg = p => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    head: svg('<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3zM3 15a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z"/>'),
    play: svg('<path d="M7 4v16l13-8z" fill="currentColor"/>'), pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
    prev: svg('<path d="M19 5v14L8 12zM5 5v14"/>'), next: svg('<path d="M5 5v14l11-7zM19 5v14"/>'),
    here: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.5"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'), x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  };
  const RATES = [1, 1.25, 1.5, 0.85];
  const A = new Audio(); A.preload = 'metadata';
  const st = {law: null, ti: -1, open: false, list: false, blob: null, wantT: 0, wantPlay: false, err: ''};
  const man = () => (D.tts || {})[st.law];
  const trk = () => { const m = man(); return m ? m.tracks[st.ti] : null; };
  const store = () => { try { return JSON.parse(localStorage.getItem('tts-pos') || '{}'); } catch(e){ return {}; } };
  const keep = () => { try { const s = store(); s.rate = A.playbackRate; if (st.law && st.ti >= 0) s[st.law] = {ti: st.ti, f: man().tracks[st.ti].file, t: Math.floor(A.currentTime)}; localStorage.setItem('tts-pos', JSON.stringify(s)); } catch(e){} };
  const clock = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const markAt = (t, x) => { let m = null; for (const k of t.marks){ if (k.t <= x + .05) m = k; else break; } return m; };
  const nowLabel = () => { const t = trk(); if (!t) return ''; const m = markAt(t, A.currentTime); return m ? m.label : t.title; };

  let fab = null;
  function bar(){
    let b = document.getElementById('tts-bar'); if (b) return b;
    b = document.createElement('div'); b.id = 'tts-bar'; b.hidden = true;
    b.innerHTML = `<div class="tts-top"><b id="tts-now"></b><span id="tts-time" class="mute"></span><button class="tts-ic" data-t="close" aria-label="닫기" title="닫기">${I.x}</button></div>
      <input id="tts-seek" type="range" min="0" max="100" step="1" value="0" aria-label="재생 위치">
      <div class="tts-ctl"><button class="tts-ic" data-t="here" aria-label="보고 있는 조문부터" title="보고 있는 조문부터">${I.here}</button>
      <button class="tts-ic" data-t="prev" aria-label="이전 조문" title="이전 조문">${I.prev}</button>
      <button class="tts-ic tts-main" data-t="toggle" aria-label="재생" title="재생">${I.play}</button>
      <button class="tts-ic" data-t="next" aria-label="다음 조문" title="다음 조문">${I.next}</button>
      <button class="tts-rate" data-t="rate" aria-label="재생 속도" title="재생 속도"></button>
      <button class="tts-ic" data-t="list" aria-label="트랙 목록" title="트랙 목록" aria-pressed="false">${I.list}</button></div>
      <div id="tts-list" hidden></div>`;
    document.body.appendChild(b);
    b.addEventListener('click', e => {
      const c = e.target.closest('[data-tti]'); if (c){ load(+c.dataset.tti, 0, true); return; }
      const t = e.target.closest('[data-t]'); if (t) act(t.dataset.t);
    });
    const s = b.querySelector('#tts-seek');
    s.addEventListener('input', () => { seek(+s.value); paint(); });
    const f = document.createElement('button'); f.id = 'tts-fab'; f.hidden = true; f.innerHTML = I.head; f.setAttribute('aria-label', '규정 듣기'); f.title = '규정 듣기';
    f.addEventListener('click', openBar); fab = f;
    return b;
  }
  const hereNo = () => {
    const top = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 100) + 40; let c = null;
    for (const a of document.querySelectorAll('#r-body .art[id^="a-"]')){ if (a.getBoundingClientRect().top > top) break; c = a; }
    return c ? c.id.slice(c.id.lastIndexOf(':') + 1) : null;
  };
  function goHere(play){
    const m = man(), no = hereNo(); if (!m) return false;
    const keys = (D.lawIndex.find(x => x.law === st.law) || {keys: []}).keys, i0 = no ? keys.indexOf(no) : 0;
    for (const k of keys.slice(Math.max(i0, 0))){   /* 삭제된 조는 음원에 없으니 다음 조문부터 */
      for (let i = 0; i < m.tracks.length; i++){
        if (m.tracks[i].kind !== 'law') continue;
        const a = m.tracks[i].marks.find(x => x.no === k);
        if (a){ load(i, a.t, play); return true; }
      }
    }
    return false;
  }
  function openBar(){
    bar(); st.open = true; st.law = R.law; let p = store()[st.law]; const r = store().rate;
    if (r) A.playbackRate = r;
    if (p && p.f){ const i = man().tracks.findIndex(x => x.file === p.f); if (i >= 0) p.ti = i; else p = null; }   /* 트랙 순서가 바뀌어도 같은 파일에서 이어 듣는다 */
    if (p && man().tracks[p.ti]) load(p.ti, p.t, true); else if (!goHere(true)) load(0, 0, true);
    drawList(); sync();
  }
  function load(ti, t, play){
    const m = man(); if (!m || !m.tracks[ti]) return;
    if (ti === st.ti && !st.err){ seek(t); if (play) A.play().catch(fail); paint(); return; }
    if (st.blob){ URL.revokeObjectURL(st.blob); st.blob = null; }
    st.ti = ti; st.wantT = t; st.wantPlay = play; st.err = ''; A.src = m.tracks[ti].file; A.load();
    if (play) A.play().catch(() => {});    /* 사용자 제스처 안에서 부른다. 실패는 error 이벤트로 처리 */
    drawList(); paint();
  }
  /* 서버가 Range 를 안 주면 탐색이 안 되고, 정책에 따라 직접 src 가 막힐 수 있어 통째로 받아 재생한다 */
  async function viaBlob(){
    if (st.blob) return fail();
    const ti = st.ti, t = trk();
    try {
      const r = await fetch(t.file); if (!r.ok) throw new Error('HTTP ' + r.status);
      const u = URL.createObjectURL(await r.blob()); if (ti !== st.ti){ URL.revokeObjectURL(u); return; }
      st.blob = u; A.src = u; A.load(); if (st.wantPlay) A.play().catch(() => {});
    } catch(e){ fail(); }
  }
  function seek(t){
    const r = A.seekable; let okay = t === 0;
    for (let i = 0; i < r.length; i++) if (t >= r.start(i) && t <= r.end(i)) okay = true;
    if (okay || st.blob){ A.currentTime = t; return; }
    st.wantT = t; st.wantPlay = !A.paused; viaBlob();
  }
  function fail(e){ if (e && e.name === 'NotAllowedError') return paint(); st.err = '재생할 수 없습니다'; paint(); }
  A.addEventListener('error', () => { if (A.src) viaBlob(); });
  A.addEventListener('loadedmetadata', () => {
    const t = st.wantT; if (!t) return;
    const seekable = A.seekable.length && A.seekable.end(A.seekable.length - 1) >= t;
    if (!seekable && !st.blob){ viaBlob(); return; }
    st.wantT = 0; A.currentTime = t;
  });
  function act(k){
    const t = trk();
    if (k === 'close'){ A.pause(); keep(); st.open = false; st.list = false; drawList(); sync(); return; }
    if (k === 'toggle'){ A.paused ? A.play().catch(fail) : A.pause(); return; }
    if (k === 'here'){ st.law === R.law && goHere(true); return; }
    if (k === 'rate'){ const i = RATES.indexOf(A.playbackRate); A.playbackRate = RATES[(i + 1) % RATES.length]; keep(); paint(); return; }
    if (k === 'list'){ st.list = !st.list; drawList(); return; }
    if (!t) return;
    const x = A.currentTime, ms = t.marks;
    if (k === 'next'){ const n = ms.find(m => m.t > x + .05); n ? seek(n.t) : nextTrack(); paint(); }
    if (k === 'prev'){
      const b = ms.filter(m => m.t < x - 2).pop();
      if (b) seek(b.t); else if (st.ti > 0 && x < 3 && man().tracks[st.ti - 1].kind === t.kind){ const p = man().tracks[st.ti - 1]; load(st.ti - 1, (p.marks[p.marks.length - 1] || {t: 0}).t, true); } else seek(0);
      paint();
    }
  }
  function nextTrack(){ const m = man(), n = m.tracks[st.ti + 1]; if (n && n.kind === m.tracks[st.ti].kind) load(st.ti + 1, 0, true); else { A.pause(); paint(); } }
  A.addEventListener('ended', nextTrack);
  function drawList(){
    const box = document.getElementById('tts-list'), m = man(); if (!box || !m) return;
    box.hidden = !st.list; document.body.classList.toggle('tts-list', st.list); document.querySelector('#tts-bar [data-t="list"]').setAttribute('aria-pressed', st.list);
    const g = (k, n) => !m.tracks.some(t => t.kind === k) ? '' : `<div class="tts-g"><span class="mute">${n}</span>${m.tracks.map((t, i) => t.kind !== k ? '' : `<button class="tts-chip" data-tti="${i}" aria-pressed="${i === st.ti}">${esc(t.title.replace(/^제\d+장 /, ''))}</button>`).join('')}</div>`;
    box.innerHTML = g('law', '원문') + g('qa', 'Q&A') + g('narration', '해설');   /* 트랙이 없는 묶음은 감춘다 */
  }
  let lastLabel = '';
  function paint(){
    const b = document.getElementById('tts-bar'); if (!b || !st.open) return;
    const t = trk(), l = st.err || nowLabel(), p = b.querySelector('[data-t="toggle"]'), s = b.querySelector('#tts-seek');
    b.querySelector('#tts-now').textContent = l;
    const dur = t ? t.sec : 0;
    b.querySelector('#tts-time').textContent = `${clock(A.currentTime)} / ${clock(dur)}`;
    s.max = dur; if (document.activeElement !== s) s.value = A.currentTime;
    b.querySelector('.tts-rate').textContent = `${A.playbackRate}×`;
    p.innerHTML = A.paused ? I.play : I.pause; p.setAttribute('aria-label', A.paused ? '재생' : '일시정지'); p.title = p.getAttribute('aria-label');
    if ('mediaSession' in navigator && l !== lastLabel && t){
      lastLabel = l;
      try { navigator.mediaSession.metadata = new MediaMetadata({title: l, artist: st.law, album: t.title}); } catch(e){}
    }
  }
  function sync(){
    bar();
    const b = document.getElementById('tts-bar'), f = fab, fs = document.getElementById('fabs');
    if (fs && f.parentNode !== fs) fs.prepend(f);    /* #fabs 는 회독 화면에서 나중에 생기고 다시 그려진다 */
    const tab = typeof curTab === 'function' ? curTab() : '';
    b.hidden = !st.open; f.hidden = st.open || !(tab === 'read' && (D.tts || {})[R.law]);
    document.body.classList.toggle('tts-open', st.open); paint();
  }
  ['play', 'pause', 'ratechange', 'durationchange', 'seeked'].forEach(e => A.addEventListener(e, paint));
  A.addEventListener('pause', keep);
  let tick = 0;
  A.addEventListener('timeupdate', () => { paint(); if (++tick % 20 === 0) keep(); });
  if ('mediaSession' in navigator){
    const ms = navigator.mediaSession, on = (k, f) => { try { ms.setActionHandler(k, f); } catch(e){} };
    on('play', () => A.play()); on('pause', () => A.pause());
    on('previoustrack', () => act('prev')); on('nexttrack', () => act('next'));
    on('seekto', d => seek(d.seekTime));
  }
  return {sync, A, st, openBar, act};
})();
{ const _s = showTab; showTab = function(id){ _s(id); try { TTS.sync(); } catch(e){ console.warn(e); } };
  const _c = syncChips; syncChips = function(){ _c(); try { TTS.sync(); } catch(e){ console.warn(e); } }; }
