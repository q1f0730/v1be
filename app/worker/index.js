// Cloudflare Worker「aig-planner」：AI 学习路线规划
//   GET  /health → { ok, model, has_key }
//   POST /plan   → body { project, level?, hours?, current_route?, adjust? } → { route, dropped, remaining, ms }
// 环境：INCEPTION_API_KEY（secret，站长在控制台设置）、LIMITS（KV，计数用，可选）、
//       IP_DAILY / GLOBAL_DAILY（plain text 变量，可选，默认 10 / 300）
import { MODEL, parseInput, requestBody, validateRoute } from './planner-core.js'

const ALLOWED = new Set([
  'https://3001-agqvpgn2bxim4ppevc5ae3igky.instabox.tech',
  'https://3000-agqvpgn2bxim4ppevc5ae3igky.instabox.tech',
])
const isLocal = o => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)
const allowed = o => !!o && (ALLOWED.has(o) || isLocal(o))

const UPSTREAM = 'https://api.inceptionlabs.ai/v1/chat/completions'
const TIMEOUT_MS = 25000

function cors(origin) {
  const h = { 'vary': 'Origin' }
  if (allowed(origin)) {
    h['access-control-allow-origin'] = origin
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS'
    h['access-control-allow-headers'] = 'content-type'
    h['access-control-max-age'] = '86400'
  }
  return h
}
const json = (data, status, origin, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(origin), ...extra },
})
const fail = (status, error, message, origin, extra) => json({ error, message }, status, origin, extra)

// 北京时间的日期，作为每日计数的 key（每天 0 点重置）
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)

async function checkQuota(env, ip) {
  if (!env.LIMITS) return { ok: true, remaining: null, commit: async () => {} }
  const ipMax = +env.IP_DAILY || 10, allMax = +env.GLOBAL_DAILY || 300
  const d = today(), kIp = `ip:${d}:${ip}`, kAll = `all:${d}`
  const [nIp, nAll] = await Promise.all([env.LIMITS.get(kIp), env.LIMITS.get(kAll)]).then(a => a.map(v => +v || 0))
  if (nAll >= allMax) return { ok: false, error: 'rate_limited_global', message: '今天全站的 AI 规划次数用完了，明天再来吧（每天 0 点重置）。' }
  if (nIp >= ipMax) return { ok: false, error: 'rate_limited', message: `你今天已经生成 ${ipMax} 次了，明天再来吧（每天 0 点重置）。` }
  return {
    ok: true, remaining: ipMax - nIp - 1,
    // KV 不是强一致的，并发时可能多放过几次；对于每日几百次的量足够用
    commit: () => Promise.all([
      env.LIMITS.put(kIp, String(nIp + 1), { expirationTtl: 172800 }),
      env.LIMITS.put(kAll, String(nAll + 1), { expirationTtl: 172800 }),
    ]),
  }
}

async function callModel(env, input, deadline) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), Math.max(1000, deadline - Date.now()))
  try {
    const r = await fetch(UPSTREAM, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.INCEPTION_API_KEY}` },
      body: JSON.stringify(requestBody(input, { effort: env.REASONING_EFFORT || 'low' })),
    })
    if (r.status === 401 || r.status === 403) return { fatal: true, status: 500, error: 'bad_key', message: 'AI 服务的密钥无效，请联系站长。' }
    if (r.status === 429) return { fatal: true, status: 503, error: 'upstream_busy', message: 'AI 服务现在太忙了，过一会儿再试。' }
    if (!r.ok) return { status: 502, error: 'upstream_error', message: 'AI 服务暂时出错了，再试一次。' }
    const j = await r.json()
    const v = validateRoute(j.choices?.[0]?.message?.content ?? '')
    if (!v.ok) return { status: 502, error: 'bad_output', message: 'AI 这次给的路线不完整，再试一次。' }
    return { ok: true, route: v.route, dropped: v.dropped }
  } catch (e) {
    if (e.name === 'AbortError') return { fatal: true, status: 504, error: 'timeout', message: 'AI 想得太久了，再试一次（可以把描述写短一点）。' }
    return { status: 502, error: 'upstream_error', message: '连不上 AI 服务，再试一次。' }
  } finally { clearTimeout(t) }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const origin = req.headers.get('origin') || ''

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: allowed(origin) ? 204 : 403, headers: cors(origin) })
    }
    if (url.pathname === '/health' && req.method === 'GET') {
      return json({ ok: true, model: MODEL, has_key: !!env.INCEPTION_API_KEY, kv: !!env.LIMITS }, 200, origin)
    }
    if (url.pathname !== '/plan') return fail(404, 'not_found', '没有这个接口。', origin)
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', '请用 POST。', origin, { allow: 'POST, OPTIONS' })
    if (!allowed(origin)) return fail(403, 'forbidden_origin', '这个网站不能调用规划接口。', origin)
    if (!env.INCEPTION_API_KEY) return fail(500, 'missing_key', '站长还没配置 AI 密钥，规划功能暂时用不了。', origin)

    if (+(req.headers.get('content-length') || 0) > 32768) return fail(413, 'too_large', '请求太大了。', origin)
    let body
    try { body = await req.json() } catch { return fail(400, 'bad_request', '请求格式不对。', origin) }
    const p = parseInput(body)
    if (!p.ok) return fail(400, p.error, p.message, origin)

    const ip = req.headers.get('cf-connecting-ip') || 'unknown'
    const q = await checkQuota(env, ip)
    if (!q.ok) return fail(429, q.error, q.message, origin, { 'retry-after': '3600' })
    await q.commit()

    const t0 = Date.now(), deadline = t0 + TIMEOUT_MS
    let res = await callModel(env, p.input, deadline)
    // 输出不完整/上游偶发错误：时间还够就自动重试一次（不额外计次）
    if (!res.ok && !res.fatal && deadline - Date.now() > 12000) res = await callModel(env, p.input, deadline)
    if (!res.ok) return fail(res.status, res.error, res.message, origin)
    return json({ route: res.route, dropped: res.dropped, remaining: q.remaining, ms: Date.now() - t0 }, 200, origin)
  },
}
