# rewamp-v3 合并后的导航检查 + 截图：首页（桌面 / 手机）、手机「更多」展开、矮屏桌面导航坞（1280×700）
# 用法：uv run --with playwright python scripts/e2e-v3-shots.py [base_url] [out_dir]
import sys, os, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rw-shots-v3'
os.makedirs(OUT, exist_ok=True)
results, errors = [], []

def ok(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{info}]' if info else ''), flush=True)

def page_for(b, w, h, mobile=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, locale='zh-CN')
    p = ctx.new_page()
    p.on('console', lambda m: m.type == 'error' and errors.append(f'console: {m.text}'))
    p.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    return ctx, p

def go(p, path, wait=900):
    p.goto(BASE + '#' + path); p.wait_for_load_state('networkidle'); p.wait_for_timeout(wait)

def shot(p, name, full=False):
    p.screenshot(path=os.path.join(OUT, name + '.jpg'), type='jpeg', quality=82, full_page=full)

def h_overflow(p):
    return p.evaluate('document.documentElement.scrollWidth - innerWidth')

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    # 桌面首页
    ctx, p = page_for(b, 1440, 900)
    go(p, '/')
    ok('desktop home: AI 卡 + 图谱卡', p.locator('[data-testid=home-ai-card]').count() == 1 and p.locator('[data-testid=home-graph-card]').count() == 1)
    ai = p.locator('[data-testid=home-ai-card]').bounding_box(); gr = p.locator('[data-testid=home-graph-card]').bounding_box()
    ok('desktop home: AI 卡与图谱卡同一行、等高', abs(ai['y'] - gr['y']) < 2 and abs(ai['height'] - gr['height']) < 2, f"{ai['y']:.0f}/{gr['y']:.0f} h {ai['height']:.0f}/{gr['height']:.0f}")
    ok('desktop home: 无横向溢出', h_overflow(p) <= 0)
    for lab in ['知识图谱', 'AI 帮我规划', '我的项目', '词汇表', '阅读设置']:
        ok(f'sidebar 有「{lab}」', p.locator(f'aside[aria-label=主导航] button[aria-label="{lab}"]').count() == 1)
    shot(p, 'home-desktop', full=True)
    p.click('[data-testid=home-graph-card]'); p.wait_for_timeout(900)
    ok('首页图谱卡 → #/graph', '#/graph' in p.url, p.url)
    ctx.close()

    # 矮屏桌面导航坞
    ctx, p = page_for(b, 1280, 700)
    go(p, '/')
    r = p.evaluate('''(() => { const a = document.querySelector('aside[aria-label=主导航]'); const r = a.getBoundingClientRect();
      const btns = [...a.querySelectorAll('button[aria-label]')].filter(x => !/深色|浅色|主题/.test(x.getAttribute('aria-label'))).map(x => x.getBoundingClientRect());
      return { top: r.top, bottom: r.bottom, sh: a.scrollHeight, ch: a.clientHeight, ih: innerHeight, maxBtn: Math.max(...btns.map(x => x.bottom)), minBtn: Math.min(...btns.map(x => x.height)) } })()''')
    ok('1280×700 导航坞不溢出', r['bottom'] <= r['ih'] and r['maxBtn'] <= r['bottom'] and r['sh'] <= r['ch'] + 1, json.dumps(r))
    ok('1280×700 按钮仍 ≥ 40px', r['minBtn'] >= 40, r['minBtn'])
    p.hover('aside[aria-label=主导航] button[aria-label="我的项目"]'); p.wait_for_timeout(350)
    shot(p, 'sidebar-desktop-short')
    p.click('aside[aria-label=主导航] button[aria-label="AI 帮我规划"]'); p.wait_for_timeout(700)
    ok('sidebar → #/plan', p.url.endswith('#/plan'))
    p.click('aside[aria-label=主导航] button[aria-label="我的项目"]'); p.wait_for_timeout(700)
    ok('sidebar → #/projects 且高亮', p.url.endswith('#/projects') and p.locator('aside[aria-label=主导航] button[aria-label="我的项目"][aria-current=page]').count() == 1)
    ctx.close()

    # 手机
    for w in (390, 360):
        ctx, p = page_for(b, w, 844, mobile=True)
        go(p, '/')
        nav = p.locator('nav[aria-label=主导航]')
        labels = nav.locator('button').all_inner_texts()
        ok(f'{w}px 底栏 5 个按钮', [x.strip() for x in labels] == ['首页', '学习', 'AI 规划', '图谱', '更多'], labels)
        trunc = p.evaluate('''[...document.querySelectorAll('nav[aria-label=主导航] button span')].filter(s => s.scrollWidth > s.clientWidth + 0.5 || s.getBoundingClientRect().width > s.parentElement.getBoundingClientRect().width).map(s => s.textContent)''')
        ok(f'{w}px 底栏中文不截断', not trunc, trunc)
        nb = nav.bounding_box()
        ok(f'{w}px 底栏在屏幕内', nb['x'] >= 0 and nb['x'] + nb['width'] <= w, f"{nb['x']:.0f}..{nb['x'] + nb['width']:.0f}")
        ok(f'{w}px 首页无横向溢出', h_overflow(p) <= 0)
        if w == 390:
            shot(p, 'home-mobile')
            shot(p, 'home-mobile-full', full=True)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(450)
        menu = p.locator('#dock-more')
        ok(f'{w}px 更多展开', menu.count() == 1 and p.locator('nav[aria-label=主导航] button[aria-expanded=true]').count() == 1)
        items = [x.strip() for x in menu.locator('button').all_inner_texts()]
        ok(f'{w}px 更多 = 我的项目/词汇表/随机一个/阅读设置', items == ['我的项目', '词汇表', '随机一个', '阅读设置'], items)
        mb = menu.bounding_box()
        ok(f'{w}px 更多面板在屏幕内', mb['x'] >= 0 and mb['x'] + mb['width'] <= w and mb['y'] >= 0, f"{mb}")
        mt = p.evaluate('''[...document.querySelectorAll('#dock-more button span')].filter(s => s.scrollWidth > s.clientWidth + 0.5).map(s => s.textContent)''')
        ok(f'{w}px 更多面板中文不截断', not mt, mt)
        if w == 390: shot(p, 'mobile-more')
        p.keyboard.press('Escape'); p.wait_for_timeout(700)
        ok(f'{w}px Esc 关闭更多', p.locator('#dock-more').count() == 0 and p.locator('nav[aria-label=主导航] button[aria-expanded=false]').count() == 1)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(300)
        p.mouse.click(w / 2, 200); p.wait_for_timeout(700)
        ok(f'{w}px 点外面关闭更多', p.locator('#dock-more').count() == 0 and p.locator('nav[aria-label=主导航] button[aria-expanded=false]').count() == 1)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(300)
        p.click('#dock-more button:has-text("词汇表")'); p.wait_for_timeout(800)
        ok(f'{w}px 更多→词汇表，「更多」高亮', '#/glossary' in p.url and p.locator('#dock-more').count() == 0 and p.locator('nav[aria-label=主导航] button:has-text("更多") span.absolute').count() == 1, p.url)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(300)
        p.click('#dock-more button:has-text("我的项目")'); p.wait_for_timeout(800)
        ok(f'{w}px 更多→我的项目（AI 规划高亮）', '#/projects' in p.url and p.locator('nav[aria-label=主导航] button[aria-current=page]:has-text("AI 规划")').count() == 1, p.url)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(300)
        p.click('#dock-more button:has-text("阅读设置")'); p.wait_for_timeout(600)
        ok(f'{w}px 更多→阅读设置打开', p.locator('[role=dialog]').count() >= 1)
        p.keyboard.press('Escape'); p.wait_for_timeout(300)
        p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(300)
        p.click('#dock-more button:has-text("随机一个")'); p.wait_for_timeout(900)
        ok(f'{w}px 更多→随机一个', '#/c/' in p.url, p.url)
        ctx.close()

    # 深色手机更多
    ctx, p = page_for(b, 390, 844, mobile=True)
    p.add_init_script("localStorage.setItem('aig:theme', JSON.stringify('dark'))")
    go(p, '/')
    p.click('nav[aria-label=主导航] button:has-text("更多")'); p.wait_for_timeout(450)
    shot(p, 'mobile-more-dark')
    ctx.close()
    b.close()

print('\n==== console/page errors ====')
for e in errors: print(e)
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} passed, {len(errors)} console/page errors')
sys.exit(1 if fails or errors else 0)
