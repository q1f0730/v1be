#!/usr/bin/env python3
"""把 data/out/*.json 生成静态网站到 site/。零依赖：python3 src/build.py"""
import json, glob, os, shutil, html, re

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
def page(title, body, depth, extra_head='', bodycls=''):
    p = '../' * depth
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧭</text></svg>">
<link rel="stylesheet" href="{p}assets/style.css">{extra_head}
</head><body class="{bodycls}" data-root="{p}">
<div id="readbar"></div>
<header class="top"><a class="brand" href="{p}index.html">🧭 <b>AI 造物指南</b></a>
<nav class="tools">
<a href="{p}glossary.html" title="词汇表">📚<span>词汇表</span></a>
<button data-act="rand" title="随便学一个">🎲<span>随机</span></button>
<button data-act="font-" title="字变小">A-</button><button data-act="font+" title="字变大">A+</button>
<button data-act="calm" title="宽松阅读：字距行距更大">🫧<span>宽松</span></button>
<button data-act="focus" title="专注模式：只亮当前这块">🔦<span>专注</span></button>
<button data-act="motion" title="暂停/播放动画">⏯️<span>动画</span></button>
</nav></header>
{body}
<footer class="foot">🧭 AI 造物指南 · 给不会代码的人 · by Q1f730 · 内容可能有疏漏，欢迎在 GitHub 提 Issue</footer>
<script src="{p}assets/index.js"></script>
<script src="{p}assets/app.js"></script>
</body></html>'''

def concept_page(c, prev, nxt, total, by_slug):
    lv = LV[c['level']]
    ce, cn = CATS.get(c['cat'], ('📦', c['cat']))
    q = c['quiz']
    opts = ''.join(f'<button class="opt" data-i="{i}">{"ABC"[i]}. {E(o)}</button>' for i, o in enumerate(q['options']))
    tb = c['table']
    thead = ''.join(f'<th>{E(h)}</th>' for h in tb['head'])
    trows = ''.join('<tr>' + ''.join(f'<td>{E(x)}</td>' for x in r) + '</tr>' for r in tb['rows'])
    points = ''.join(f'<li>{E(p)}</li>' for p in c['points'])
    steps = ''.join(f'<li><span class="sn">{i+1}</span><p>{E(s)}</p></li>' for i, s in enumerate(c['steps']))
    words = ''.join(f'<span class="chip">{E(w)}</span>' for w in c.get('words', []))
    rel = ''.join(f'<a class="rel" href="{E(r)}.html">{E(by_slug[r]["emoji"])} {E(by_slug[r]["zh"])}</a>'
                  for r in c.get('related', []) if r in by_slug)
    nav = ''
    if prev: nav += f'<a class="pn prev" href="{prev["slug"]}.html">⬅️ <span>上一个</span><b>{E(prev["emoji"])} {E(prev["zh"])}</b></a>'
    else: nav += '<span></span>'
    if nxt: nav += f'<a class="pn next" href="{nxt["slug"]}.html"><span>下一个</span><b>{E(nxt["emoji"])} {E(nxt["zh"])}</b> ➡️</a>'
    oops = re.sub(r'^\s*💥\s*(翻车现场[:：]\s*)?', '', c['oops'])
    a = c['anim']
    body = f'''
<main class="cp {lv[1]}" data-slug="{E(c['slug'])}" data-answer="{int(q['answer'])}">
<nav class="crumb"><a href="../index.html">🏠 首页</a> › <a href="../index.html#{lv[1]}">{lv[2]} {E(c['level'])}</a> › {ce} {E(cn)}</nav>
<section class="hero blk" id="s-hero">
  <div class="hemo">{E(c['emoji'])}</div>
  <div><div class="meta"><span class="lvb">{lv[2]} {E(c['level'])}</span><span>No.{c['no']} / {total}</span><span>⏱ 约 2 分钟</span></div>
  <h1>{E(c['zh'])}</h1><p class="en">{E(c['en'])}</p></div>
  <button class="say" data-say="s-hero s-one s-ana" title="读给我听">🔊 读给我听</button>
</section>
<ol class="steps-nav" aria-label="本页进度">
<li><a href="#s-one">🎯</a></li><li><a href="#s-ana">🧸</a></li><li><a href="#s-anim">🎬</a></li><li><a href="#s-tab">📊</a></li><li><a href="#s-how">👣</a></li><li><a href="#s-oops">💥</a></li><li><a href="#s-ai">🤖</a></li><li><a href="#s-quiz">✅</a></li></ol>
<section class="blk one" id="s-one"><h2>🎯 一句话</h2><p class="big">{E(c['oneLiner'])}</p></section>
<section class="blk" id="s-ana"><h2>🧸 打个比方</h2><p>{E(c['analogy'])}</p><ul class="pts">{points}</ul>
<button class="say sm" data-say="s-ana">🔊</button></section>
<section class="blk" id="s-anim"><h2>🎬 动起来看</h2>{anim_html(a)}<p class="cap">👀 {E(a.get('caption', ''))}</p></section>
<section class="blk" id="s-tab"><h2>📊 {E(tb['title'])}</h2><div class="tw"><table><thead><tr>{thead}</tr></thead><tbody>{trows}</tbody></table></div></section>
<section class="blk" id="s-how"><h2>👣 你该怎么做</h2><ol class="how">{steps}</ol><button class="say sm" data-say="s-how">🔊</button></section>
<section class="blk oops" id="s-oops"><h2>💥 翻车现场</h2><p>{E(oops)}</p></section>
<section class="blk ai" id="s-ai"><h2>🤖 复制给 AI 的话</h2><pre class="prompt">{E(c['prompt'])}</pre><button class="copy">📋 一键复制</button></section>
<section class="blk quiz" id="s-quiz"><h2>✅ 小测一下</h2><p class="q">{E(q['q'])}</p><div class="opts">{opts}</div>
<p class="why" hidden>💡 {E(q['why'])}</p></section>
<section class="blk words"><h2>📚 顺便认识这些词</h2><div class="chips">{words}</div>
{('<h3>🔗 相关概念</h3><div class="rels">' + rel + '</div>') if rel else ''}</section>
<div class="done-row"><button class="done">🙋 我学会了！</button></div>
<nav class="pnav">{nav}</nav>
</main>'''
    return page(f"{c['emoji']} {c['zh']} · AI 造物指南", body, 1)

def index_page(cs):
    total = len(cs)
    lvl_cards = ''
    sections = ''
    for name, cls, emo, tag, desc in LEVELS:
        items = [c for c in cs if c['level'] == name]
        lvl_cards += (f'<a class="lvc {cls}" href="#{cls}"><span class="le">{emo}</span><b>{name}</b><i>{tag}</i>'
                      f'<small>{len(items)} 个概念</small><div class="pg"><div class="pgf" data-lv="{name}"></div></div>'
                      f'<em class="pgt" data-lvt="{name}">0 / {len(items)}</em></a>')
        groups = ''
        for cat in CAT_ORDER:
            g = [c for c in items if c['cat'] == cat]
            if not g: continue
            ce, cn = CATS[cat]
            tiles = ''.join(
                f'<a class="tile" href="c/{c["slug"]}.html" data-slug="{c["slug"]}">'
                f'<span class="te">{E(c["emoji"])}</span><b>{E(c["zh"])}</b><small>{E(c["en"])}</small><p>{E(c["oneLiner"])}</p><i class="tick">✅</i></a>'
                for c in g)
            groups += f'<div class="grp"><h3>{ce} {cn} <small>{len(g)}</small></h3><div class="tiles">{tiles}</div></div>'
        op = ' open' if cls == 'l1' else ''
        sections += (f'<details class="lvsec {cls}" id="{cls}"{op}><summary><h2>{emo} {name} · {tag} <small>{len(items)} 个</small></h2>'
                     f'<p class="lvd">{desc}</p><span class="tap">点开 / 收起 👇</span></summary>{groups}</details>')
    body = f'''
<main class="home">
<section class="intro">
  <div class="float">🤖</div><div class="float f2">✨</div><div class="float f3">🧩</div>
  <h1>不会代码，也能指挥 AI 造东西 🧭</h1>
  <p class="sub">{total} 个概念，一个概念一页。每页 2 分钟：一句话 → 比喻 → 动画 → 表格 → 小测验。</p>
  <div class="howto">
    <div>🐢 <b>一次只看一页</b><span>看完点「我学会了」</span></div>
    <div>🔊 <b>不想读字？</b><span>点「读给我听」</span></div>
    <div>🫧 <b>字太挤？</b><span>右上角开「宽松」</span></div>
    <div>📋 <b>不会写？</b><span>复制每页的 AI 指令</span></div>
  </div>
  <div class="search"><span>🔎</span><input id="q" placeholder="搜一个词，比如 token、数据库、部署…" autocomplete="off"><em id="qn"></em></div>
</section>
<section class="lvcards">{lvl_cards}</section>
<div class="allprog">🏆 总进度 <div class="pg big"><div class="pgf" data-lv="*"></div></div><em class="pgt" data-lvt="*">0 / {total}</em></div>
{sections}
</main>'''
    return page('AI 造物指南 · 给不会代码的人', body, 0, bodycls='is-home')

def glossary_page(cs):
    rows = ''
    for c in sorted(cs, key=lambda c: c['en'].lower()):
        lv = LV[c['level']]
        rows += (f'<tr data-s="{E((c["zh"]+" "+c["en"]).lower())}"><td>{E(c["emoji"])}</td><td><a href="c/{c["slug"]}.html"><b>{E(c["zh"])}</b></a></td>'
                 f'<td class="enc">{E(c["en"])}</td><td>{E(c["oneLiner"])}</td><td><span class="lvb {lv[1]}">{lv[2]} {c["level"]}</span></td></tr>')
    body = f'''<main class="gl"><h1>📚 词汇表 <small>{len(cs)} 个</small></h1>
<div class="search"><span>🔎</span><input id="gq" placeholder="中文或英文都能搜" autocomplete="off"></div>
<div class="tw"><table class="glt"><thead><tr><th></th><th>中文</th><th>English</th><th>一句话</th><th>级别</th></tr></thead><tbody>{rows}</tbody></table></div></main>'''
    return page('📚 词汇表 · AI 造物指南', body, 0)

def main():
    cs = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'out', '*.json'))):
        cs += json.load(open(f, encoding='utf-8'))
    cs.sort(key=lambda c: c['no'])
    by_slug = {c['slug']: c for c in cs}
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'c'))
    shutil.copytree(os.path.join(ROOT, 'src', 'assets'), os.path.join(OUT, 'assets'))
    idx = [{'s': c['slug'], 'z': c['zh'], 'e': c['emoji'], 'l': c['level']} for c in cs]
    open(os.path.join(OUT, 'assets', 'index.js'), 'w', encoding='utf-8').write(
        'window.GUIDE=' + json.dumps(idx, ensure_ascii=False) + ';')
    for i, c in enumerate(cs):
        prev = cs[i-1] if i > 0 else None
        nxt = cs[i+1] if i + 1 < len(cs) else None
        open(os.path.join(OUT, 'c', c['slug'] + '.html'), 'w', encoding='utf-8').write(
            concept_page(c, prev, nxt, len(cs), by_slug))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(index_page(cs))
    open(os.path.join(OUT, 'glossary.html'), 'w', encoding='utf-8').write(glossary_page(cs))
    open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    print('built', len(cs), 'concepts ->', OUT)

if __name__ == '__main__':
    main()
