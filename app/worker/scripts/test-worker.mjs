// 离线测试 worker 逻辑（mock 上游与 KV）：node worker/scripts/test-worker.mjs
import fs from 'node:fs'
import worker from '../index.js'
const fx = JSON.parse(fs.readFileSync(new URL('../../e2e/fixtures/plan-portfolio.json', import.meta.url)))
const kvStore = new Map()
const KV = { get: async k => kvStore.get(k) ?? null, put: async (k, v) => { kvStore.set(k, v) } }
const ORIGIN = 'http://localhost:5173'
let upstream = () => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify({ ...fx.route, stages: fx.route.stages.map((s, i) => i === 0 ? { ...s, concepts: [...s.concepts, 'not-a-real-slug'] } : s) }) } }] } })
let calls = 0
globalThis.fetch = async (url, init) => { calls++; const u = await upstream(init); return new Response(JSON.stringify(u.body), { status: u.status }) }
const env = { INCEPTION_API_KEY: 'test', LIMITS: KV, IP_DAILY: '3', GLOBAL_DAILY: '5' }
const post = (body, e = env, ip = '1.1.1.1') => worker.fetch(new Request('https://x/plan', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), e)
let pass = 0, failN = 0
const ok = (n, c, x = '') => { c ? pass++ : failN++; console.log((c ? 'PASS ' : 'FAIL ') + n, x) }

let r = await post({ project: '作品集网站' }); let j = await r.json()
ok('200 + route', r.status === 200 && j.route.stages.length >= 3, r.status)
ok('drops invalid slug', j.dropped.includes('not-a-real-slug') && !j.route.stages[0].concepts.includes('not-a-real-slug'))
ok('remaining', j.remaining === 2, j.remaining)
r = await post({ project: '' }); ok('empty → 400', r.status === 400)
r = await post({ project: 'x'.repeat(501) }); ok('too long → 400', r.status === 400 && (await r.json()).error === 'too_long')
r = await post({ project: 'x', adjust: '更简单' }); ok('adjust w/o route → 400', r.status === 400)
r = await post({ project: 'x', adjust: '更简单', current_route: fx.route }); ok('adjust ok', r.status === 200)
r = await post({ project: 'x' }); ok('3rd ok', r.status === 200)
r = await post({ project: 'x' }); j = await r.json(); ok('ip limit → 429', r.status === 429 && j.error === 'rate_limited', JSON.stringify(j))
r = await post({ project: 'x' }, env, '2.2.2.2'); ok('other ip ok', r.status === 200)
r = await post({ project: 'x' }, env, '3.3.3.3'); ok('other ip ok 2', r.status === 200)
r = await post({ project: 'x' }, env, '4.4.4.4'); j = await r.json(); ok('global limit → 429', r.status === 429 && j.error === 'rate_limited_global')
// 坏输出 → 自动重试一次 → 502
kvStore.clear(); calls = 0
upstream = () => ({ status: 200, body: { choices: [{ message: { content: '不是 JSON' } }] } })
r = await post({ project: 'x' }); j = await r.json(); ok('bad output → 502 after retry', r.status === 502 && j.error === 'bad_output' && calls === 2, calls)
upstream = () => ({ status: 401, body: {} }); r = await post({ project: 'x' }); ok('bad key → 500 bad_key', (await r.json()).error === 'bad_key')
r = await post({ project: 'x' }, { ...env, INCEPTION_API_KEY: '' }); ok('missing_key', (await r.json()).error === 'missing_key')
r = await worker.fetch(new Request('https://x/plan', { method: 'POST', headers: { origin: 'https://evil.com' }, body: '{}' }), env); ok('bad origin 403', r.status === 403)
r = await worker.fetch(new Request('https://x/plan', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env); ok('preflight 204', r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGIN)
console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0)
