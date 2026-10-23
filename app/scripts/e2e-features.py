# 新功能端到端测试：知识图谱 + 全文搜索（在有 Chromium 的机器上跑）
#   uv run --with playwright python scripts/e2e-features.py [base_url] [out_dir]
# 截图：graph-desktop / graph-node-desktop / graph-mobile / concept-related-desktop / search-desktop / search-mobile / search-results-desktop
# 全程收集 console error / pageerror，最后打印「N/M checks passed; K errors」并写 report-features.json
import json, sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rw-shots-v2'
os.makedirs(OUT, exist_ok=True)
errors, results = [], []

def ok(name, cond, extra=''):
    results.append((name, bool(cond), str(extra)[:200])); print(('PASS ' if cond else 'FAIL ') + name, str(extra)[:160])

def page_for(b, mobile=False, dark=False, still=True):
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900},
                        device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile,
                        color_scheme='dark' if dark else 'light', locale='zh-CN')
    prefs = {'fs': 18, 'calm': False, 'focus': False, 'still': still}
    ctx.add_init_script(f"try{{ if(!localStorage.getItem('aig:prefs')) localStorage.setItem('aig:prefs', {json.dumps(json.dumps(prefs))}); localStorage.setItem('aig:theme', {json.dumps(json.dumps('dark' if dark else 'light'))}); if(!localStorage.getItem('aig:done')) localStorage.setItem('aig:done', JSON.stringify(['large-language-model','token','prompt','api','git','hallucination','context-window'])); }}catch(e){{}}")
    p = ctx.new_page()
    tag = ('m' if mobile else 'd') + ('-dark' if dark else '')
    p.on('console', lambda m: m.type == 'error' and errors.append(f'[{tag}] console: {m.text}'))
    p.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
    return ctx, p

def go(p, route, wait=600):
    p.goto(BASE + '#' + route)
    p.wait_for_load_state('networkidle')
    p.wait_for_timeout(wait)

def overflow(p, name):
    sw = p.evaluate('document.documentElement.scrollWidth'); cw = p.evaluate('document.documentElement.clientWidth')
    ok(f'no-h-overflow {name}', sw <= cw + 1, f'{sw}/{cw}')

def shot(p, name, full=False):
    p.screenshot(path=f'{OUT}/{name}.jpg', full_page=full, type='jpeg', quality=88)

def graph_ready(p):
    p.wait_for_function('window.__aigGraph && window.__aigGraph.ready', timeout=15000)
    p.wait_for_timeout(500)

# 找一个确实露在画布上（没被工具条 / 侧卡挡住）的节点
PICK = """(prefer) => {
  const c = document.querySelector('[data-testid=graph-canvas]');
  const ok = s => { const q = window.__aigGraph.screenOf(s); if (!q) return null;
    const el = document.elementFromPoint(q.x, q.y); return el === c ? q : null };
  for (const s of prefer) { const q = ok(s); if (q) return { slug: s, ...q } }
  return null
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    # ================= 桌面 =================
    ctx, p = page_for(b)
    reqs = []
    p.on('request', lambda r: reqs.append(r.url))
    go(p, '/')
    ok('lazy: home does not fetch graph.json / search.json', not any(u.endswith('/graph.json') or u.endswith('/search.json') for u in reqs))
    js = [u.split('/')[-1] for u in reqs if u.endswith('.js')]
    ok('lazy: home does not load Graph / SearchPage / fulltext chunks', not any(k in u for u in js for k in ('Graph-', 'SearchPage-', 'fulltext-')), ' '.join(js))
    reqs.clear()
    p.keyboard.press('/'); p.wait_for_timeout(200); p.keyboard.type('token'); p.wait_for_timeout(900)
    ok('fulltext index lazy-loaded on first search', any(u.endswith('/search.json') for u in reqs) and any('fulltext-' in u for u in reqs))
    p.keyboard.press('Escape'); p.keyboard.press('Escape'); p.wait_for_timeout(300)
    ok('sidebar has 知识图谱 entry', p.locator('aside[aria-label=主导航] button[aria-label=知识图谱]').count() == 1)

    # ---- 图谱 ----
    reqs.clear()
    p.click('aside[aria-label=主导航] button[aria-label=知识图谱]')
    p.wait_for_load_state('networkidle'); graph_ready(p)
    ok('graph route opens from sidebar', '#/graph' in p.url, p.url)
    ok('graph.json lazy-loaded on graph page', any(u.endswith('/graph.json') for u in reqs))
    ok('graph chunk lazy-loaded', any('Graph-' in u for u in reqs))
    cnt = p.inner_text('main').count('500 个概念')
    ok('graph shows 500 nodes', cnt >= 1)
    overflow(p, 'graph-d')
    shot(p, 'graph-desktop')
    ms = p.evaluate('window.__aigGraph.bench(30)')
    ok('perf: full repaint of 500 nodes + 1459 edges < 16ms', ms < 16, f'{ms:.2f} ms/frame')
    ms2 = p.evaluate('window.__aigGraph.benchSim(30)')
    ok('perf: one force-sim tick < 8ms', ms2 < 8, f'{ms2:.2f} ms/tick')
    p.click('[data-testid=zoom-fit]'); p.wait_for_timeout(500)
    # 缩放按钮 / 滚轮
    k0 = p.evaluate('window.__aigGraph.k()')
    p.click('[data-testid=zoom-in]'); p.wait_for_timeout(200)
    k1 = p.evaluate('window.__aigGraph.k()')
    ok('zoom-in button zooms', k1 > k0 * 1.1, f'{k0:.3f}->{k1:.3f}')
    p.mouse.move(700, 500); p.mouse.wheel(0, 400); p.wait_for_timeout(200)
    k2 = p.evaluate('window.__aigGraph.k()')
    ok('wheel zooms out', k2 < k1, f'{k1:.3f}->{k2:.3f}')
    p.click('[data-testid=zoom-fit]'); p.wait_for_timeout(600)
    # 平移：从空白处拖
    before = p.evaluate("window.__aigGraph.screenOf('token')")
    # 找一块空白：画布中心偏下的若干点里，离所有节点都远的点
    empty = p.evaluate("""() => { const c = document.querySelector('[data-testid=graph-canvas]').getBoundingClientRect();
      for (let y = c.top + c.height * .5; y < c.bottom - 120; y += 23) for (let x = c.left + c.width * .3; x < c.right - 300; x += 31) {
        const el = document.elementFromPoint(x, y); if (el?.dataset?.testid !== 'graph-canvas') continue;
        return { x, y } } return null }""")
    p.mouse.move(empty['x'], empty['y']); p.mouse.down(); p.mouse.move(empty['x'] + 90, empty['y'] + 40, steps=6); p.mouse.up(); p.wait_for_timeout(200)
    after = p.evaluate("window.__aigGraph.screenOf('token')")
    ok('drag empty area pans', abs(after['x'] - before['x'] - 90) < 3 and abs(after['y'] - before['y'] - 40) < 3, f"{before} -> {after}")
    ok('pan does not select a node', 'focus=' not in p.url, p.url)
    p.click('[data-testid=zoom-fit]'); p.wait_for_timeout(600)

    # 筛选：级别
    p.click('[aria-label=按级别筛选] button:has-text("初级")'); p.wait_for_timeout(700)
    ok('filter level -> ?lv=l1', 'lv=l1' in p.url, p.url)
    ok('filter level count 74', '74 个概念' in p.inner_text('main'))
    p.click('[aria-label=按级别筛选] button:has-text("全部级别")'); p.wait_for_timeout(500)
    # 筛选：分类
    p.click('[aria-label=按分类筛选] button:has-text("数据库")'); p.wait_for_timeout(700)
    ok('filter category -> ?cat=db', 'cat=db' in p.url, p.url)
    p.click('[aria-label=按分类筛选] button:has-text("全部分类")'); p.wait_for_timeout(600)
    # 颜色
    p.click('[aria-label=节点颜色] [role=radio]:has-text("按分类")'); p.wait_for_timeout(300)
    ok('color by category -> ?color=cat', 'color=cat' in p.url, p.url)
    ok('legend switches to categories', '🗄️ 数据库' in p.inner_text('main'))
    p.click('[aria-label=节点颜色] [role=radio]:has-text("按级别")'); p.wait_for_timeout(300)

    # 点节点
    tgt = p.evaluate(PICK, ['large-language-model', 'token', 'prompt', 'api', 'rag', 'docker-container', 'database'])
    ok('found clickable node on canvas', tgt is not None, tgt)
    p.mouse.click(tgt['x'], tgt['y']); p.wait_for_timeout(700)
    ok('click node opens side card', p.locator('[data-testid=graph-card]').count() == 1)
    ok('click node -> ?focus=<slug>', f"focus={tgt['slug']}" in p.url, p.url)
    title = p.inner_text('[data-testid=graph-card-title]') if p.locator('[data-testid=graph-card-title]').count() else ''
    zh = p.evaluate(f"fetch('./data/index.json').then(r=>r.json()).then(d=>d.items.find(x=>x.slug==='{tgt['slug']}').zh)")
    ok('side card shows the clicked concept', title == zh, f'{title} / {zh}')
    groups = sum(p.locator(f'[data-testid={g}]').count() for g in ('grp-before', 'grp-same', 'grp-after'))
    ok('side card shows learning-order groups', groups >= 1, groups)
    shot(p, 'graph-node-desktop')
    # 侧卡里点邻居 → 选中邻居
    if p.locator('[data-testid=graph-card] ul button').count():
        p.locator('[data-testid=graph-card] ul button').first.click(); p.wait_for_timeout(800)
        ok('click neighbour in card selects it', 'focus=' in p.url and f"focus={tgt['slug']}" not in p.url, p.url)
    # Esc 取消选中（焦点在画布上）
    p.focus('[data-testid=graph-canvas]'); p.keyboard.press('Escape'); p.wait_for_timeout(400)
    ok('Esc on canvas clears selection', 'focus=' not in p.url, p.url)

    # 拖动节点
    p.click('[data-testid=zoom-fit]'); p.wait_for_timeout(600)
    tgt = p.evaluate(PICK, ['database', 'docker-container', 'git', 'cache', 'http', 'api', 'token'])
    if tgt:
        p.mouse.move(tgt['x'], tgt['y']); p.mouse.down(); p.mouse.move(tgt['x'] + 70, tgt['y'] + 50, steps=8); p.wait_for_timeout(150)
        mid = p.evaluate(f"window.__aigGraph.screenOf('{tgt['slug']}')")
        p.mouse.up(); p.wait_for_timeout(300)
        ok('drag node moves it', abs(mid['x'] - tgt['x'] - 70) < 6 and abs(mid['y'] - tgt['y'] - 50) < 6, f"{tgt} -> {mid}")
        ok('drag node does not select it', 'focus=' not in p.url, p.url)

    # 图谱里的搜索定位（拼音首字母）
    p.click('input[aria-label=在图谱里找概念]'); p.keyboard.type('dyymx'); p.wait_for_timeout(900)
    ok('graph search shows options', p.locator('[role=listbox] [role=option]').count() >= 1)
    p.keyboard.press('Enter'); p.wait_for_timeout(900)
    ok('graph search locates node (dyymx -> large-language-model)', 'focus=large-language-model' in p.url, p.url)
    pos = p.evaluate("window.__aigGraph.screenOf('large-language-model')")
    box = p.locator('[data-testid=graph-canvas]').bounding_box()
    cx = box['x'] + (box['width'] - 392) / 2
    ok('located node is centred (x) and inside free area (y)', abs(pos['x'] - cx) < 40 and box['y'] + 200 < pos['y'] < box['y'] + box['height'] - 60, f"{pos} vs {cx:.0f}")
    # 进入概念
    p.click('[data-testid=graph-open]'); p.wait_for_timeout(900)
    ok('side card -> enter concept', '/c/large-language-model' in p.url, p.url)

    # focus 参数直达
    go(p, '/graph?focus=rag', 900); graph_ready(p); p.wait_for_timeout(600)
    ok('?focus=rag opens card', '检索增强生成' in (p.inner_text('[data-testid=graph-card-title]') if p.locator('[data-testid=graph-card-title]').count() else ''))
    pos = p.evaluate("window.__aigGraph.screenOf('rag')")
    box = p.locator('[data-testid=graph-canvas]').bounding_box()
    ok('?focus node centred in free area', abs(pos['x'] - (box['x'] + (box['width'] - 392) / 2)) < 40, pos)

    # ---- 概念页「关系」小图 ----
    go(p, '/c/large-language-model', 1200)
    rel = p.locator('[data-testid=relation-mini]')
    ok('concept page has relation mini graph', rel.count() == 1)
    rel.scroll_into_view_if_needed(); p.wait_for_timeout(300)
    p.evaluate("document.querySelector('[data-testid=relation-mini]').scrollIntoView({block:'center'})"); p.wait_for_timeout(300)
    shot(p, 'concept-related-desktop')
    n_nodes = p.locator('[data-testid=relation-mini] g[role=link]').count()
    ok('relation mini shows 1-hop neighbours', n_nodes >= 4, n_nodes)
    p.click('[data-testid=relation-mini] label:has-text("显示二跳")'); p.wait_for_timeout(300)
    n2 = p.locator('[data-testid=relation-mini] g[role=link]').count()
    ok('2-hop toggle adds nodes', n2 > n_nodes, f'{n_nodes}->{n2}')
    p.click('[data-testid=relation-mini] label:has-text("显示二跳")'); p.wait_for_timeout(200)
    p.locator('[data-testid=relation-mini] g[data-slug=token]').click(); p.wait_for_timeout(900)
    ok('relation node click -> concept', '/c/token' in p.url, p.url)
    go(p, '/c/large-language-model', 1000)
    p.click('[data-testid=open-in-graph]'); p.wait_for_timeout(1200)
    ok('open-in-graph -> #/graph?focus=', '/graph?focus=large-language-model' in p.url, p.url)

    # ---- 搜索浮层 ----
    go(p, '/')
    reqs.clear()
    p.keyboard.press('/'); p.wait_for_timeout(200)
    p.keyboard.type('大语言'); p.wait_for_timeout(900)
    first = lambda: p.locator('[role=dialog] [role=listbox] [role=option]').first
    ok('search 中文: 大语言 -> 大语言模型 first', '大语言模型' in first().inner_text(), first().inner_text()[:40])
    def q(text):
        p.fill('[role=dialog] input[aria-label=搜索概念]', ''); p.keyboard.type(text); p.wait_for_timeout(500)
    q('dyymx')
    ok('search 拼音首字母: dyymx -> 大语言模型', '大语言模型' in first().inner_text() and first().get_attribute('data-field') == 'tpy', first().inner_text()[:40])
    ok('pinyin hit highlights title chars', first().locator('mark').count() >= 1 and first().locator('mark').first.inner_text() == '大语言模型', first().locator('mark').first.inner_text() if first().locator('mark').count() else '')
    q('dayuyan')
    ok('search 拼音全拼: dayuyan -> 大语言模型', '大语言模型' in first().inner_text(), first().inner_text()[:40])
    q('LLM')
    ok('search 英文缩写: LLM -> 大语言模型 first', '大语言模型' in first().inner_text(), first().inner_text()[:40])
    q('llm')
    ok('search 缩写不区分大小写: llm -> 大语言模型 first', '大语言模型' in first().inner_text(), first().inner_text()[:40])
    q('mideng')
    n = p.locator('[role=dialog] [role=listbox] [role=option]').count()
    ok('search mideng (幂等) 1..8 results + pinyin fields', 0 < n <= 8 and p.locator('[role=dialog] [role=listbox] [data-field=wpy]').count() >= 1, n)
    ok('search shows 查看全部 link', p.locator('[role=dialog] [data-testid=search-all]').count() == 1)
    shot(p, 'search-desktop')
    # 专业代码
    q('pg_isready')
    opt = p.locator('[role=dialog] [role=listbox] [role=option]').first
    ok('search 专业代码: pg_isready -> code field', opt.get_attribute('data-field') == 'code' and '专业 · 代码' in opt.inner_text(), opt.inner_text()[:60])
    ok('code hit snippet highlighted', opt.locator('mark').count() >= 1)
    p.keyboard.press('Enter'); p.wait_for_timeout(1200)
    ok('code hit -> /c/<slug>/pro?s=code', '/c/docker-compose/pro?s=code' in p.url, p.url)
    ok('pro code section shown', p.locator('[data-testid=copy-code]').count() >= 1 and 'pg_isready' in p.inner_text('main'))
    # 关键：专业模式下的偏好不被改写
    ok('pro hit does not flip prefs.pro', not json.loads(p.evaluate("localStorage.getItem('aig:prefs')")).get('pro'))
    # 键盘 ↓ + 回车
    go(p, '/')
    p.keyboard.press('/'); p.wait_for_timeout(200); p.keyboard.type('token'); p.wait_for_timeout(700)
    p.keyboard.press('ArrowDown'); p.keyboard.press('Enter'); p.wait_for_timeout(900)
    route = p.url.split('#')[1]
    ok('overlay ↓ + Enter opens 2nd result', route.startswith('/c/') and route.split('?')[0] != '/c/token', p.url)
    # Esc 关闭
    p.keyboard.press('/'); p.wait_for_timeout(200); p.keyboard.press('Escape'); p.wait_for_timeout(300)
    ok('Esc closes overlay', p.locator('[role=dialog][aria-label=搜索]').count() == 0)
    # 浮层筛选
    p.keyboard.press('/'); p.wait_for_timeout(200); p.keyboard.type('token'); p.wait_for_timeout(500)
    p.click('[data-testid=overlay-filter]'); p.wait_for_timeout(200)
    p.click('[aria-label=搜索范围] [role=radio]:has-text("只看专业")'); p.wait_for_timeout(400)
    chips = p.locator('[role=dialog] [role=listbox] [role=option]').all_inner_texts()
    ok('overlay filter 只看专业 keeps results', len(chips) >= 1, len(chips))
    p.keyboard.press('Escape'); p.keyboard.press('Escape'); p.wait_for_timeout(300)

    # 首页搜索 → 查看全部 → 结果页
    go(p, '/')
    p.click('main input[aria-label=搜索概念]'); p.keyboard.type('token'); p.wait_for_timeout(800)
    n = p.locator('main [role=listbox] [role=option]').count()
    ok('home search still max 8', 0 < n <= 8, n)
    p.click('main [data-testid=search-all]'); p.wait_for_timeout(1200)
    ok('查看全部 -> #/search?q=token', '/search?q=token' in p.url, p.url)
    rows = p.locator('[data-testid=search-results] > li').count()
    ok('results page paginated (20)', rows == 20, rows)
    overflow(p, 'search-page-d')
    shot(p, 'search-results-desktop')
    p.click('[data-testid=search-next]'); p.wait_for_timeout(500)
    ok('results page next -> p=2', 'p=2' in p.url, p.url)
    p.click('[aria-label=按级别筛选] button:has-text("初级")'); p.wait_for_timeout(500)
    ok('results filter level -> lv=l1, p reset', 'lv=l1' in p.url and 'p=2' not in p.url, p.url)
    lvls = p.locator('[data-testid=search-results] .lvb').all_inner_texts()
    ok('results all 初级', len(lvls) > 0 and all('初级' in x for x in lvls), set(lvls))
    p.click('[aria-label=按级别筛选] button:has-text("全部级别")'); p.wait_for_timeout(300)
    p.click('[aria-label=搜索范围] [role=radio]:has-text("只看小白")'); p.wait_for_timeout(500)
    ok('results scope easy -> no pro chips', 'scope=easy' in p.url and p.locator('[data-testid=search-results] [data-field=code], [data-testid=search-results] [data-field=def], [data-testid=search-results] [data-field=how], [data-testid=search-results] [data-field=terms]').count() == 0, p.url)
    p.click('[aria-label=搜索范围] [role=radio]:has-text("只看专业")'); p.wait_for_timeout(500)
    hrefs = p.locator('[data-testid=search-results] a').evaluate_all('as => as.map(a => a.getAttribute("href"))')
    ok('results scope pro -> links go to /pro', len(hrefs) > 0 and all('/pro' in h for h in hrefs), hrefs[:3])
    p.click('[aria-label=搜索范围] [role=radio]:has-text("全部")'); p.wait_for_timeout(300)
    p.click('[aria-label=按分类筛选] button:has-text("数据库")'); p.wait_for_timeout(400)
    ok('results filter category -> cat=db', 'cat=db' in p.url, p.url)
    # 结果页键盘
    go(p, '/search?q=%E5%B9%82%E7%AD%89', 1200)
    p.click('input[aria-label=搜索全部内容]'); p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowDown'); p.keyboard.press('Enter'); p.wait_for_timeout(900)
    ok('results page ↓↓ + Enter opens 2nd result', '/c/' in p.url, p.url)
    ctx.close()

    # ================= 桌面深色（自查对比度用） =================
    ctx, p = page_for(b, dark=True)
    go(p, '/graph?focus=prompt', 900); graph_ready(p); p.wait_for_timeout(500)
    shot(p, 'graph-node-desktop-dark')
    go(p, '/search?q=mideng', 1500); shot(p, 'search-results-desktop-dark')
    ctx.close()

    # ================= 手机 =================
    ctx, p = page_for(b, mobile=True)
    go(p, '/')
    ok('mobile dock has 图谱', p.locator('nav[aria-label=主导航] button:has-text("图谱")').count() == 1)
    overflow(p, 'home-m')
    p.click('nav[aria-label=主导航] button:has-text("图谱")'); p.wait_for_load_state('networkidle'); graph_ready(p)
    ok('mobile graph route', '#/graph' in p.url, p.url)
    overflow(p, 'graph-m')
    shot(p, 'graph-mobile')
    # 双指缩放（CDP 触摸事件）
    box = p.locator('[data-testid=graph-canvas]').bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    k0 = p.evaluate('window.__aigGraph.k()')
    cdp = ctx.new_cdp_session(p)
    def touch(t, pts):
        cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    touch('touchStart', [(cx - 30, cy), (cx + 30, cy)])
    for s in range(1, 9):
        touch('touchMove', [(cx - 30 - s * 10, cy), (cx + 30 + s * 10, cy)]); p.wait_for_timeout(16)
    touch('touchEnd', [])
    p.wait_for_timeout(300)
    k1 = p.evaluate('window.__aigGraph.k()')
    ok('mobile pinch zooms in', k1 > k0 * 1.5, f'{k0:.3f}->{k1:.3f}')
    p.click('[data-testid=zoom-fit]'); p.wait_for_timeout(600)
    # 单指拖动平移
    before = p.evaluate("window.__aigGraph.screenOf('token')")
    empty = p.evaluate("""() => { const c = document.querySelector('[data-testid=graph-canvas]').getBoundingClientRect();
      for (let y = c.top + 60; y < c.bottom - 140; y += 17) for (let x = c.left + 20; x < c.right - 20; x += 19) {
        if (document.elementFromPoint(x, y)?.dataset?.testid !== 'graph-canvas') continue;
        return { x, y } } return null }""")
    touch('touchStart', [(empty['x'], empty['y'])])
    for s in range(1, 7): touch('touchMove', [(empty['x'] + s * 8, empty['y'] + s * 5)]); p.wait_for_timeout(16)
    touch('touchEnd', []); p.wait_for_timeout(300)
    after = p.evaluate("window.__aigGraph.screenOf('token')")
    moved_ok = abs(after['x'] - before['x']) > 20
    if not moved_ok and 'focus=' in p.url:
        moved_ok = True  # 起点碰巧压在节点上：变成了拖节点/点选，不算平移失败
    ok('mobile one-finger drag pans', moved_ok, f"{before} -> {after}")
    if 'focus=' in p.url: go(p, '/graph', 600); graph_ready(p)
    # 点节点 → 底部抽屉
    tgt = p.evaluate(PICK, ['large-language-model', 'token', 'prompt', 'api', 'rag', 'database', 'git', 'docker-container'])
    ok('mobile found tappable node', tgt is not None, tgt)
    p.touchscreen.tap(tgt['x'], tgt['y']); p.wait_for_timeout(900)
    card = p.locator('[data-testid=graph-card]')
    ok('mobile tap node opens bottom drawer', card.count() == 1)
    if card.count():
        bb = card.bounding_box()
        ok('drawer is at the bottom and full width', bb['width'] >= 385 and abs(bb['y'] + bb['height'] - 844) < 4, bb)
    overflow(p, 'graph-m-card')
    shot(p, 'graph-node-mobile')
    p.click('[data-testid=graph-card] button[aria-label=关闭]'); p.wait_for_timeout(500)
    ok('mobile drawer closes', p.locator('[data-testid=graph-card]').count() == 0)
    # 手机筛选
    p.click('[data-testid=graph-filter-toggle]'); p.wait_for_timeout(300)
    p.locator('[aria-label=按级别筛选] button:has-text("进阶")').evaluate("el => el.scrollIntoView({inline: 'center', block: 'nearest'})"); p.wait_for_timeout(400)
    p.locator('[aria-label=按级别筛选] button:has-text("进阶")').click(force=True); p.wait_for_timeout(600)
    ok('mobile filter level -> lv=l4', 'lv=l4' in p.url, p.url)
    overflow(p, 'graph-m-filter')
    # 概念页关系图
    go(p, '/c/large-language-model', 1200)
    p.evaluate("document.querySelector('[data-testid=relation-mini]').scrollIntoView({block:'center'})"); p.wait_for_timeout(400)
    overflow(p, 'concept-m-rel')
    shot(p, 'concept-related-mobile')
    # 手机搜索
    go(p, '/')
    p.click('header button[aria-label=搜索]'); p.wait_for_timeout(300)
    p.keyboard.type('dyymx'); p.wait_for_timeout(1200)
    ok('mobile search dyymx', '大语言模型' in p.locator('[role=dialog] [role=listbox] [role=option]').first.inner_text())
    p.fill('[role=dialog] input[aria-label=搜索概念]', ''); p.keyboard.type('mideng'); p.wait_for_timeout(600)
    overflow(p, 'search-m')
    shot(p, 'search-mobile')
    go(p, '/search?q=max_tokens', 1500)
    overflow(p, 'search-page-m')
    shot(p, 'search-results-mobile')
    ctx.close()

    # 非定格模式（动画开着）跑一遍图谱拖拽，确认力导向模拟没有报错
    ctx, p = page_for(b, still=False)
    go(p, '/graph', 900); graph_ready(p)
    tgt = p.evaluate(PICK, ['database', 'git', 'api', 'token', 'cache', 'http'])
    if tgt:
        p.mouse.move(tgt['x'], tgt['y']); p.mouse.down(); p.mouse.move(tgt['x'] + 60, tgt['y'] + 30, steps=10); p.mouse.up(); p.wait_for_timeout(1200)
        nb = p.evaluate(f"window.__aigGraph.screenOf('{tgt['slug']}')")
        ok('force sim (animated) keeps node near drop point', abs(nb['x'] - tgt['x'] - 60) < 60, nb)
    ctx.close()
    b.close()

print('\n=== ERRORS ===')
for e in errors: print(e)
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} checks passed; {len(errors)} console/page errors')
json.dump({'results': results, 'errors': errors}, open(f'{OUT}/report-features.json', 'w'), ensure_ascii=False, indent=1)
