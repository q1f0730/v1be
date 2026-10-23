# 端到端检查 + 截图（在 InstaBox 上跑：uv run --with playwright python e2e-shots.py [base_url] [out_dir]）
# - 每个页面收集 console error / pageerror
# - 检查手机宽度下有没有横向溢出
# - 点测：测验、复制提示词、我学会了、朗读、翻卡、专业模式、复制代码、词汇表分页
import json, sys, os, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3001/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rw-shots'
os.makedirs(OUT, exist_ok=True)
SLUG = 'kv-cache'
ANIM = {'layers': '12-factor-apps', 'flow': 'a2a-protocol', 'balance': 'ab-testing', 'split': 'accessibility', 'guard': 'agent-hooks', 'chat': 'agent-memory', 'loop': 'agentic-rag', 'lock': 'ai-api-key-and-billing', 'filter': 'alert-fatigue', 'timer': 'api-key-rotation', 'toggle': 'api-versioning', 'copy': 'architecture-decision-records', 'queue': 'async-await-and-promises', 'merge': 'attention-mechanism', 'grow': 'autoscaling'}
errors, results = [], []

STUB = """
window.__spoken = [];
if (window.speechSynthesis) {
  const s = window.speechSynthesis;
  s.speak = u => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 400); };
  s.cancel = () => {};
}
"""

def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name, extra)

def page_for(b, mobile=False, dark=False, still=True):
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900},
                        device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile,
                        color_scheme='dark' if dark else 'light', locale='zh-CN',
                        permissions=['clipboard-read', 'clipboard-write'])
    init = STUB
    # 截图时把动画定格（still），保证截图稳定；交互测试另开
    prefs = {'fs': 18, 'calm': False, 'focus': False, 'still': still}
    init += f"try{{ if(!localStorage.getItem('aig:prefs')) localStorage.setItem('aig:prefs', {json.dumps(json.dumps(prefs))}); localStorage.setItem('aig:theme', {json.dumps(json.dumps('dark' if dark else 'light'))}); }}catch(e){{}}"
    ctx.add_init_script(init)
    p = ctx.new_page()
    tag = ('m' if mobile else 'd') + ('-dark' if dark else '')
    p.on('console', lambda m: m.type == 'error' and errors.append(f'[{tag}] console: {m.text}'))
    p.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
    return ctx, p

def go(p, route, wait='main'):
    p.goto(BASE + '#' + route)
    p.wait_for_load_state('networkidle')
    p.wait_for_timeout(700)

def overflow(p, name):
    sw = p.evaluate('document.documentElement.scrollWidth'); cw = p.evaluate('document.documentElement.clientWidth')
    ok(f'no-h-overflow {name}', sw <= cw + 1, f'{sw}/{cw}')

def shot(p, name, full=False):
    p.screenshot(path=f'{OUT}/{name}.png', full_page=full)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    # ---------- 桌面 ----------
    ctx, p = page_for(b)
    reqs = []
    p.on('request', lambda r: reqs.append(r.url))
    go(p, '/'); shot(p, 'home-desktop', full=True); overflow(p, 'home-d')
    ok('lazy: home loads no concept JSON', not any('/data/c/' in u for u in reqs), str(sum('/data/c/' in u for u in reqs)))
    js = [u for u in reqs if u.endswith('.js')]
    ok('lazy: home does not load Concept chunk', not any('Concept-' in u for u in js), ' '.join(u.split('/')[-1] for u in js))
    go(p, '/l/l3'); shot(p, 'level-desktop', full=True); overflow(p, 'level-d')
    reqs.clear()
    go(p, f'/c/{SLUG}'); shot(p, 'concept-desktop'); overflow(p, 'concept-d')
    cj = [u.split('/')[-1] for u in reqs if '/data/c/' in u]
    ok('lazy: concept page fetches own JSON (+ neighbours prefetch)', f'{SLUG}.json' in cj and len(cj) <= 3, ' '.join(cj))
    go(p, f'/c/{SLUG}?s=anim'); shot(p, 'concept-desktop-anim')
    go(p, f'/c/{SLUG}?s=tab'); shot(p, 'concept-desktop-table')
    go(p, f'/c/{SLUG}/pro'); shot(p, 'concept-pro-desktop'); overflow(p, 'pro-d')
    go(p, f'/c/{SLUG}/pro?s=code'); shot(p, 'concept-pro-desktop-code')
    p.click('[data-testid=copy-code]'); p.wait_for_timeout(300)
    ok('copy code button feedback', '已复制' in p.inner_text('[data-testid=copy-code]'))
    clip = p.evaluate('navigator.clipboard.readText()')
    ok('copy code clipboard', len(clip) > 20, clip[:30].replace('\n', ' '))
    go(p, '/glossary'); shot(p, 'glossary-desktop', full=True); overflow(p, 'gloss-d')
    rows = p.locator('tbody tr').count(); ok('glossary paginated (<=30 rows)', 0 < rows <= 30, str(rows))
    # 键盘 ← →
    go(p, f'/c/{SLUG}')
    p.keyboard.press('ArrowRight'); p.wait_for_timeout(400)
    ok('keyboard → next section', 's=ana' in p.url, p.url)
    p.keyboard.press('ArrowLeft'); p.wait_for_timeout(400)
    ok('keyboard ← prev section', 's=' not in p.url, p.url)
    # 搜索浮层
    p.keyboard.press('/'); p.wait_for_timeout(300)
    p.keyboard.type('token'); p.wait_for_timeout(300)
    n = p.locator('[role=listbox] [role=option]').count(); ok('search overlay results 1..8', 0 < n <= 8, str(n))
    shot(p, 'search-desktop')
    p.keyboard.press('Enter'); p.wait_for_timeout(800)
    ok('search enter opens concept', '/c/' in p.url, p.url)
    ctx.close()

    # ---------- 阅读设置：宽松 + 专注 + 大字；全部展开 ----------
    ctx, p = page_for(b)
    p.add_init_script("localStorage.setItem('aig:prefs', JSON.stringify({fs: 21, calm: true, focus: true, still: true}))")
    go(p, f'/c/{SLUG}?s=ana'); shot(p, 'concept-desktop-calm-focus'); overflow(p, 'calm-d')
    ok('calm/focus classes on body', p.evaluate("document.body.classList.contains('calm') && document.body.classList.contains('focus')"))
    p.click('button:visible:has-text("全部展开")'); p.wait_for_timeout(600)
    shot(p, 'concept-desktop-expanded', full=True)
    ctx.close()

    # ---------- 桌面深色 ----------
    ctx, p = page_for(b, dark=True)
    go(p, '/'); shot(p, 'home-desktop-dark', full=True)
    go(p, f'/c/{SLUG}?s=anim'); shot(p, 'concept-desktop-dark')
    ctx.close()

    # ---------- 手机 ----------
    ctx, p = page_for(b, mobile=True)
    go(p, '/'); shot(p, 'home-mobile'); overflow(p, 'home-m'); shot(p, 'home-mobile-full', full=True)
    go(p, '/l/l3'); shot(p, 'level-mobile'); overflow(p, 'level-m'); shot(p, 'level-mobile-full', full=True)
    go(p, f'/c/{SLUG}'); shot(p, 'concept-mobile'); overflow(p, 'concept-m')
    # 翻卡
    p.click('[data-testid=bb-next]'); p.wait_for_timeout(900)
    ok('mobile next card', 's=ana' in p.url, p.url); shot(p, 'concept-mobile-card2')
    for s in ['anim', 'tab', 'ai', 'quiz']:
        go(p, f'/c/{SLUG}?s={s}'); shot(p, f'concept-mobile-{s}'); overflow(p, f'concept-m-{s}')
    # 测验
    data = json.loads(p.evaluate(f"fetch('./data/c/{SLUG}.json').then(r=>r.text())"))
    ans = data['quiz']['answer']; wrong = (ans + 1) % 3
    p.click(f'[data-testid=quiz-opt-{wrong}]'); p.wait_for_timeout(300)
    ok('quiz wrong feedback', p.locator('text=不对哦').count() > 0)
    p.click(f'[data-testid=quiz-opt-{ans}]'); p.wait_for_timeout(400)
    ok('quiz right shows why', p.locator('[data-testid=quiz-why]').count() == 1)
    shot(p, 'concept-mobile-quiz-solved')
    # 复制提示词
    go(p, f'/c/{SLUG}?s=ai')
    p.click('[data-testid=copy-prompt]'); p.wait_for_timeout(300)
    ok('copy prompt feedback', '复制好了' in p.inner_text('[data-testid=copy-prompt]'))
    ok('copy prompt clipboard', p.evaluate('navigator.clipboard.readText()') == data['prompt'])
    # 我学会了
    p.click('[data-testid=bb-done]'); p.wait_for_timeout(300)
    ok('done saved to aig:done', SLUG in json.loads(p.evaluate("localStorage.getItem('aig:done')") or '[]'))
    ok('aig:last saved', json.loads(p.evaluate("localStorage.getItem('aig:last')")) == SLUG)
    p.click('[data-testid=bb-done]'); p.wait_for_timeout(200)
    ok('done toggles off', SLUG not in json.loads(p.evaluate("localStorage.getItem('aig:done')") or '[]'))
    # 朗读
    go(p, f'/c/{SLUG}')
    p.click('[data-testid=tts-main]'); p.wait_for_timeout(150)
    spoken = p.evaluate('window.__spoken')
    ok('TTS speak called with zh text', len(spoken) == 1 and data['oneLiner'][:4] in spoken[0], (spoken[0][:30] if spoken else ''))
    # 专业模式开关
    p.click('[role=radio]:has-text("专业模式")'); p.wait_for_timeout(900)
    ok('switch to pro', p.url.rstrip('/').split('?')[0].endswith('/pro'), p.url)
    ok('prefs.pro remembered', json.loads(p.evaluate("localStorage.getItem('aig:prefs')")).get('pro') is True)
    shot(p, 'concept-pro-mobile'); overflow(p, 'pro-m')
    go(p, f'/c/{SLUG}/pro?s=code'); shot(p, 'concept-pro-mobile-code'); overflow(p, 'pro-m-code')
    go(p, f'/c/{SLUG}/pro?s=int'); p.click('section button[aria-expanded=false] >> nth=0'); p.wait_for_timeout(200); shot(p, 'concept-pro-mobile-int')
    go(p, f'/c/{SLUG}'); p.wait_for_timeout(300)
    ok('easy url redirects to pro when prefs.pro', '/pro' in p.url, p.url)
    p.click('[role=radio]:has-text("小白版")'); p.wait_for_timeout(600)
    ok('switch back to easy', '/pro' not in p.url, p.url)
    # 全部展开
    p.click('button:visible:has-text("全部展开")'); p.wait_for_timeout(500)
    ok('expand all shows all sections', p.locator('[data-sec]').count() == 9, str(p.locator('[data-sec]').count()))
    p.click('button:visible:has-text("一张张")'); p.wait_for_timeout(300)
    go(p, '/glossary'); shot(p, 'glossary-mobile'); overflow(p, 'gloss-m')
    ok('glossary mobile paginated', 0 < p.locator('main ul > li').count() <= 15, str(p.locator('main ul > li').count()))
    go(p, '/'); p.click('header [aria-label=阅读设置]'); p.wait_for_timeout(500); shot(p, 'settings-mobile')
    ctx.close()

    ctx, p = page_for(b, mobile=True, dark=True)
    go(p, f'/c/{SLUG}'); shot(p, 'concept-mobile-dark')
    go(p, '/'); shot(p, 'home-mobile-dark')
    ctx.close()

    # 非定格模式下跑一遍动画页，确认没有报错
    ctx, p = page_for(b, still=False)
    for t, sl in ANIM.items():
        go(p, f'/c/{sl}?s=anim')
    ctx.close()
    # 15 种动画在手机上的定格图
    ctx, p = page_for(b, mobile=True)
    for t, sl in ANIM.items():
        go(p, f'/c/{sl}?s=anim')
        el = p.locator('.sc').first
        el.screenshot(path=f'{OUT}/anim-{t}.png')
    ctx.close()
    b.close()

print('\n=== ERRORS ===')
for e in errors: print(e)
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} checks passed; {len(errors)} console/page errors')
json.dump({'results': results, 'errors': errors}, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=1)
