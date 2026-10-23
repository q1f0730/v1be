// AI 造物指南 v2 — 交互：进度打卡、朗读、阅读设置、搜索、测验、复制、卡片模式
// localStorage 键（沿用旧版，进度不丢）：aig:done（已学会列表）、aig:prefs（阅读设置）；新增 aig:last（上次看到的概念）
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.body.dataset.root || '';
  const G = window.GUIDE || [];
  const META = window.GUIDE_META || { levels: [], cats: {} };
  const LVCLS = {}; META.levels.forEach(l => { LVCLS[l.name] = l; });
  const BYS = {}; G.forEach(x => { BYS[x.s] = x; });
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('aig:' + k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('aig:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = s => root + 'c/' + s + '.html';
  let done = new Set(store.get('done', []));
  const saveDone = () => store.set('done', [...done]);
  const mqMobile = matchMedia('(max-width:1023px)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 阅读设置 ----------
  const hadPrefs = localStorage.getItem('aig:prefs') != null;
  const prefs = Object.assign({ fs: 18, calm: false, focus: false, still: false }, store.get('prefs', {}));
  if (!hadPrefs && reduce) prefs.still = true;          // 系统要求少动画 → 默认定格
  const applyPrefs = () => {
    document.documentElement.style.setProperty('--fs', prefs.fs + 'px');
    document.body.classList.toggle('calm', !!prefs.calm);
    document.body.classList.toggle('focus', !!prefs.focus);
    document.body.classList.toggle('still', !!prefs.still);
    $$('[data-act="calm"]').forEach(b => { b.classList.toggle('on', !!prefs.calm); b.setAttribute('aria-pressed', !!prefs.calm); });
    $$('[data-act="focus"]').forEach(b => { b.classList.toggle('on', !!prefs.focus); b.setAttribute('aria-pressed', !!prefs.focus); });
    $$('[data-act="motion"]').forEach(b => { b.classList.toggle('on', !!prefs.still); b.setAttribute('aria-pressed', !!prefs.still); });
    const v = $('#fsv'); if (v) v.textContent = prefs.fs;
    store.set('prefs', prefs);
  };
  applyPrefs();

  // ---------- 浮层：设置 / 搜索 ----------
  const scrim = $('#scrim'), setp = $('#setp'), sov = $('#sov');
  let lastFocus = null;
  function openLayer(el) {
    closeLayers(); lastFocus = document.activeElement;
    el.hidden = false; if (el === setp) scrim.hidden = false;
    const f = el === sov ? $('#sq') : $('button', el); f && f.focus();
    if (el === sov) { $('#sq').value = ''; $('#sres').innerHTML = ''; }
  }
  function closeLayers() {
    [setp, sov, scrim].forEach(x => x && (x.hidden = true));
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  }
  scrim && scrim.addEventListener('click', closeLayers);
  sov && sov.addEventListener('click', e => { if (e.target === sov || e.target.classList.contains('sov-in')) closeLayers(); });

  const randPick = () => {
    const pool = G.filter(x => !done.has(x.s)); const arr = pool.length ? pool : G;
    return arr[Math.floor(Math.random() * arr.length)];
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'font+') prefs.fs = Math.min(26, prefs.fs + 1);
    else if (a === 'font-') prefs.fs = Math.max(15, prefs.fs - 1);
    else if (a === 'calm') prefs.calm = !prefs.calm;
    else if (a === 'focus') prefs.focus = !prefs.focus;
    else if (a === 'motion') prefs.still = !prefs.still;
    else if (a === 'settings') { setp.hidden ? openLayer(setp) : closeLayers(); return; }
    else if (a === 'search') { openLayer(sov); return; }
    else if (a === 'close') { closeLayers(); return; }
    else if (a === 'rand') { const p = randPick(); if (p) location.href = url(p.s); return; }
    else return;
    applyPrefs();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ((setp && !setp.hidden) || (sov && !sov.hidden)) { closeLayers(); e.preventDefault(); } }
    if (e.key === '/' && !e.target.closest('input,textarea') && sov) { e.preventDefault(); openLayer(sov); }
  });

  // ---------- 搜索（首页卡片 + 全站浮层共用） ----------
  function find(k, max) {
    k = k.trim().toLowerCase(); if (!k) return [];
    const res = [];
    G.forEach((x, i) => {
      const z = x.z.toLowerCase(), n = x.n.toLowerCase();
      let sc = -1;
      if (z === k || n === k || x.s === k) sc = 0;
      else if (z.startsWith(k) || n.startsWith(k)) sc = 1;
      else if (z.includes(k) || n.includes(k) || x.s.includes(k.replace(/\s+/g, '-'))) sc = 2;
      else if (x.o.toLowerCase().includes(k)) sc = 3;
      if (sc >= 0) res.push([sc, i, x]);
    });
    return res.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, max).map(r => r[2]);
  }
  function bindSearch(input, list, max) {
    if (!input || !list) return;
    let cur = -1;
    const paintCur = () => $$('li', list).forEach((li, i) => { li.classList.toggle('cur', i === cur); li.setAttribute('aria-selected', i === cur); if (i === cur) li.scrollIntoView({ block: 'nearest' }); });
    const render = () => {
      const k = input.value; const r = find(k, max); cur = r.length ? 0 : -1;
      if (!k.trim()) { list.innerHTML = ''; return; }
      list.innerHTML = r.length ? r.map(x => {
        const lv = LVCLS[x.l] || { cls: '', emo: '' };
        return `<li role="option"><a href="${url(x.s)}"><span class="se">${esc(x.e)}</span><span class="sx"><b>${esc(x.z)}${done.has(x.s) ? ' ✅' : ''}</b><small>${esc(x.n)} · ${esc(x.o)}</small></span><span class="lvb sl ${lv.cls}">${lv.emo} ${esc(x.l)}</span></a></li>`;
      }).join('') : '<li class="none">没找到。换个说法，或者试试英文 🙂</li>';
      paintCur();
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', e => {
      const n = $$('li a', list).length;
      if (e.key === 'ArrowDown' && n) { cur = (cur + 1) % n; paintCur(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && n) { cur = (cur - 1 + n) % n; paintCur(); e.preventDefault(); }
      else if (e.key === 'Enter') { const a = $$('li a', list)[Math.max(cur, 0)]; if (a) location.href = a.href; }
      else if (e.key === 'Escape' && list.id === 'hres') { input.value = ''; list.innerHTML = ''; }
    });
    if (list.id === 'hres') document.addEventListener('click', e => { if (!e.target.closest('.srch')) list.innerHTML = ''; });
  }
  bindSearch($('#sq'), $('#sres'), 12);
  bindSearch($('#hq'), $('#hres'), 8);

  // ---------- 阅读进度条 ----------
  const bar = $('#readbar');
  const onScroll = () => {
    const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- 撒花 ----------
  function burst(chars) {
    if (prefs.still) return;
    let el = $('#burst'); if (!el) { el = document.createElement('div'); el.id = 'burst'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.textContent = chars[i % chars.length];
      s.style.left = 50 + (Math.random() * 20 - 10) + '%'; s.style.top = '60%';
      s.style.setProperty('--x', (Math.random() * 600 - 300) + 'px');
      s.style.setProperty('--y', (-Math.random() * 500 - 100) + 'px');
      el.appendChild(s); setTimeout(() => s.remove(), 1500);
    }
  }

  // ---------- 朗读 ----------
  let speaking = null;
  function speak(btn, ids) {
    if (!('speechSynthesis' in window)) { alert('这个浏览器不支持朗读，换 Chrome / Edge 试试'); return; }
    if (speaking === btn) { speechSynthesis.cancel(); btn.classList.remove('playing'); speaking = null; return; }
    speechSynthesis.cancel(); $$('.say.playing').forEach(x => x.classList.remove('playing'));
    const text = ids.split(' ').map(id => { const n = document.getElementById(id); if (!n) return '';
      const c = n.cloneNode(true); $$('button,.say,.tag,.meta', c).forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' '); }).join('。')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '');
    const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.92;
    const v = speechSynthesis.getVoices().find(v => /zh[-_]CN/i.test(v.lang)); if (v) u.voice = v;
    u.onend = () => { btn.classList.remove('playing'); speaking = null; };
    btn.classList.add('playing'); speaking = btn; speechSynthesis.speak(u);
  }
  $$('.say').forEach(b => b.addEventListener('click', () => speak(b, b.dataset.say || b.closest('.sec').id)));

  // ---------- 进度统计（首页 / 级别页共用） ----------
  function stats() {
    const by = {}; G.forEach(x => { by[x.l] = by[x.l] || [0, 0]; by[x.l][1]++; if (done.has(x.s)) by[x.l][0]++; });
    by['*'] = [G.filter(x => done.has(x.s)).length, G.length];
    return by;
  }
  function paintProgress() {
    const by = stats();
    $$('[data-bar]').forEach(f => { const v = by[f.dataset.bar] || [0, 1]; f.style.width = (v[1] ? v[0] / v[1] * 100 : 0) + '%'; });
    $$('[data-lvt]').forEach(f => { const v = by[f.dataset.lvt] || [0, 0]; f.textContent = f.closest('.rw') ? `${v[0]}/${v[1]}` : `${v[0]} / ${v[1]}`; });
    $$('[data-num]').forEach(f => { const v = by[f.dataset.num] || [0, 0]; f.textContent = v[0]; });
    $$('[data-ring]').forEach(f => { const v = by[f.dataset.ring] || [0, 1]; f.style.strokeDashoffset = 125.7 * (1 - (v[1] ? v[0] / v[1] : 0)); });
  }

  // ---------- 概念页 ----------
  const cp = $('.cp');
  if (cp) {
    const slug = cp.dataset.slug;
    store.set('last', slug);
    // 专业模式：记住选择；小白页若开了专业模式且有专业版，自动跳过去
    const isPro = document.body.classList.contains('is-pro');
    if (!isPro && prefs.pro && cp.dataset.pro) { location.replace(slug + '.pro.html' + location.search); return; }
    $$('.prosw').forEach(a => a.addEventListener('click', () => { prefs.pro = a.dataset.mode === 'pro'; store.set('prefs', prefs); }));
    $$('.ccopy').forEach(b => b.addEventListener('click', async () => {
      const t = b.closest('.codebox').querySelector('code').innerText;
      try { await navigator.clipboard.writeText(t); } catch (e) {
        const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      b.textContent = '已复制'; b.classList.add('ok'); setTimeout(() => { b.textContent = '复制'; b.classList.remove('ok'); }, 1800);
    }));
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
      if (+o.dataset.i === ans) { o.classList.add('right'); solved = true; $('.why').hidden = false; burst(['🎉', '✨', '⭐', '🥳']); }
      else { o.classList.remove('wrong'); void o.offsetWidth; o.classList.add('wrong'); }
    }));
    // 学会了
    const dbs = $$('.done');
    const paint = () => {
      const is = done.has(slug);
      dbs.forEach(b => { b.classList.toggle('is', is); b.setAttribute('aria-pressed', is);
        b.textContent = b.dataset.compact ? (is ? '✅ 已学会' : '🙋 我学会了') : (is ? '✅ 已学会（再点取消）' : '🙋 我学会了！'); });
    };
    paint();
    dbs.forEach(b => b.addEventListener('click', () => {
      if (done.has(slug)) done.delete(slug); else { done.add(slug); burst(['🌟', '💪', '🎈', '✅']); }
      saveDone(); paint();
    }));

    // 区块 + 目录 + 卡片模式
    const secs = $$('.sec');
    const ids = secs.map(s => s.id);
    const railA = $$('.rail-list a'), chips = $$('.sc-chip');
    const strip = $('.strip'), modeBtn = $('.modebtn');
    const prevc = $('.prevc'), nextc = $('.nextc');
    const prevUrl = cp.dataset.prev, nextUrl = cp.dataset.next;
    let idx = Math.max(0, ids.indexOf(location.hash.slice(1)));
    const seen = new Set();
    const mark = id => {
      seen.add(id);
      secs.forEach(s => s.classList.toggle('active', s.id === id));
      [...railA, ...chips].forEach(a => { const on = a.dataset.sec === id; a.classList.toggle('cur', on); if (seen.has(a.dataset.sec)) a.classList.add('seen'); });
      const c = chips.find(c => c.dataset.sec === id);
      if (c && strip) { const r = c.getBoundingClientRect(), sr = strip.getBoundingClientRect(); strip.scrollTo({ left: strip.scrollLeft + r.left - sr.left - sr.width / 2 + r.width / 2, behavior: reduce ? 'auto' : 'smooth' }); }
    };
    const cardMode = () => mqMobile.matches && !prefs.all;
    function paintBar() {
      if (!prevc) return;
      if (cardMode()) {
        prevc.textContent = idx === 0 ? '‹ 上一个' : '‹ 上一张';
        prevc.disabled = idx === 0 && !prevUrl;
        const last = idx === secs.length - 1;
        nextc.textContent = last ? (nextUrl ? '下一个概念 ›' : '回首页 ›') : '下一张 ›';
        nextc.classList.toggle('tonext', last);
      } else {
        prevc.textContent = '‹ 上一个'; prevc.disabled = !prevUrl;
        nextc.textContent = nextUrl ? '下一个 ›' : '回首页 ›'; nextc.classList.add('tonext');
      }
    }
    function show(i, dir) {
      idx = Math.max(0, Math.min(secs.length - 1, i));
      secs.forEach((s, j) => { s.classList.toggle('cur', j === idx); });
      if (dir) secs[idx].style.setProperty('--dir', dir > 0 ? '16px' : '-16px');
      history.replaceState(null, '', '#' + ids[idx]);
      mark(ids[idx]); paintBar();
      const ch = $('.cardhint');
      if (ch) {
        const nx = chips[idx + 1];
        $('.ch-t', ch).innerHTML = nx ? '下一张 › <b>' + nx.textContent + '</b>' : (nextUrl ? '最后一张啦，右下角去下一个概念' : '最后一张了');
        $('.dots', ch).innerHTML = secs.map((_, j) => '<i class="' + (j === idx ? 'on' : '') + '"></i>').join('');
      }
      const wrap = $('.strip-wrap');
      if (wrap) { const y = wrap.getBoundingClientRect().top + scrollY - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topH') || 58); if (scrollY > y + 2) scrollTo({ top: y, behavior: 'auto' }); }
    }
    function setMode() {
      const cm = cardMode();
      document.body.classList.toggle('cardmode', cm);
      if (modeBtn) { modeBtn.textContent = prefs.all ? '🃏 一张一张' : '☰ 全部展开'; modeBtn.setAttribute('aria-pressed', !!prefs.all); }
      if (cm) show(idx); else { secs.forEach(s => s.classList.remove('cur')); paintBar(); }
    }
    modeBtn && modeBtn.addEventListener('click', () => { prefs.all = !prefs.all; store.set('prefs', prefs); setMode(); if (!prefs.all) show(idx); });
    (mqMobile.addEventListener ? mqMobile.addEventListener('change', setMode) : mqMobile.addListener(setMode));
    const go = u => { if (u) location.href = u; else location.href = root + 'index.html'; };
    prevc && prevc.addEventListener('click', () => { if (cardMode() && idx > 0) show(idx - 1, -1); else if (prevUrl) go(prevUrl); });
    nextc && nextc.addEventListener('click', () => { if (cardMode() && idx < secs.length - 1) show(idx + 1, 1); else go(nextUrl); });
    chips.forEach(c => c.addEventListener('click', e => {
      if (!cardMode()) return; e.preventDefault(); const j = ids.indexOf(c.dataset.sec); show(j, j > idx ? 1 : -1);
    }));
    // 手机左右滑动翻卡
    let tx = null, ty = null;
    const cb2 = $('.cbento');
    cb2 && cb2.addEventListener('touchstart', e => {
      if (!cardMode() || e.target.closest('.tw,.sc,pre')) { tx = null; return; }
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    }, { passive: true });
    cb2 && cb2.addEventListener('touchend', e => {
      if (tx == null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) { if (dx < 0 && idx < secs.length - 1) show(idx + 1, 1); else if (dx > 0 && idx > 0) show(idx - 1, -1); }
    }, { passive: true });
    // 滚动时点亮目录（桌面 / 全部展开）
    const io = new IntersectionObserver(es => {
      if (cardMode()) return;
      es.forEach(en => { if (en.isIntersecting) mark(en.target.id); });
    }, { rootMargin: '-35% 0px -55% 0px' });
    secs.forEach(b => io.observe(b));
    // 键盘：← → 翻卡 / 翻页
    addEventListener('keydown', e => {
      if (e.target.closest('input,textarea') || e.altKey || e.metaKey || e.ctrlKey) return;
      if (!setp.hidden || !sov.hidden) return;
      if (e.key === 'ArrowRight') { cardMode() && idx < secs.length - 1 ? show(idx + 1, 1) : nextUrl && go(nextUrl); }
      if (e.key === 'ArrowLeft') { cardMode() && idx > 0 ? show(idx - 1, -1) : prevUrl && go(prevUrl); }
    });
    setMode();
    if (!cardMode() && location.hash) { /* 桌面直接定位 */ }
  }

  // ---------- 首页 ----------
  if (document.body.classList.contains('is-home')) {
    paintProgress();
    const last = store.get('last', null);
    const rb = $('#resume'), rs = $('#resume-sub');
    if (last && BYS[last]) {
      const x = BYS[last];
      rb.href = url(x.s); rb.textContent = '▶ 继续学习';
      rs.textContent = '上次看到：' + x.e + ' ' + x.z;
    }
    // 今日推荐：按日期固定挑一个没学过的
    const t = $('#today .today-body');
    if (t) {
      const pool = G.filter(x => !done.has(x.s));
      if (!pool.length) {
        t.innerHTML = `<div class="today-done"><img src="${root}assets/mascot-sm.webp" alt=""><p><b>${G.length} 个全学会了！</b><br>随便挑一个复习吧。</p></div>`;
      } else {
        const d = new Date(); const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const x = pool[h % pool.length]; const lv = LVCLS[x.l] || { cls: '', emo: '' };
        t.innerHTML = `<a class="today-c" href="${url(x.s)}"><span class="te">${esc(x.e)}</span><span><b>${esc(x.z)}</b><small>${esc(x.n)}</small></span></a>
          <p class="today-ol">${esc(x.o)}</p>
          <a class="btn pri" href="${url(x.s)}">去看看 →</a>`;
        t.closest('.today').classList.add(lv.cls);
      }
    }
  }

  // ---------- 级别页 ----------
  const lvp = $('.lvp');
  if (lvp) {
    const level = lvp.dataset.level;
    const items = G.filter(x => x.l === level);
    paintProgress();
    $$('.cc').forEach(c => c.classList.toggle('done', done.has(c.dataset.slug)));
    const nx = items.find(x => !done.has(x.s));
    const nb = $('#nextun'), ns = $('#nextun-sub');
    if (nx) { nb.href = url(nx.s); ns.textContent = '下一个：' + nx.e + ' ' + nx.z; }
    else {
      const li = META.levels.findIndex(l => l.name === level); const nl = META.levels[li + 1];
      nb.textContent = nl ? `🎉 全学会了！去${nl.name} →` : '🎉 全部学会了！'; nb.href = nl ? nl.cls + '.html' : '../index.html';
      ns.textContent = '这一级的概念你都点过「我学会了」。';
    }
    const tabs = $$('.tab'), panels = $$('.catp');
    const catStat = {};
    panels.forEach(p => {
      const k = p.dataset.cat; const cs = $$('.cc', p); const d = cs.filter(c => c.classList.contains('done')).length;
      catStat[k] = [d, cs.length];
      $('[data-catdone]', p).textContent = d ? `${d} / ${cs.length} 已学会` : `${cs.length} 个`;
      $('.catdone-msg', p).hidden = d !== cs.length;
    });
    tabs.forEach(t => { const v = catStat[t.dataset.cat]; if (!v) return; const em = $('em', t);
      em.textContent = v[0] ? `${v[0]}/${v[1]}` : v[1]; t.classList.toggle('alldone', v[0] === v[1]); });
    const firstOpen = (panels.find(p => catStat[p.dataset.cat][0] < catStat[p.dataset.cat][1]) || panels[0]).dataset.cat;
    function showCat(k, scroll) {
      if (!panels.some(p => p.dataset.cat === k)) k = firstOpen;
      panels.forEach(p => p.hidden = p.dataset.cat !== k);
      tabs.forEach(t => { const on = t.dataset.cat === k; t.classList.toggle('cur', on); t.setAttribute('aria-selected', on);
        if (on) { const bar = t.parentElement; bar.scrollLeft += t.getBoundingClientRect().left - bar.getBoundingClientRect().left - 14; } });
      if (scroll) { const tb = $('.tabs'); const y = tb.getBoundingClientRect().top + scrollY - 70; if (scrollY > y) scrollTo(0, y); }
    }
    tabs.forEach(t => t.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', '#' + t.dataset.cat); showCat(t.dataset.cat, true); }));
    addEventListener('hashchange', () => showCat(location.hash.slice(1)));
    showCat(location.hash.slice(1) || firstOpen);
  }

  // ---------- 词汇表 ----------
  const gq = $('#gq');
  if (gq) {
    $$('.gi').forEach(r => r.classList.toggle('done', done.has(r.dataset.slug)));
    const tabs = $$('.tab'), groups = $$('.gg'), cnt = $('#gcount'), empty = $('.gempty');
    let lv = location.hash.slice(1) || (mqMobile.matches ? 'l1' : 'all');
    if (!tabs.some(t => t.dataset.lv === lv)) lv = 'all';
    function apply() {
      const k = gq.value.trim().toLowerCase(); let n = 0;
      groups.forEach(g => {
        const inLv = k || lv === 'all' || g.dataset.lv === lv; let m = 0;
        $$('.gi', g).forEach(r => { const hit = inLv && (!k || r.dataset.s.includes(k)); r.classList.toggle('hide', !hit); if (hit) m++; });
        g.classList.toggle('hide', !m); n += m;
      });
      tabs.forEach(t => { const on = !k && t.dataset.lv === lv; t.classList.toggle('cur', on); t.setAttribute('aria-selected', on); });
      cnt.textContent = k ? `在全部级别里找到 ${n} 个` : `共 ${n} 个`;
      empty.hidden = n > 0;
    }
    tabs.forEach(t => t.addEventListener('click', e => { e.preventDefault(); lv = t.dataset.lv; gq.value = ''; history.replaceState(null, '', '#' + lv); apply(); }));
    gq.addEventListener('input', apply);
    apply();
  }
})();
