#!/usr/bin/env python3
"""把 data/out/*.json 生成静态网站到 site/。零依赖：python3 src/build.py

信息架构：
  index.html          首页 · Bento 仪表盘（继续学习 / 四个级别 / 搜索 / 今日推荐 / 进度 / 词汇表 / 怎么用）
  l/l1.html … l4.html 级别页 · 分类标签，一次只看一个分类
  c/<slug>.html       概念页 · 桌面：左侧导航 + Bento 卡片；手机：一张一张看
  glossary.html       词汇表 · 搜索 + 级别筛选
"""
import json, glob, os, shutil, html, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pro import pro_page

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site')
E = lambda s: html.escape(str(s), quote=True)

LEVELS = [
    ('初级', 'l1', '🌱', '小白起步', '先认识电脑、网页和 AI 的基本词。看完就能和 AI 正常聊需求。'),
    ('中级', 'l2', '🌊', '能做出东西', '部署、数据库、测试、Agent 工具。看完能让 AI 帮你做出能用的小产品。'),
    ('高级', 'l3', '🔮', '做得稳、做得安全', '安全、缓存、高可用、可观测。看完能看懂 AI 改的代码靠不靠谱。'),
    ('进阶', 'l4', '🔥', '系统指挥官', '分布式、共识、大规模交付、Agent 工程。看完能指挥多个 AI 搭大系统。'),
]
LV = {l[0]: l for l in LEVELS}
CATS = {
    'ai': ('🤖', 'AI 与提示词'), 'base': ('💻', '电脑与网页地基'), 'git': ('🌿', 'Git 协作'),
    'ship': ('🚀', '上线与测试'), 'sec': ('🛡️', '安全防线'), 'db': ('🗄️', '数据库'),
    'net': ('🌐', '网络与 API'), 'cache': ('⚡', '缓存与队列'), 'dist': ('🕸️', '分布式'),
    'sre': ('🩺', '高可用 SRE'), 'devops': ('🔭', '可观测与交付'),
}
CAT_ORDER = list(CATS)

# ---------------- 动画 ----------------
def node(emoji, label, cls=''):
    return f'<div class="nd {cls}"><span class="ne">{E(emoji)}</span><span class="nl">{E(label)}</span></div>'

def pick(a, n):
    L = list(a.get('labels') or [])
    M = list(a.get('emojis') or [])
    while len(L) < n: L.append('')
    while len(M) < n: M.append('🔹')
    return L, M

def anim_html(a):
    t = a.get('type', 'flow')
    if t == 'flow':
        L, M = pick(a, 3)
        tr = '<div class="trk"><i class="dot"></i></div>'
        tr2 = '<div class="trk"><i class="dot d2"></i></div>'
        body = node(M[0], L[0]) + tr + node(M[1], L[1], 'pulse') + tr2 + node(M[2], L[2])
        return f'<div class="sc sc-flow">{body}</div>'
    if t == 'guard':
        L, M = pick(a, 3)
        return ('<div class="sc sc-guard"><div class="lane">'
                f'<div class="run good">{E(M[0])}<b>{E(L[0])}</b></div>'
                f'<div class="run bad">{E(M[2])}<b>{E(L[2])}</b></div>'
                f'<div class="wall">{node(M[1], L[1], "big")}</div>'
                '<div class="ok">✅</div><div class="no">🚫</div></div></div>')
    if t == 'queue':
        L, M = pick(a, 2)
        items = ''.join(f'<span class="qi" style="--i:{i}">{E(M[0])}</span>' for i in range(5))
        return (f'<div class="sc sc-queue"><div class="belt"><div class="items">{items}</div>'
                f'<div class="qlab">{E(L[0])}</div></div>{node(M[1], L[1], "pulse big")}</div>')
    if t == 'layers':
        L, M = pick(a, 3)
        bl = ''.join(f'<div class="ly ly{i}" style="--i:{i}"><span>{E(M[i])}</span>{E(L[i])}</div>' for i in (2, 1, 0))
        return f'<div class="sc sc-layers"><div class="stack">{bl}</div></div>'
    if t in ('split', 'merge', 'copy'):
        n = 3 if t == 'copy' else 4
        L, M = pick(a, n)
        if t == 'merge':
            src = node(M[3], L[3], 'big pulse'); outs = list(zip(M[:3], L[:3]))
        else:
            src = node(M[0], L[0], 'big pulse'); outs = list(zip(M[1:], L[1:]))
        ys = ['18%', '50%', '82%'] if len(outs) == 3 else ['25%', '75%']
        tg = ''.join(f'<div class="tg" style="top:{y}">{node(m, l)}</div>' for (m, l), y in zip(outs, ys))
        dots = ''.join(f'<i class="fly" style="--y:{y};--d:{i*0.45}s"></i>' for i, y in enumerate(ys))
        return f'<div class="sc sc-fan sc-{t}"><div class="src">{src}</div>{dots}{tg}</div>'
    if t == 'loop':
        L = [x for x in (a.get('labels') or []) if x][:4] or ['1', '2', '3']
        M = list(a.get('emojis') or [])
        while len(M) < len(L): M.append('🔹')
        n = len(L)
        pos = {3: [(50, 0), (93, 75), (7, 75)], 4: [(50, 0), (100, 50), (50, 100), (0, 50)]}.get(n, [(50, 0), (93, 75), (7, 75)])
        ns = ''.join(f'<div class="lp" style="left:{x}%;top:{y}%;--d:{i*(4/n):.2f}s;--n:{n}">{node(M[i], L[i])}</div>'
                     for i, (x, y) in enumerate(pos[:n]))
        return f'<div class="sc sc-loop"><div class="lbox"><div class="ring"><i></i></div>{ns}</div></div>'
    if t == 'lock':
        L, M = pick(a, 3)
        return ('<div class="sc sc-lock">'
                f'<div class="fr f1">{node(M[0], L[0])}</div><div class="arw">➜</div>'
                f'<div class="fr f2">{node(M[1], L[1], "big")}</div><div class="arw a2">➜</div>'
                f'<div class="fr f3">{node(M[2], L[2])}</div></div>')
    if t == 'filter':
        L, M = pick(a, 3)
        return ('<div class="sc sc-filter"><div class="lane">'
                f'<div class="run good">{E(M[0])}✔</div><div class="run bad drop">{E(M[0])}✖</div>'
                f'<div class="wall">{node(M[1], L[1], "big")}</div>'
                f'<div class="inl">{E(L[0])}</div><div class="outl">{E(M[2])} {E(L[2])}</div></div></div>')
    if t == 'timer':
        L, M = pick(a, 2)
        return ('<div class="sc sc-timer"><div class="clock"><svg viewBox="0 0 120 120">'
                '<circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg"/></svg>'
                f'<span class="ti">{E(M[0])}</span></div><div class="tl"><b>{E(L[0])}</b>'
                f'<span>{E(M[1])} {E(L[1])}</span><em>⌛ 时间到 → 失效</em></div></div>')
    if t == 'chat':
        L, M = pick(a, 2)
        return ('<div class="sc sc-chat">'
                f'<div class="bub me"><span>{E(M[0] if M[0] != "🔹" else "🙋")}</span><p>{E(L[0])}</p></div>'
                '<div class="bub bot typing"><span>🤖</span><p><i></i><i></i><i></i></p></div>'
                f'<div class="bub bot ans"><span>{E(M[1] if M[1] != "🔹" else "🤖")}</span><p>{E(L[1])}</p></div></div>')
    if t == 'balance':
        L, M = pick(a, 2)
        return ('<div class="sc sc-balance"><div class="beam">'
                f'<div class="pan l">{node(M[0], L[0])}</div><div class="pan r">{node(M[1], L[1])}</div></div>'
                '<div class="pivot">▲</div></div>')
    if t == 'toggle':
        L, M = pick(a, 2)
        return ('<div class="sc sc-toggle">'
                f'<div class="st sa">{node(M[0], L[0], "big")}</div>'
                '<div class="sw"><i></i></div>'
                f'<div class="st sb">{node(M[1], L[1], "big")}</div></div>')
    if t == 'grow':
        L, M = pick(a, 3)
        bars = ''.join(f'<div class="bar" style="--h:{h}%;--d:{i*0.3}s"><div class="fill"><span>{E(M[i])}</span></div><b>{E(L[i])}</b></div>'
                       for i, h in enumerate((40, 70, 95)))
        return f'<div class="sc sc-grow">{bars}</div>'
    a2 = dict(a); a2['type'] = 'flow'
    return anim_html(a2)


# ---------------- 页面骨架 ----------------
def page(title, body, depth, bodycls='', desc='AI 造物指南：AI 开发概念，一个概念一页。'):
    p = '../' * depth
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F5F5F7">
<meta name="description" content="{E(desc)}">
<title>{E(title)}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧭</text></svg>">
<link rel="stylesheet" href="{p}assets/style.css">
</head><body class="{bodycls}" data-root="{p}">
<a class="skip" href="#main">跳到正文</a>
<div id="readbar"></div>
<header class="top"><div class="top-in">
<a class="brand" href="{p}index.html"><img src="{p}assets/mascot-sm.webp" alt="" width="32" height="32"><b>AI 造物指南</b></a>
<nav class="tools" aria-label="工具">
<button data-act="search" title="搜索（按 / 键）" aria-label="搜索">🔎<span>搜索</span></button>
<a href="{p}glossary.html" title="词汇表" aria-label="词汇表">📚<span>词汇表</span></a>
<button data-act="rand" title="随便学一个没学过的" aria-label="随机一个">🎲<span>随机</span></button>
<button data-act="settings" title="阅读设置" aria-label="阅读设置" aria-haspopup="dialog">⚙️<span>阅读设置</span></button>
</nav></div></header>
{body}
<footer class="foot">🧭 AI 造物指南 · by Q1f730</footer>
<div id="scrim" hidden></div>
<div id="setp" class="sheet" hidden role="dialog" aria-modal="true" aria-label="阅读设置">
  <div class="grab"></div>
  <div class="sh-h"><b>⚙️ 阅读设置</b><button class="x" data-act="close" aria-label="关闭">✕</button></div>
  <div class="srow"><span>🔠 字号</span><div class="fsz"><button data-act="font-" aria-label="字变小">A-</button><em id="fsv">18</em><button data-act="font+" aria-label="字变大">A+</button></div></div>
  <button class="srow tg" data-act="calm"><span>🫧 宽松阅读<small>字距、行距更大</small></span><i class="sw2"></i></button>
  <button class="srow tg" data-act="focus"><span>🔦 专注模式<small>只亮当前这一块</small></span><i class="sw2"></i></button>
  <button class="srow tg" data-act="motion"><span>⏸️ 暂停动画<small>动画定格，不再晃</small></span><i class="sw2"></i></button>
</div>
<div id="sov" class="sov" hidden role="dialog" aria-modal="true" aria-label="搜索">
  <div class="sov-in">
    <div class="sbox"><span>🔎</span><input id="sq" type="search" placeholder="搜中文或英文，比如 token、数据库" autocomplete="off" aria-label="搜索概念" aria-controls="sres"><button class="x" data-act="close">取消</button></div>
    <ul id="sres" class="sres" role="listbox"></ul>
    <p class="shint">↑ ↓ 选择 · 回车打开 · Esc 关闭</p>
  </div>
</div>
<script src="{p}assets/index.js"></script>
<script src="{p}assets/app.js"></script>
</body></html>'''


def ring(cls):
    return (f'<svg class="pring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="rb"/>'
            f'<circle cx="24" cy="24" r="20" class="rf" data-ring="{cls}"/></svg>')


# ---------------- 首页 ----------------
def index_page(cs):
    total = len(cs)
    first = cs[0]
    lvt = ''
    for name, cls, emo, tag, desc in LEVELS:
        n = sum(1 for c in cs if c['level'] == name)
        lvt += (f'<a class="t lvt {cls}" href="l/{cls}.html" style="grid-area:{cls}">'
                f'<div class="lvt-top"><span class="le">{emo}</span><div class="rw">{ring(name)}<em data-lvt="{name}">0/{n}</em></div></div>'
                f'<b>{name}</b><i>{tag}</i><small>{n} 个概念 →</small></a>')
    by = {c['slug']: c for c in cs}
    quick = ''.join(f'<a class="qk" href="c/{k}.html">{E(by[k]["emoji"])} {E(by[k]["zh"])}</a>'
                    for k in ('token', 'prompt', 'api', 'database', 'git', 'deployment') if k in by)
    body = f'''
<main class="home bento" id="main">
<section class="t hero" style="grid-area:hero">
  <div class="hero-txt">
    <span class="pill">🧭 {total} 个概念 · 一页一个</span>
    <h1><span class="nw">不会代码，</span><br><span class="nw">也能指挥 AI </span><span class="nw">造东西</span></h1>
    <p class="lead">每页 2 分钟：一句话、比喻、动画、小测验。</p>
    <div class="hero-act">
      <a class="btn pri" id="resume" href="c/{first['slug']}.html">▶ 从第 1 个开始</a>
      <a class="btn soft" href="l/l1.html">🌱 看初级目录</a>
    </div>
    <p class="resume-sub" id="resume-sub">第 1 个：{E(first['emoji'])} {E(first['zh'])}</p>
  </div>
  <img class="mascot" src="assets/mascot.webp" alt="小罗盘：本站的吉祥物" width="640" height="640">
</section>
<section class="t today t-lemon" id="today" style="grid-area:today">
  <span class="tag">☀️ 今日推荐</span>
  <div class="today-body"><p class="muted">正在挑一个你还没学的…</p></div>
</section>
<section class="t prog" style="grid-area:prog">
  <span class="tag">🏆 总进度</span>
  <p class="bignum"><b data-num="*">0</b><span> / {total}</span></p>
  <div class="bar"><i data-bar="*"></i></div>
  <p class="muted sm" id="prog-note">点概念页里的「🙋 我学会了」就会记在这里（只存在你的浏览器）。</p>
</section>
{lvt}
<section class="t srch" style="grid-area:srch">
  <span class="tag">🔎 找一个词</span>
  <div class="sbox"><span>🔎</span><input id="hq" type="search" placeholder="中文英文都行：token、部署、缓存…" autocomplete="off" aria-label="搜索概念" aria-controls="hres"></div>
  <ul id="hres" class="sres drop" role="listbox"></ul>
  <div class="quick"><span class="muted sm">常见的词：</span>{quick}</div>
</section>
<a class="t gloss t-sky" href="glossary.html" style="grid-area:gloss">
  <span class="tag">📚 词汇表</span>
  <b class="gl-n">{total} 个词</b>
  <p>中英对照，按级别筛选</p><span class="go">打开 →</span>
</a>
<section class="t tips" style="grid-area:tips">
  <span class="tag">💡 怎么用</span>
  <ul class="tiplist">
    <li><span>🐢</span><p><b>一次只看一页</b>看完点「我学会了」</p></li>
    <li><span>🔊</span><p><b>不想读字？</b>点「读给我听」</p></li>
    <li><span>⚙️</span><p><b>字太挤？</b>右上角开「宽松阅读」</p></li>
    <li><span>📋</span><p><b>不会写？</b>复制每页给 AI 的话</p></li>
  </ul>
</section>
</main>'''
    return page('AI 造物指南', body, 0, bodycls='is-home')


# ---------------- 级别页 ----------------
def level_page(lvl, cs):
    name, cls, emo, tag, desc = lvl
    items = [c for c in cs if c['level'] == name]
    cats = [k for k in CAT_ORDER if any(c['cat'] == k for c in items)]
    tabs, panels = '', ''
    for k in cats:
        ce, cn = CATS[k]
        g = [c for c in items if c['cat'] == k]
        tabs += (f'<a class="tab" href="#{k}" data-cat="{k}" role="tab"><span>{ce}</span>{E(cn)}'
                 f'<em data-catn="{k}">{len(g)}</em></a>')
        cards = ''.join(
            f'<a class="cc" href="../c/{c["slug"]}.html" data-slug="{c["slug"]}">'
            f'<span class="ce">{E(c["emoji"])}</span><span class="cx"><b>{E(c["zh"])}</b>'
            f'<small>{E(c["en"])}</small><span class="ol">{E(c["oneLiner"])}</span></span>'
            f'<i class="tick" aria-label="已学会">✅</i></a>' for c in g)
        panels += (f'<section class="catp" id="p-{k}" data-cat="{k}" role="tabpanel">'
                   f'<div class="catp-h"><h2>{ce} {E(cn)}</h2><span class="muted" data-catdone="{k}">{len(g)} 个</span></div>'
                   f'<div class="catdone-msg" hidden><img src="../assets/mascot-sm.webp" alt="" width="56" height="56">'
                   f'<p><b>这一类全学会了！</b>换个分类，或者去下一级看看。</p></div>'
                   f'<div class="cards">{cards}</div></section>')
    others = ''.join(f'<a class="ol-l {l[1]}" href="{l[1]}.html"><span>{l[2]}</span>{l[0]} · {l[3]}</a>'
                     for l in LEVELS if l[1] != cls)
    body = f'''
<main class="lvp {cls}" id="main" data-level="{name}">
<nav class="crumb" aria-label="位置"><a href="../index.html">首页</a><span>›</span><b>{emo} {name}</b></nav>
<section class="t lvhead">
  <span class="lvemo">{emo}</span>
  <div class="lvh-txt">
    <span class="tag">{name} · {len(items)} 个概念</span>
    <h1>{tag}</h1>
    <p>{E(desc)}</p>
  </div>
  <div class="lvh-side">
    <div class="lvprog"><div class="bar"><i data-bar="{name}"></i></div><em data-lvt="{name}">0 / {len(items)}</em></div>
    <a class="btn pri" id="nextun" href="../c/{items[0]['slug']}.html">学下一个没学的 →</a>
    <p class="muted sm" id="nextun-sub"></p>
  </div>
</section>
<div class="tabs" role="tablist" aria-label="分类">{tabs}</div>
{panels}
<nav class="otherlv" aria-label="其他级别">{others}</nav>
</main>'''
    return page(f'{emo} {name} · {tag} · AI 造物指南', body, 1, bodycls='is-level')


# ---------------- 概念页 ----------------
SECS = [('s-one', '🎯', '一句话'), ('s-ana', '🧸', '打个比方'), ('s-anim', '🎬', '动起来看'),
        ('s-tab', '📊', '对比表'), ('s-how', '👣', '怎么做'), ('s-oops', '💥', '翻车现场'),
        ('s-ai', '🤖', '给 AI 的话'), ('s-quiz', '✅', '小测一下'), ('s-words', '📚', '词汇')]


def concept_page(c, prev, nxt, total, by_slug, has_pro=False):
    lv = LV[c['level']]
    pro_sw = (f'<a class="prosw" href="{E(c["slug"])}.pro.html" data-mode="pro" title="更详细、更专业的版本">🎓 专业模式</a>' if has_pro else '')
    ce, cn = CATS.get(c['cat'], ('📦', c['cat']))
    q = c['quiz']
    opts = ''.join(f'<button class="opt" data-i="{i}"><span class="ok">{"ABC"[i]}</span><span>{E(o)}</span></button>'
                   for i, o in enumerate(q['options']))
    tb = c['table']
    thead = ''.join(f'<th>{E(h)}</th>' for h in tb['head'])
    trows = ''.join('<tr>' + ''.join(f'<td data-h="{E(tb["head"][j]) if j < len(tb["head"]) else ""}">{E(x)}</td>'
                                     for j, x in enumerate(r)) + '</tr>' for r in tb['rows'])
    points = ''.join(f'<li>{E(p)}</li>' for p in c['points'])
    steps = ''.join(f'<li><span class="sn">{i+1}</span><p>{E(s)}</p></li>' for i, s in enumerate(c['steps']))
    words = ''.join(f'<span class="chip">{E(w)}</span>' for w in c.get('words', []))
    rel = ''.join(f'<a class="rel" href="{E(r)}.html"><span>{E(by_slug[r]["emoji"])}</span>{E(by_slug[r]["zh"])}</a>'
                  for r in c.get('related', []) if r in by_slug)
    oops = re.sub(r'^\s*💥\s*(翻车现场[:：]\s*)?', '', c['oops'])
    a = c['anim']

    def head(i, extra=''):
        sid, emo, lab = SECS[i]
        return f'<header class="th"><span class="tag">{emo} {i+1:02d} · {lab}</span>{extra}</header>'

    def say(ids):
        return f'<button class="say sm" data-say="{ids}" aria-label="读这一块">🔊</button>'

    rail = ''.join(f'<li><a href="#{sid}" data-sec="{sid}"><span class="re">{emo}</span><span class="rl">{lab}</span>'
                   f'<i class="rc">✓</i></a></li>' for sid, emo, lab in SECS)
    strip = ''.join(f'<a class="sc-chip" href="#{sid}" data-sec="{sid}"><span>{emo}</span>{lab}</a>' for sid, emo, lab in SECS)

    def pn(x, cls, label):
        if not x: return f'<span class="pn {cls} none"></span>'
        arrow_l = '‹ ' if cls == 'prev' else ''
        arrow_r = ' ›' if cls == 'next' else ''
        return (f'<a class="pn {cls}" href="{x["slug"]}.html" rel="{cls}"><small>{arrow_l}{label}{arrow_r}</small>'
                f'<b>{E(x["emoji"])} {E(x["zh"])}</b></a>')

    crumb = (f'<nav class="crumb" aria-label="位置"><a href="../index.html">首页</a><span>›</span>'
             f'<a href="../l/{lv[1]}.html#{E(c["cat"])}">{lv[2]} {E(c["level"])} · {ce} {E(cn)}</a><span>›</span>'
             f'<b>{E(c["zh"])}</b></nav>')

    body = f'''
<main class="cp {lv[1]}" id="main" data-slug="{E(c['slug'])}" data-pro="{'1' if has_pro else ''}" data-answer="{int(q['answer'])}"
  data-prev="{prev['slug'] + '.html' if prev else ''}" data-next="{nxt['slug'] + '.html' if nxt else ''}"
  data-next-name="{E(nxt['emoji'] + ' ' + nxt['zh']) if nxt else ''}">
{crumb}
<div class="cp-grid">
<aside class="rail" aria-label="本页目录">
  <div class="rail-in">
    <div class="rail-meta"><span class="lvb">{lv[2]} {E(c['level'])}</span><span class="muted">No.{c['no']} / {total}</span></div>
    <ol class="rail-list">{rail}</ol>
    <div class="rail-pn">{pn(prev, 'prev', '上一个')}{pn(nxt, 'next', '下一个')}</div>
  </div>
</aside>
<div class="cp-main">
<section class="t chero" id="s-hero">
  <div class="hemo" aria-hidden="true">{E(c['emoji'])}</div>
  <div class="chero-txt">
    <div class="meta"><span class="lvb">{lv[2]} {E(c['level'])}</span><span>{ce} {E(cn)}</span><span>No.{c['no']} / {total}</span><span>⏱ 约 2 分钟</span></div>
    <h1>{E(c['zh'])}</h1><p class="en">{E(c['en'])}</p>
    <div class="hbtns"><button class="say big" data-say="s-hero s-one s-ana">🔊 读给我听</button>{pro_sw}</div>
  </div>
  <img class="mascot-s" src="../assets/mascot-sm.webp" alt="" width="256" height="256">
</section>
<div class="strip-wrap">
  <div class="strip" role="tablist" aria-label="本页卡片">{strip}</div>
  <button class="modebtn" data-act="mode" aria-pressed="false">☰ 全部展开</button>
</div>
<div class="bento cbento">
<section class="t sec s-one t-lemon" id="s-one">{head(0, say('s-one'))}<p class="big">{E(c['oneLiner'])}</p></section>
<section class="t sec s-ana" id="s-ana">{head(1, say('s-ana'))}<p class="ana">{E(c['analogy'])}</p><ul class="pts">{points}</ul></section>
<section class="t sec s-anim t-sky" id="s-anim">{head(2)}{anim_html(a)}<p class="cap">👀 {E(a.get('caption', ''))}</p></section>
<section class="t sec s-tab" id="s-tab">{head(3)}<h3 class="tt">{E(tb['title'])}</h3><div class="tw"><table><thead><tr>{thead}</tr></thead><tbody>{trows}</tbody></table></div></section>
<section class="t sec s-how t-pist" id="s-how">{head(4, say('s-how'))}<ol class="how">{steps}</ol></section>
<section class="t sec s-oops t-blush" id="s-oops">{head(5, say('s-oops'))}<p class="story">{E(oops)}</p></section>
<section class="t sec s-ai t-lilac" id="s-ai">{head(6)}<pre class="prompt">{E(c['prompt'])}</pre><button class="btn pri copy">📋 一键复制</button></section>
<section class="t sec s-quiz" id="s-quiz">{head(7)}<p class="q">{E(q['q'])}</p><div class="opts">{opts}</div>
<p class="why" hidden>💡 {E(q['why'])}</p></section>
<section class="t sec s-words" id="s-words">{head(8)}<div class="chips">{words}</div>
{('<h3 class="relh">🔗 相关概念</h3><div class="rels">' + rel + '</div>') if rel else ''}</section>
<section class="t fin">
  <img src="../assets/mascot.webp" alt="" width="640" height="640" class="fin-m">
  <div class="fin-txt"><h2 class="fin-h">看完了？给自己打个卡</h2><p class="muted">进度只存在你的浏览器里。</p>
  <button class="btn pri done">🙋 我学会了！</button></div>
  <nav class="pnav">{pn(prev, 'prev', '上一个')}{pn(nxt, 'next', '下一个')}</nav>
</section>
</div>
<div class="cardhint" aria-live="polite"><span class="ch-t"></span><span class="dots" aria-hidden="true"></span></div>
</div>
</div>
<nav class="bbar" aria-label="翻卡">
  <button class="bb prevc" data-act="prevc">‹ 上一张</button>
  <button class="bb done" data-compact="1">🙋 我学会了</button>
  <button class="bb nextc" data-act="nextc">下一张 ›</button>
</nav>
</main>'''
    return page(f"{c['emoji']} {c['zh']} · AI 造物指南", body, 1, bodycls='is-concept',
                desc=f"{c['zh']}：{c['oneLiner']}")


# ---------------- 词汇表 ----------------
def glossary_page(cs):
    groups = ''
    for name, cls, emo, tag, desc in LEVELS:
        items = sorted([c for c in cs if c['level'] == name], key=lambda c: c['en'].lower())
        rows = ''.join(
            f'<a class="gi" href="c/{c["slug"]}.html" data-slug="{c["slug"]}" data-s="{E((c["zh"] + " " + c["en"] + " " + c["slug"]).lower())}">'
            f'<span class="ge">{E(c["emoji"])}</span><b class="gz">{E(c["zh"])}</b><span class="gen">{E(c["en"])}</span>'
            f'<span class="go1">{E(c["oneLiner"])}</span><span class="glv"><span class="lvb">{emo} {name}</span></span></a>'
            for c in items)
        groups += (f'<section class="gg {cls}" data-lv="{cls}"><h2>{emo} {name} · {tag} <small>{len(items)}</small></h2>'
                   f'<div class="gh" aria-hidden="true"><span></span><span>中文</span><span>English</span><span>一句话</span><span>级别</span></div>'
                   f'<div class="glist">{rows}</div></section>')
    tabs = '<a class="tab" href="#all" data-lv="all">全部<em>' + str(len(cs)) + '</em></a>' + ''.join(
        f'<a class="tab {l[1]}" href="#{l[1]}" data-lv="{l[1]}"><span>{l[2]}</span>{l[0]}<em>{sum(1 for c in cs if c["level"] == l[0])}</em></a>'
        for l in LEVELS)
    body = f'''<main class="gl" id="main">
<nav class="crumb" aria-label="位置"><a href="index.html">首页</a><span>›</span><b>📚 词汇表</b></nav>
<section class="t glhead t-sky">
  <div><span class="tag">📚 词汇表</span><h1>{len(cs)} 个词，中英对照</h1><p class="muted">按英文字母排。点一个词就进它的那一页。</p></div>
  <div class="sbox"><span>🔎</span><input id="gq" type="search" placeholder="中文或英文都能搜" autocomplete="off" aria-label="搜索词汇"></div>
</section>
<div class="tabs" role="tablist" aria-label="级别">{tabs}</div>
<p class="gcount muted" id="gcount"></p>
{groups}
<div class="gempty t" hidden><img src="assets/mascot-sm.webp" alt="" width="64" height="64"><p><b>没找到这个词。</b>换个说法，或者试试英文。</p></div>
</main>'''
    return page('📚 词汇表 · AI 造物指南', body, 0, bodycls='is-gloss')


def main():
    cs = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'out', '*.json'))):
        cs += json.load(open(f, encoding='utf-8'))
    nc = os.path.join(ROOT, 'data', 'new_cats.json')
    if os.path.exists(nc):
        for k, v in json.load(open(nc, encoding='utf-8')).items():
            if k not in CATS:
                CATS[k] = (v['emoji'], v['name']); CAT_ORDER.append(k)
    rank = {l[0]: i for i, l in enumerate(LEVELS)}
    cs.sort(key=lambda c: (rank.get(c['level'], 9), c['no']))
    for i, c in enumerate(cs): c['no'] = i + 1   # 显示序号按级别连续编号
    by_slug = {c['slug']: c for c in cs}
    pro = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'pro', '*.json'))):
        try:
            for x in json.load(open(f, encoding='utf-8')):
                if x.get('slug') in by_slug and x.get('def'): pro[x['slug']] = x
        except Exception as e:
            print('skip pro file', f, e)
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'c'))
    os.makedirs(os.path.join(OUT, 'l'))
    shutil.copytree(os.path.join(ROOT, 'src', 'assets'), os.path.join(OUT, 'assets'))
    idx = [{'s': c['slug'], 'z': c['zh'], 'n': c['en'], 'e': c['emoji'], 'l': c['level'], 'c': c['cat'],
            'o': c['oneLiner']} for c in cs]
    meta = {'levels': [{'name': l[0], 'cls': l[1], 'emo': l[2]} for l in LEVELS],
            'cats': {k: list(v) for k, v in CATS.items()}}
    open(os.path.join(OUT, 'assets', 'index.js'), 'w', encoding='utf-8').write(
        'window.GUIDE=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';\n'
        'window.GUIDE_META=' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';')
    for i, c in enumerate(cs):
        prev = cs[i-1] if i > 0 else None
        nxt = cs[i+1] if i + 1 < len(cs) else None
        open(os.path.join(OUT, 'c', c['slug'] + '.html'), 'w', encoding='utf-8').write(
            concept_page(c, prev, nxt, len(cs), by_slug, c['slug'] in pro))
        if c['slug'] in pro:
            open(os.path.join(OUT, 'c', c['slug'] + '.pro.html'), 'w', encoding='utf-8').write(
                pro_page(c, pro[c['slug']], prev if prev and prev['slug'] in pro else None,
                         nxt if nxt and nxt['slug'] in pro else None, len(cs), LV, CATS, page))
    for l in LEVELS:
        open(os.path.join(OUT, 'l', l[1] + '.html'), 'w', encoding='utf-8').write(level_page(l, cs))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(index_page(cs))
    open(os.path.join(OUT, 'glossary.html'), 'w', encoding='utf-8').write(glossary_page(cs))
    open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    print('built', len(cs), 'concepts,', len(pro), 'pro pages ->', OUT)


if __name__ == '__main__':
    main()
