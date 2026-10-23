"""专业模式页面模板（被 build.py 引用）"""
import re, html
E = lambda s: html.escape(str(s), quote=True)

SECS_PRO = [('p-def', '📐', '定义'), ('p-how', '⚙️', '原理'), ('p-terms', '🔤', '术语'), ('p-code', '💻', '代码'),
            ('p-tab', '📊', '参数对比'), ('p-trade', '⚖️', '方案取舍'), ('p-pit', '🕳️', '常见坑'),
            ('p-check', '☑️', '检查清单'), ('p-int', '🎤', '面试追问'), ('p-refs', '🔗', '延伸阅读')]


def pro_page(c, p, prev, nxt, total, LV, CATS, page):
    lv = LV[c['level']]
    ce, cn = CATS.get(c['cat'], ('📦', c['cat']))

    def head(i):
        sid, emo, lab = SECS_PRO[i]
        return f'<header class="th"><span class="tag">{emo} {i+1:02d} · {lab}</span></header>'
    rail = ''.join(f'<li><a href="#{sid}" data-sec="{sid}"><span class="re">{emo}</span><span class="rl">{lab}</span>'
                   f'<i class="rc">✓</i></a></li>' for sid, emo, lab in SECS_PRO)
    strip = ''.join(f'<a class="sc-chip" href="#{sid}" data-sec="{sid}"><span>{emo}</span>{lab}</a>' for sid, emo, lab in SECS_PRO)

    def pn(x, cls, label):
        if not x:
            return f'<span class="pn {cls} none"></span>'
        al = '‹ ' if cls == 'prev' else ''
        ar = ' ›' if cls == 'next' else ''
        return (f'<a class="pn {cls}" href="{x["slug"]}.pro.html" rel="{cls}"><small>{al}{label}{ar}</small>'
                f'<b>{E(x["emoji"])} {E(x["zh"])}</b></a>')

    how = ''.join(f'<li><span class="sn">{i+1}</span><p>{E(h)}</p></li>' for i, h in enumerate(p.get('how', [])))
    terms = ''.join(f'<div class="term"><dt>{E(t.get("t", ""))}</dt><dd>{E(t.get("d", ""))}</dd></div>' for t in p.get('terms', []))
    cd = p.get('code') or {}
    tb = p.get('table') or {}
    th = tb.get('head', [])
    thead = ''.join(f'<th>{E(h)}</th>' for h in th)
    trows = ''.join('<tr>' + ''.join(f'<td data-h="{E(th[j]) if j < len(th) else ""}">{E(x)}</td>' for j, x in enumerate(r)) + '</tr>'
                    for r in tb.get('rows', []))
    trade = ''.join(f'<div class="trd"><h4>{E(t.get("opt", ""))}</h4><p><b class="k-p">优点</b>{E(t.get("pros", ""))}</p>'
                    f'<p><b class="k-c">代价</b>{E(t.get("cons", ""))}</p><p><b class="k-w">适用</b>{E(t.get("when", ""))}</p></div>'
                    for t in p.get('tradeoffs', []))
    pits = ''.join(f'<li><p class="bad"><b>✗</b>{E(x.get("bad", ""))}</p><p class="fix"><b>✓</b>{E(x.get("fix", ""))}</p></li>'
                   for x in p.get('pitfalls', []))
    chk = ''.join(f'<li><label><input type="checkbox"><span>{E(x)}</span></label></li>' for x in p.get('checklist', []))
    iv = ''.join(f'<details class="iv"><summary>{E(x.get("q", ""))}</summary><p>{E(x.get("a", ""))}</p></details>'
                 for x in p.get('interview', []))

    def host(u):
        return re.sub(r'^https?://(www\.)?', '', u).split('/')[0]
    refs = ''.join(f'<li><a href="{E(r.get("url", ""))}" target="_blank" rel="noopener"><b>{E(r.get("title", ""))}</b>'
                   f'<small>{E(host(r.get("url", "")))} ↗</small></a></li>' for r in p.get('refs', []))
    crumb = (f'<nav class="crumb" aria-label="位置"><a href="../index.html">首页</a><span>›</span>'
             f'<a href="../l/{lv[1]}.html#{E(c["cat"])}">{lv[2]} {E(c["level"])} · {ce} {E(cn)}</a><span>›</span>'
             f'<a href="{E(c["slug"])}.html">{E(c["zh"])}</a><span>›</span><b>专业模式</b></nav>')
    pv = prev['slug'] + '.pro.html' if prev else ''
    nx = nxt['slug'] + '.pro.html' if nxt else ''
    body = f'''
<main class="cp pro {lv[1]}" id="main" data-slug="{E(c['slug'])}" data-answer="0" data-prev="{pv}" data-next="{nx}">
{crumb}
<div class="cp-grid">
<aside class="rail" aria-label="本页目录">
  <div class="rail-in">
    <div class="rail-meta"><span class="lvb pro-b">🎓 专业模式</span><span class="muted">No.{c['no']} / {total}</span></div>
    <ol class="rail-list">{rail}</ol>
    <div class="rail-pn">{pn(prev, 'prev', '上一个')}{pn(nxt, 'next', '下一个')}</div>
  </div>
</aside>
<div class="cp-main">
<section class="t chero pro-hero" id="s-hero">
  <div class="hemo" aria-hidden="true">{E(c['emoji'])}</div>
  <div class="chero-txt">
    <div class="meta"><span class="lvb pro-b">🎓 专业模式</span><span>{lv[2]} {E(c['level'])}</span><span>{ce} {E(cn)}</span><span>⏱ 约 10 分钟</span></div>
    <h1>{E(c['zh'])}</h1><p class="en">{E(c['en'])}</p>
    <div class="hbtns"><a class="prosw back" href="{E(c['slug'])}.html" data-mode="easy">🧸 回到小白版</a></div>
  </div>
</section>
<div class="strip-wrap">
  <div class="strip" role="tablist" aria-label="本页卡片">{strip}</div>
  <button class="modebtn" data-act="mode" aria-pressed="false">☰ 全部展开</button>
</div>
<div class="bento cbento pbento">
<section class="t sec p-def" id="p-def">{head(0)}<p class="pdef">{E(p.get('def', ''))}</p></section>
<section class="t sec p-how" id="p-how">{head(1)}<ol class="how">{how}</ol></section>
<section class="t sec p-terms" id="p-terms">{head(2)}<dl class="terms">{terms}</dl></section>
<section class="t sec p-code" id="p-code">{head(3)}<div class="codebox"><div class="codebar"><span>{E(cd.get('title', ''))}</span><em>{E(cd.get('lang', ''))}</em><button class="ccopy">复制</button></div><pre><code>{E(cd.get('src', ''))}</code></pre></div><p class="cnote">{E(cd.get('note', ''))}</p></section>
<section class="t sec p-tab" id="p-tab">{head(4)}<h3 class="tt">{E(tb.get('title', ''))}</h3><div class="tw"><table><thead><tr>{thead}</tr></thead><tbody>{trows}</tbody></table></div></section>
<section class="t sec p-trade" id="p-trade">{head(5)}<div class="trades">{trade}</div></section>
<section class="t sec p-pit" id="p-pit">{head(6)}<ul class="pits">{pits}</ul></section>
<section class="t sec p-check" id="p-check">{head(7)}<ul class="checks">{chk}</ul></section>
<section class="t sec p-int" id="p-int">{head(8)}<div class="ivs">{iv}</div></section>
<section class="t sec p-refs" id="p-refs">{head(9)}<ul class="refs">{refs}</ul></section>
<section class="t fin">
  <img src="../assets/mascot.webp" alt="" width="640" height="640" class="fin-m">
  <div class="fin-txt"><h2 class="fin-h">专业版也啃完了</h2><p class="muted">打卡和小白版共用一个进度。</p>
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
    return page(f"🎓 {c['zh']} · 专业模式 · AI 造物指南", body, 1, bodycls='is-concept is-pro',
                desc=f"{c['zh']} 专业模式：{p.get('def', '')[:80]}")
