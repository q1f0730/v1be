// AI 学习路线规划：使用用户在浏览器里自配的 OpenAI 兼容接口（localStorage aig:ai）+ 本地项目存储（localStorage aig:projects）
// 项目结构：{ id, createdAt, updatedAt, name, input:{project, level, hours}, route:{name, goal, stages[]}, tasks:[bool], doneAt:{stageIdx: ts} }
//   - 概念是否学会不另存，直接读 aig:done（在概念页点「我学会了」项目进度会自动同步）
//   - tasks[i] = 第 i 个阶段的动手任务是否完成
import { useSyncExternalStore } from 'react'
import { lsGet, lsSet } from './store'
import { ROUTE_SCHEMA, parseInput, buildMessages, validateRoute } from './planner-core'

export const MAX_PROJECT = 500
export const MAX_ADJUST = 200
const TIMEOUT_MS = 60000

export const AI_PRESETS = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', requiresKey: true },
  { id: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct', requiresKey: true },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', requiresKey: true },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', requiresKey: true },
  { id: 'kimi', label: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', requiresKey: true },
  { id: 'glm', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', requiresKey: true },
  { id: 'mercury', label: 'Inception Mercury', baseUrl: 'https://api.inceptionlabs.ai/v1', model: 'mercury-3', requiresKey: true },
  { id: 'ollama', label: '本地 Ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', requiresKey: false },
]

const DEFAULT_AI = {
  baseUrl: AI_PRESETS[0].baseUrl,
  apiKey: '',
  model: AI_PRESETS[0].model,
}

// ---------------- AI 配置存储（只存在浏览器 localStorage aig:ai） ----------------
const aiSubs = new Set()
let aiCache = null
const readAi = () => {
  const v = lsGet('ai', null)
  if (!v || typeof v !== 'object') return { ...DEFAULT_AI }
  return {
    baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : DEFAULT_AI.baseUrl,
    apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
    model: typeof v.model === 'string' ? v.model : DEFAULT_AI.model,
  }
}
export const getAiConfig = () => (aiCache ??= readAi())
const emitAi = () => aiSubs.forEach(f => f())
export function saveAiConfig(next) {
  const cur = getAiConfig()
  const merged = {
    baseUrl: String(next.baseUrl ?? cur.baseUrl).trim(),
    apiKey: String(next.apiKey ?? cur.apiKey).trim(),
    model: String(next.model ?? cur.model).trim(),
  }
  aiCache = merged
  lsSet('ai', merged)
  emitAi()
  return merged
}
export function useAiConfig() {
  return useSyncExternalStore(f => { aiSubs.add(f); return () => aiSubs.delete(f) }, getAiConfig)
}
export function isLocalEndpoint(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(url || '').trim())
}
export function isAiConfigured(cfg = getAiConfig()) {
  if (!cfg?.baseUrl?.trim() || !cfg?.model?.trim()) return false
  if (!isLocalEndpoint(cfg.baseUrl) && !cfg?.apiKey?.trim()) return false
  return true
}
if (typeof window !== 'undefined') {
  addEventListener('storage', e => {
    if (e.key === 'aig:ai') { aiCache = null; emitAi() }
  })
}

export const LEVEL_OPTS = [
  { id: 'none', label: '完全不会', emoji: '🐣' },
  { id: 'some', label: '会一点', emoji: '🌱' },
  { id: 'built', label: '做过东西', emoji: '🛠️' },
]
export const HOURS_OPTS = [2, 5, 10, 20]
export const EXAMPLES = ['做一个能记账的微信小程序', '个人作品集网站，放作品和联系方式', '用 AI 自动整理 Excel 销售表的小工具', '给我家猫做一个成长记录网页']

export class PlanError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status }
}
const MSG = {
  missing_key: '请先点击「配置 AI」填写你自己的 API 地址、密钥和模型。',
  bad_key: 'API 密钥无效或没有权限（401/403），请检查「配置 AI」里的密钥和模型名。',
  rate_limited: 'AI 接口触发了频率或额度限制（429），请稍后再试或检查账户余额。',
  timeout: 'AI 想得太久了，再试一次。把描述写短一点或换个更快的模型会更快。',
  network: '连不上你配置的 AI 接口。请检查 API 地址是否正确、网络是否畅通，或接口是否允许浏览器跨域（CORS）。',
  bad_output: 'AI 这次返回的路线格式不完整，再试一次或换个模型试试。',
  upstream_busy: 'AI 服务现在有点忙，过一会儿再试。',
}
export const errorText = e => (e instanceof PlanError ? (MSG[e.code] || e.message) : '') || '出了点问题，再试一次。'
export const canRetry = e => !(e instanceof PlanError) || !['missing_key', 'bad_key'].includes(e.code)
export const needsAiSetup = e => e instanceof PlanError && ['missing_key', 'bad_key'].includes(e.code)

function resolveEndpoint(baseUrl) {
  const u = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (u.endsWith('/chat/completions')) return u
  return u + '/chat/completions'
}

// 请求一条路线。body: { project, level?, hours?, current_route?, adjust? }
export async function requestPlan(body, { signal } = {}) {
  const cfg = getAiConfig()
  if (!isAiConfigured(cfg)) {
    throw new PlanError('missing_key', MSG.missing_key, 400)
  }
  const p = parseInput(body)
  if (!p.ok) {
    throw new PlanError(p.error, p.message, 400)
  }

  const endpoint = resolveEndpoint(cfg.baseUrl)
  const model = cfg.model.trim()
  const isMercury = /mercury/i.test(model) || /inceptionlabs\.ai/i.test(endpoint)
  const messages = buildMessages(p.input)

  const ctl = new AbortController()
  const onAbort = () => ctl.abort('user')
  signal?.addEventListener('abort', onAbort)
  const t = setTimeout(() => ctl.abort('timeout'), TIMEOUT_MS)

  const headers = { 'content-type': 'application/json' }
  if (cfg.apiKey?.trim()) headers.authorization = `Bearer ${cfg.apiKey.trim()}`

  const makePayload = useFormat => {
    if (isMercury && useFormat) {
      return {
        model,
        messages,
        reasoning_effort: 'low',
        max_completion_tokens: 8000,
        temperature: 0.6,
        response_format: { type: 'json_schema', json_schema: { name: 'learning_route', strict: true, schema: ROUTE_SCHEMA } },
      }
    }
    return {
      model,
      messages,
      temperature: 0.6,
      ...(useFormat ? { response_format: { type: 'json_object' } } : {}),
    }
  }

  let res
  try {
    res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(makePayload(true)), signal: ctl.signal })
    if (res.status === 400) {
      // 部分兼容接口不支持 response_format，自动退回普通请求重试一次
      res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(makePayload(false)), signal: ctl.signal })
    }
  } catch {
    clearTimeout(t); signal?.removeEventListener('abort', onAbort)
    if (ctl.signal.aborted && ctl.signal.reason === 'user') throw new PlanError('aborted', '已取消')
    if (ctl.signal.aborted) throw new PlanError('timeout', MSG.timeout)
    throw new PlanError('network', MSG.network)
  }
  clearTimeout(t); signal?.removeEventListener('abort', onAbort)

  let data = null
  try { data = await res.json() } catch { /* 非 JSON */ }
  if (res.status === 401 || res.status === 403) {
    throw new PlanError('bad_key', MSG.bad_key, res.status)
  }
  if (res.status === 429) {
    throw new PlanError('rate_limited', MSG.rate_limited, 429)
  }
  if (res.status === 504) {
    throw new PlanError('timeout', MSG.timeout, 504)
  }
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || `AI 接口返回错误（HTTP ${res.status}），请检查模型名和接口地址。`
    throw new PlanError('http_' + res.status, errMsg, res.status)
  }

  // 兼容直接返回 { route } 的自定义后端，以及标准 OpenAI { choices: [{ message: { content } }] }
  if (data?.route) {
    const v = validateRoute(data.route)
    if (!v.ok) throw new PlanError('bad_output', MSG.bad_output, 502)
    return { route: v.route, dropped: v.dropped, remaining: data.remaining ?? null, model }
  }
  const content = data?.choices?.[0]?.message?.content ?? ''
  const v = validateRoute(content)
  if (!v.ok) {
    throw new PlanError('bad_output', MSG.bad_output, 502)
  }
  return { route: v.route, dropped: v.dropped, remaining: null, model }
}

// ---------------- 项目存储 ----------------
const subs = new Set()
let cache = null
const read = () => { const v = lsGet('projects', []); return Array.isArray(v) ? v.filter(p => p && p.id && p.route?.stages) : [] }
const get = () => (cache ??= read())
const emit = () => subs.forEach(f => f())
function write(next) { cache = next; lsSet('projects', next); emit() }
if (typeof window !== 'undefined') addEventListener('storage', e => { if (e.key === 'aig:projects') { cache = null; emit() } })

export function useProjects() {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, get)
}
export const getProject = id => get().find(p => p.id === id) || null

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export function createProject(route, input) {
  const now = Date.now()
  const p = { id: newId(), createdAt: now, updatedAt: now, name: route.name || '我的项目', input, route, tasks: route.stages.map(() => false), doneAt: {} }
  write([p, ...get()])
  return p
}
export function updateProject(id, patch) {
  write(get().map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: Date.now() } : p))
}
export function deleteProject(id) { write(get().filter(p => p.id !== id)) }
export function toggleTask(id, i) {
  updateProject(id, p => {
    const tasks = p.route.stages.map((_, k) => !!p.tasks?.[k]); tasks[i] = !tasks[i]
    const doneAt = { ...(p.doneAt || {}) }; if (tasks[i]) doneAt[i] = Date.now(); else delete doneAt[i]
    return { tasks, doneAt }
  })
}
// 用新路线覆盖：概念状态本来就读 aig:done；任务勾选按阶段标题对得上的保留
export function replaceRoute(id, route) {
  updateProject(id, p => {
    const old = new Map(p.route.stages.map((s, i) => [s.title, !!p.tasks?.[i]]))
    return { route, name: p.nameEdited ? p.name : (route.name || p.name), tasks: route.stages.map(s => old.get(s.title) || false), doneAt: {} }
  })
}

// ---------------- 进度 ----------------
export function stageState(p, i, done) {
  const s = p.route.stages[i]
  const learned = s.concepts.filter(c => done.has(c)).length
  const task = !!p.tasks?.[i]
  return { learned, total: s.concepts.length, task, complete: task && learned === s.concepts.length }
}
export function progress(p, done) {
  let n = 0, d = 0
  p.route.stages.forEach((s, i) => { n += s.concepts.length + 1; d += s.concepts.filter(c => done.has(c)).length + (p.tasks?.[i] ? 1 : 0) })
  const stagesDone = p.route.stages.filter((_, i) => stageState(p, i, done).complete).length
  return { pct: n ? Math.round(d / n * 100) : 0, d, n, stagesDone, stages: p.route.stages.length }
}
// 第一个没学会的概念（按路线顺序）
export function nextConcept(p, done) {
  for (const s of p.route.stages) for (const c of s.concepts) if (!done.has(c)) return c
  return null
}
// 当前应该做的阶段：第一个没完成的
export function currentStage(p, done) {
  const i = p.route.stages.findIndex((_, k) => !stageState(p, k, done).complete)
  return i < 0 ? p.route.stages.length - 1 : i
}

// ---------------- 导出 Markdown ----------------
export function toMarkdown(p, idx, done) {
  const L = []
  const pr = progress(p, done)
  const site = typeof location !== 'undefined' ? location.href.split('#')[0] : ''
  L.push(`# ${p.name}`, '', `> ${p.route.goal}`, '')
  L.push(`- 我的想法：${p.input?.project || ''}`)
  if (p.input?.level) L.push(`- 现在水平：${LEVEL_OPTS.find(o => o.id === p.input.level)?.label || ''}`)
  if (p.input?.hours) L.push(`- 每周时间：${p.input.hours} 小时`)
  L.push(`- 进度：${pr.pct}%（${pr.stagesDone}/${pr.stages} 个阶段完成）`, `- 创建于：${new Date(p.createdAt).toLocaleString('zh-CN')}`, '')
  p.route.stages.forEach((s, i) => {
    const st = stageState(p, i, done)
    L.push(`## ${st.complete ? '✅' : '⬜'} 阶段 ${i + 1}：${s.title}`, '')
    if (s.goal) L.push(`**目标**：${s.goal}`, '')
    L.push('**要学的概念**：', '')
    s.concepts.forEach(c => {
      const x = idx?.bySlug?.[c]
      L.push(`- [${done.has(c) ? 'x' : ' '}] ${x ? `${x.emoji} ${x.zh}（${x.level}）` : c}${site ? ` — ${site}#/c/${c}` : ''}`)
    })
    L.push('', `**动手任务**：`, '', `- [${st.task ? 'x' : ' '}] ${s.task}`, '')
    L.push('**复制给 AI 的指令**：', '', '```text', s.prompt, '```', '')
    if (s.done_when) L.push(`**完成标准**：${s.done_when}`, '')
  })
  L.push('---', '由「AI 造物指南 · AI 帮我规划」生成。')
  return L.join('\n')
}
export function downloadText(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) + '.md'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
