// AI 造物指南 — 交互：进度打卡、朗读、专注/宽松模式、测验、复制、搜索
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.body.dataset.root || '';
  const G = window.GUIDE || [];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('aig:' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('aig:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  let done = new Set(store.get('done', []));
  const saveDone = () => store.set('done', [...done]);

  // ---- 偏好 ----
  const prefs = store.get('prefs', { fs: 19, calm: false, focus: false, still: false });
  const applyPrefs = () => {
    document.documentElement.style.setProperty('--fs', prefs.fs + 'px');
    document.body.classList.toggle('calm', prefs.calm);
    document.body.classList.toggle('focus', prefs.focus);
    document.body.classList.toggle('still', prefs.still);
    $$('[data-act="calm"]').forEach(b => b.classList.toggle('on', prefs.calm));
    $$('[data-act="focus"]').forEach(b => b.classList.toggle('on', prefs.focus));
    $$('[data-act="motion"]').forEach(b => b.classList.toggle('on', prefs.still));
    store.set('prefs', prefs);
  };
  applyPrefs();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'font+') prefs.fs = Math.min(26, prefs.fs + 1);
    if (a === 'font-') prefs.fs = Math.max(15, prefs.fs - 1);
    if (a === 'calm') prefs.calm = !prefs.calm;
    if (a === 'focus') prefs.focus = !prefs.focus;
    if (a === 'motion') prefs.still = !prefs.still;
    if (a === 'rand') {
      const pool = G.filter(x => !done.has(x.s)); const arr = pool.length ? pool : G;
      const pick = arr[Math.floor(Math.random() * arr.length)];
      if (pick) location.href = root + 'c/' + pick.s + '.html';
      return;
    }
    applyPrefs();
  });

  // ---- 阅读进度条 ----
  const bar = $('#readbar');
  const onScroll = () => {
    const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---- 撒花 ----
  function burst(chars) {
    let el = $('#burst'); if (!el) { el = document.createElement('div'); el.id = 'burst'; document.body.appendChild(el); }
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.textContent = chars[i % chars.length];
      s.style.left = 50 + (Math.random() * 20 - 10) + '%'; s.style.top = '60%';
      s.style.setProperty('--x', (Math.random() * 600 - 300) + 'px');
      s.style.setProperty('--y', (-Math.random() * 500 - 100) + 'px');
      el.appendChild(s); setTimeout(() => s.remove(), 1500);
    }
  }

  // ---- 朗读（对阅读障碍很有用） ----
  let speaking = null;
  function speak(btn, ids) {
    if (!('speechSynthesis' in window)) { alert('这个浏览器不支持朗读，换 Chrome / Edge 试试'); return; }
    if (speaking === btn) { speechSynthesis.cancel(); btn.classList.remove('playing'); speaking = null; return; }
    speechSynthesis.cancel(); $$('.say.playing').forEach(x => x.classList.remove('playing'));
    const text = ids.split(' ').map(id => { const n = document.getElementById(id); if (!n) return '';
      const c = n.cloneNode(true); $$('button,.say', c).forEach(x => x.remove()); return c.innerText; }).join('。')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '');
    const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.92;
    const v = speechSynthesis.getVoices().find(v => /zh[-_]CN/i.test(v.lang)); if (v) u.voice = v;
    u.onend = () => { btn.classList.remove('playing'); speaking = null; };
    btn.classList.add('playing'); speaking = btn; speechSynthesis.speak(u);
  }
  $$('.say').forEach(b => b.addEventListener('click', () => speak(b, b.dataset.say || b.closest('.blk').id)));

  // ---- 概念页 ----
  const cp = $('.cp');
  if (cp) {
    const slug = cp.dataset.slug;
    // 复制
    const cb = $('.copy');
    cb && cb.addEventListener('click', async () => {
      const t = $('.prompt').innerText;
      try { await navigator.clipboard.writeText(t); } catch (e) {
        const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      cb.textContent = '✅ 复制好了，去粘贴给 AI 吧'; cb.classList.add('ok');
      setTimeout(() => { cb.textContent = '📋 一键复制'; cb.classList.remove('ok'); }, 2200);
    });
    // 测验
    const ans = +cp.dataset.answer; let solved = false;
    $$('.opt').forEach(o => o.addEventListener('click', () => {
      if (solved) return;
      const i = +o.dataset.i;
      if (i === ans) { o.classList.add('right'); solved = true; $('.why').hidden = false; burst(['🎉', '✨', '⭐', '🥳']); }
      else { o.classList.remove('wrong'); void o.offsetWidth; o.classList.add('wrong'); o.textContent = o.textContent.replace(/^(.)\./, '$1.') ; }
    }));
    // 学会了
    const db = $('.done');
    const paint = () => { const is = done.has(slug); db.classList.toggle('is', is); db.textContent = is ? '✅ 已学会（再点取消）' : '🙋 我学会了！'; };
    paint();
    db.addEventListener('click', () => {
      if (done.has(slug)) done.delete(slug); else { done.add(slug); burst(['🌟', '💪', '🎈', '✅']); }
      saveDone(); paint();
    });
    // 段落导航 + 专注模式
    const blocks = $$('.blk'); const navs = $$('.steps-nav a');
    const io = new IntersectionObserver(es => {
      es.forEach(en => { if (en.isIntersecting) {
        blocks.forEach(b => b.classList.toggle('active', b === en.target));
        navs.forEach(a => { const on = a.getAttribute('href') === '#' + en.target.id; a.classList.toggle('cur', on); if (on) a.classList.add('seen'); });
      } });
    }, { rootMargin: '-45% 0px -45% 0px' });
    blocks.forEach(b => io.observe(b));
    // 键盘：← → 翻页
    addEventListener('keydown', e => {
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowRight') { const n = $('.pn.next'); n && (location.href = n.href); }
      if (e.key === 'ArrowLeft') { const p = $('.pn.prev'); p && (location.href = p.href); }
    });
  }

  // ---- 首页 ----
  if (document.body.classList.contains('is-home')) {
    $$('.tile').forEach(t => t.classList.toggle('done', done.has(t.dataset.slug)));
    const paintProg = () => {
      const by = {}; G.forEach(x => { by[x.l] = by[x.l] || [0, 0]; by[x.l][1]++; if (done.has(x.s)) by[x.l][0]++; });
      const all = [G.filter(x => done.has(x.s)).length, G.length];
      $$('.pgf').forEach(f => { const v = f.dataset.lv === '*' ? all : (by[f.dataset.lv] || [0, 1]); f.style.width = (v[0] / v[1] * 100) + '%'; });
      $$('.pgt').forEach(f => { const v = f.dataset.lvt === '*' ? all : (by[f.dataset.lvt] || [0, 0]); f.textContent = v[0] + ' / ' + v[1]; });
    };
    setTimeout(paintProg, 200);
    $$('.lvc').forEach(c => c.addEventListener('click', () => { const d = document.querySelector(c.getAttribute('href')); if (d) d.open = true; }));
    const q = $('#q'), qn = $('#qn');
    q && q.addEventListener('input', () => {
      const k = q.value.trim().toLowerCase(); let n = 0;
      $$('.tile').forEach(t => { const hit = !k || (t.dataset.s ||= t.textContent.toLowerCase()).includes(k); t.classList.toggle('hide', !hit); if (hit) n++; });
      $$('.grp').forEach(g => g.style.display = $$('.tile:not(.hide)', g).length ? '' : 'none');
      $$('.lvsec').forEach(s => { const n2 = $$('.tile:not(.hide)', s).length; s.style.display = n2 ? '' : 'none'; if (k && n2) s.open = true; });
      qn.textContent = k ? `找到 ${n} 个` : '';
    });
  }
  // ---- 词汇表 ----
  const gq = $('#gq');
  gq && gq.addEventListener('input', () => {
    const k = gq.value.trim().toLowerCase();
    $$('.glt tbody tr').forEach(r => r.classList.toggle('hide', !!k && !r.dataset.s.includes(k)));
  });
})();
