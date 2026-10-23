# AI 规划 / 我的项目 端到端测试 + 截图（mock POST /plan 返回 e2e/fixtures 里的真实 mercury-3 输出）
# 用法：uv run --with playwright python scripts/e2e-ai.py [base_url] [out_dir] [fixtures_dir]
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3002/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rw-shots-ai'
FX = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), '..', 'e2e', 'fixtures')
os.makedirs(OUT, exist_ok=True)
fx = {k: json.load(open(os.path.join(FX, f'plan-{k}.json'), encoding='utf-8')) for k in ['bookkeeping', 'portfolio', 'excel', 'portfolio-adjusted']}
errors, expected_net, results = [], [], []
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS'}

def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name, extra, flush=True)

class Mock:
    """可切换的 /plan 模拟：mode = ok:<fixture> | 429 | global429 | missing | net | timeout504"""
    def __init__(self): self.mode = 'ok:bookkeeping'; self.bodies = []; self.delay = 600
    def handle(self, route):
        req = route.request
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
        try: self.bodies.append(json.loads(req.post_data or '{}'))
        except Exception: self.bodies.append(None)
        m = self.mode
        if m.startswith('ok:'):
            f = fx[m[3:]]
            return route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps({'route': f['route'], 'dropped': [], 'remaining': 7, 'ms': 5000}, ensure_ascii=False))
        if m == '429': return route.fulfill(status=429, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps({'error': 'rate_limited', 'message': '你今天已经生成 10 次了，明天再来吧（每天 0 点重置）。'}, ensure_ascii=False))
        if m == 'missing': return route.fulfill(status=500, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps({'error': 'missing_key', 'message': 'x'}))
        if m == 'timeout504': return route.fulfill(status=504, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps({'error': 'timeout', 'message': 'x'}))
        if m == 'net': return route.abort('failed')

def page_for(b, mock, mobile=False, dark=False, done=None):
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900},
                        device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile,
                        color_scheme='dark' if dark else 'light', locale='zh-CN', accept_downloads=True,
                        permissions=['clipboard-read', 'clipboard-write'])
    prefs = {'fs': 18, 'calm': False, 'focus': False, 'still': True}
    init = f"try{{ if(!localStorage.getItem('aig:prefs')) localStorage.setItem('aig:prefs', {json.dumps(json.dumps(prefs))}); localStorage.setItem('aig:theme', {json.dumps(json.dumps('dark' if dark else 'light'))});"
    if done is not None: init += f" if(!sessionStorage.getItem('seeded')){{ localStorage.setItem('aig:done', {json.dumps(json.dumps(done))}); sessionStorage.setItem('seeded','1'); }}"
    init += " }catch(e){}"
    ctx.add_init_script(init)
    ctx.route(re.compile(r'.*/plan$'), mock.handle)
    p = ctx.new_page()
    tag = ('m' if mobile else 'd') + ('-dark' if dark else '')
    def on_console(m):
        if m.type != 'error': return
        (expected_net if 'Failed to load resource' in m.text else errors).append(f'[{tag}] console: {m.text}')
    p.on('console', on_console)
    p.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
    return ctx, p

def go(p, route):
    p.goto(BASE + '#' + route); p.wait_for_load_state('networkidle'); p.wait_for_timeout(500)

def overflow(p, name):
    sw = p.evaluate('document.documentElement.scrollWidth'); cw = p.evaluate('document.documentElement.clientWidth')
    ok(f'no-h-overflow {name}', sw <= cw + 1, f'{sw}/{cw}')

def shot(p, name, full=False):
    p.wait_for_timeout(450)
    p.screenshot(path=f'{OUT}/{name}.jpg', type='jpeg', quality=85, full_page=full)

def projects(p): return p.evaluate("JSON.parse(localStorage.getItem('aig:projects')||'[]')")

BK = fx['bookkeeping']['route']
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    mock = Mock()

    # ================= 桌面 =================
    ctx, p = page_for(b, mock, done=['vibe-coding', 'frontend'])
    reqs = []; p.on('request', lambda r: reqs.append(r.url))
    go(p, '/')
    ok('home: AI 入口卡片', p.locator('[data-testid=home-ai-card]').count() == 1)
    ok('lazy: home 不加载 Plan/Projects chunk', not any(re.search(r'/(Plan|Projects|RouteParts)-', u) for u in reqs), ' '.join(u.split('/')[-1] for u in reqs if u.endswith('.js')))
    ok('sidebar: AI 帮我规划 / 我的项目', p.locator('aside [aria-label="AI 帮我规划"]').count() == 1 and p.locator('aside [aria-label="我的项目"]').count() == 1)
    p.click('aside [aria-label="AI 帮我规划"]'); p.wait_for_timeout(600)
    ok('sidebar → #/plan', p.url.endswith('#/plan'), p.url)
    ok('lazy: Plan chunk 按需加载', any('/Plan-' in u for u in reqs))
    ok('生成按钮：空输入时禁用', p.locator('[data-testid=plan-generate]').is_disabled())
    p.fill('[data-testid=plan-input]', 'x' * 501); p.wait_for_timeout(100)
    ok('超 500 字提示且禁用', p.locator('[data-testid=plan-generate]').is_disabled() and '太长了' in p.inner_text('main'))
    p.fill('[data-testid=plan-input]', '做一个能记账的微信小程序，能记每天花了多少钱，按月看统计图')
    p.click('[data-testid=level-none]'); p.click('[data-testid=hours-5]')
    shot(p, 'plan-desktop'); overflow(p, 'plan-d')

    # 网络错误 → 提示 + 重试
    mock.mode = 'net'; p.click('[data-testid=plan-generate]')
    p.wait_for_selector('[data-testid=plan-error]', timeout=8000)
    ok('网络错误：中文提示', '网络' in p.inner_text('[data-testid=plan-error]'), p.inner_text('[data-testid=plan-error]'))
    ok('网络错误：有重试按钮', p.locator('[data-testid=plan-retry]').count() == 1)
    ok('请求体带 level/hours', mock.bodies[-1] == {'project': '做一个能记账的微信小程序，能记每天花了多少钱，按月看统计图', 'level': 'none', 'hours': 5}, json.dumps(mock.bodies[-1], ensure_ascii=False))
    # 429
    mock.mode = '429'; p.click('[data-testid=plan-retry]')
    p.wait_for_function("document.querySelector('[data-testid=plan-error]')?.innerText.includes('明天')", timeout=8000)
    ok('429：今天用完提示', '明天再来' in p.inner_text('[data-testid=plan-error]'), p.inner_text('[data-testid=plan-error]'))
    ok('429：不显示重试', p.locator('[data-testid=plan-retry]').count() == 0)
    # 504 → 超时提示（可重试）
    mock.mode = 'timeout504'; p.click('[data-testid=plan-generate]')
    p.wait_for_function("document.querySelector('[data-testid=plan-error]')?.innerText.includes('太久')", timeout=8000)
    ok('超时：提示 + 重试', p.locator('[data-testid=plan-retry]').count() == 1)
    # missing_key
    mock.mode = 'missing'; p.click('[data-testid=plan-retry]')
    p.wait_for_function("document.querySelector('[data-testid=plan-error]')?.innerText.includes('站长')", timeout=8000)
    ok('missing_key：站长未配置提示', '站长' in p.inner_text('[data-testid=plan-error]'))

    # 成功：加载动画 → 结果
    mock.mode = 'ok:bookkeeping'
    p.evaluate("""() => { const f = window.fetch; window.fetch = (...a) => new Promise(r => setTimeout(() => r(f(...a)), 900)) }""")
    p.click('[data-testid=plan-generate]')
    ok('生成中：加载动画', p.wait_for_selector('[data-testid=plan-loading]', timeout=3000) is not None)
    p.wait_for_selector('[data-testid=plan-result]', timeout=10000); p.wait_for_timeout(400)
    ok('结果：阶段数一致', p.locator('[data-testid=stage-card]').count() == len(BK['stages']), str(p.locator('[data-testid=stage-card]').count()))
    nconcepts = sum(len(s['concepts']) for s in BK['stages'])
    ok('结果：概念卡片数一致', p.locator('[data-testid=route-concept]').count() == nconcepts, f"{p.locator('[data-testid=route-concept]').count()}/{nconcepts}")
    ok('结果：已学会的打勾', p.locator('[data-testid=route-concept][data-learned="1"]').count() == 2)
    ok('结果：名称', BK['name'] in p.inner_text('[data-testid=plan-result]'))
    href = p.locator('[data-testid=route-concept]').first.get_attribute('href')
    ok('概念卡片链接到概念页', href and href.endswith('#/c/' + BK['stages'][0]['concepts'][0]), href)
    p.locator('[data-testid=plan-result]').scroll_into_view_if_needed(); p.evaluate("window.scrollBy(0,-90)"); p.wait_for_timeout(300)
    shot(p, 'plan-result-desktop'); overflow(p, 'plan-result-d')
    p.locator('[data-testid=copy-prompt]').first.click(); p.wait_for_timeout(200)
    ok('复制指令（结果页）', p.evaluate('navigator.clipboard.readText()') == BK['stages'][0]['prompt'])

    # 创建项目
    p.click('[data-testid=plan-create]'); p.wait_for_timeout(700)
    ps = projects(p)
    ok('创建项目 → aig:projects', len(ps) == 1 and ps[0]['route']['name'] == BK['name'] and ps[0]['input']['level'] == 'none' and ps[0]['input']['hours'] == 5)
    ok('跳转到详情', re.search(r'#/projects/[a-z0-9]+', p.url) is not None, p.url)
    pid = ps[0]['id']
    pct0 = int(p.inner_text('[data-testid=project-pct]'))
    total_units = nconcepts + len(BK['stages'])
    ok('初始进度 = 已学会概念', pct0 == round(2 / total_units * 100), f'{pct0}%')
    ok('一次只显示一个阶段', p.locator('[data-testid=stage-card]').count() == 1)
    p.click('[data-testid=task-check]'); p.wait_for_timeout(200)
    pct1 = int(p.inner_text('[data-testid=project-pct]'))
    ok('勾任务 → 进度增加并保存', pct1 == round(3 / total_units * 100) and projects(p)[0]['tasks'][0] is True, f'{pct0}→{pct1}')
    p.locator('[data-testid=copy-prompt]').click(); p.wait_for_timeout(200)
    ok('复制指令（详情页）', p.evaluate('navigator.clipboard.readText()') == BK['stages'][0]['prompt'])
    ok('复制反馈', '已复制' in p.inner_text('[data-testid=copy-prompt]'))
    nx = p.get_attribute('[data-testid=next-concept]', 'href')
    first_unlearned = next(c for s in BK['stages'] for c in s['concepts'] if c not in ('vibe-coding', 'frontend'))
    ok('继续学下一个未学概念', nx.endswith('#/c/' + first_unlearned), nx)
    p.click('[data-testid=stage-next]'); p.wait_for_timeout(500)
    ok('下一阶段', 'aria-label="阶段 2' in p.inner_html('main') or p.locator('[data-testid=stage-card][aria-label^="阶段 2"]').count() == 1)
    p.keyboard.press('ArrowLeft'); p.wait_for_timeout(400)
    ok('← 键翻回', p.locator('[data-testid=stage-card][aria-label^="阶段 1"]').count() == 1)
    p.evaluate('window.scrollTo(0,0)'); p.wait_for_timeout(200)
    shot(p, 'project-detail-desktop'); overflow(p, 'detail-d')

    # 学会概念 → 进度同步：去概念页点「我学会了」
    go(p, '/c/' + first_unlearned)
    btn = p.locator('button:has-text("我学会了")').first
    clicked = btn.count()
    if clicked:
        btn.click(); p.wait_for_timeout(300)
    go(p, '/projects/' + pid)
    pct2 = int(p.inner_text('[data-testid=project-pct]'))
    ok('概念页学会 → 项目进度同步', pct2 == round(4 / total_units * 100), f'{pct1}→{pct2} (clicked={clicked})')

    # 导出 Markdown
    with p.expect_download() as dl:
        p.click('[data-testid=export-md]')
    d = dl.value; path = d.path(); md = open(path, encoding='utf-8').read()
    ok('导出 Markdown', d.suggested_filename.endswith('.md') and md.startswith('# ' + BK['name']) and md.count('## ') == len(BK['stages']) and '- [x]' in md, d.suggested_filename)
    open(f'{OUT}/export-sample.md', 'w', encoding='utf-8').write(md)

    # 重命名
    p.click('[data-testid=rename]'); p.fill('[data-testid=rename-input]', '我的记账本'); p.keyboard.press('Enter'); p.wait_for_timeout(200)
    ok('重命名', p.inner_text('[data-testid=project-name]') == '我的记账本' and projects(p)[0]['name'] == '我的记账本')

    # 列表
    go(p, '/projects')
    ok('项目列表 1 个', p.locator('[data-testid=project-card]').count() == 1)
    shot(p, 'projects-desktop'); overflow(p, 'projects-d')
    go(p, '/projects/' + pid)

    # 让 AI 调整（带当前路线，确认后覆盖）
    mock.mode = 'ok:portfolio-adjusted'
    p.click('[data-testid=adjust]'); p.fill('[data-testid=adjust-input]', '不要买域名，加一个留言板功能'); p.click('[data-testid=adjust-run]')
    p.wait_for_selector('[data-testid=adjust-preview]', timeout=10000)
    body = mock.bodies[-1]
    ok('调整请求带 current_route + adjust', body.get('adjust') == '不要买域名，加一个留言板功能' and body.get('current_route', {}).get('name') == BK['name'])
    ok('覆盖前先预览确认（未确认不改）', projects(p)[0]['route']['name'] == BK['name'])
    p.click('[data-testid=adjust-apply]'); p.wait_for_timeout(300)
    adj = fx['portfolio-adjusted']['route']
    pr = projects(p)[0]
    ok('确认后覆盖路线，保留自定义名', pr['route']['stages'][2]['title'] == adj['stages'][2]['title'] and pr['name'] == '我的记账本' and len(pr['tasks']) == len(adj['stages']))


    # 删除（要确认）
    go(p, '/projects/' + pid)
    p.click('[data-testid=delete]')
    ok('删除弹出确认', p.locator('[data-testid=confirm-dialog]').count() == 1)
    p.keyboard.press('Escape'); p.wait_for_timeout(400)
    ok('取消删除不删', len(projects(p)) == 1)
    p.click('[data-testid=delete]'); p.click('[data-testid=confirm-ok]'); p.wait_for_timeout(500)
    ok('确认删除 → 回列表 + 空状态', len(projects(p)) == 0 and p.url.endswith('#/projects') and p.locator('[data-testid=projects-empty]').count() == 1)
    go(p, '/projects/nope')
    ok('不存在的项目：友好提示', p.locator('[data-testid=project-missing]').count() == 1)
    ctx.close()

    # ================= 深色（对比度目检） =================
    ctx, p = page_for(b, mock, dark=True, done=['vibe-coding'])
    mock.mode = 'ok:excel'
    go(p, '/plan'); p.fill('[data-testid=plan-input]', '用 AI 自动整理 Excel 销售表的小工具'); p.click('[data-testid=plan-generate]')
    p.wait_for_selector('[data-testid=plan-result]', timeout=10000); p.click('[data-testid=plan-create]'); p.wait_for_timeout(600)
    p.evaluate('window.scrollTo(0,0)'); shot(p, 'project-detail-desktop-dark')
    go(p, '/plan'); shot(p, 'plan-desktop-dark')
    ctx.close()

    # ================= 手机 =================
    ctx, p = page_for(b, mock, mobile=True, done=['frontend'])
    mock.mode = 'ok:portfolio'
    go(p, '/')
    ok('手机底栏：AI 规划入口', p.locator('nav[aria-label="主导航"] button:has-text("AI 规划")').count() == 1)
    overflow(p, 'home-m')
    p.click('nav[aria-label="主导航"] button:has-text("AI 规划")'); p.wait_for_timeout(700)
    ok('手机底栏 → #/plan', p.url.endswith('#/plan'))
    p.fill('[data-testid=plan-input]', '做一个个人作品集网站，放我的设计作品和联系方式'); p.click('[data-testid=level-some]'); p.click('[data-testid=hours-10]')
    shot(p, 'plan-mobile'); overflow(p, 'plan-m')
    p.click('[data-testid=plan-generate]'); p.wait_for_selector('[data-testid=plan-result]', timeout=10000); p.wait_for_timeout(400)
    overflow(p, 'plan-result-m')
    shot(p, 'plan-result-mobile')
    p.click('[data-testid=plan-create]'); p.wait_for_timeout(700)
    ok('手机：创建项目', len(projects(p)) == 1)
    p.evaluate('window.scrollTo(0,0)'); p.wait_for_timeout(200)
    shot(p, 'project-detail-mobile'); overflow(p, 'detail-m')
    p.locator('[data-testid=stage-card]').scroll_into_view_if_needed(); p.wait_for_timeout(200)
    shot(p, 'project-detail-mobile-stage')
    p.click('[data-testid=stage-next]'); p.wait_for_timeout(800)
    ok('手机：翻到下一阶段（一张一张）', p.locator('[data-testid=stage-card][aria-label^="阶段 2"]').count() == 1 and p.locator('[data-testid=stage-card]').count() == 1)
    p.click('[data-testid=task-check]'); p.wait_for_timeout(200)
    ok('手机：勾任务', projects(p)[0]['tasks'][1] is True)
    go(p, '/projects'); shot(p, 'projects-mobile'); overflow(p, 'projects-m')
    ok('手机：AI 规划在 /projects 高亮', p.locator('nav[aria-label="主导航"] button[aria-current=page]:has-text("AI 规划")').count() == 1)
    ctx.close()
    b.close()

print('\n==== console/page errors ====')
for e in errors: print(e)
print(f'(expected network-log lines from mocked 429/504/500/abort tests: {len(expected_net)})')
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed, {len(errors)} console errors')
sys.exit(1 if fails or errors else 0)
