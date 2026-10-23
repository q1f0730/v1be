// AI 学习路线规划：调用 worker（POST /plan）+ 本地项目存储（localStorage aig:projects）
// 项目结构：{ id, createdAt, updatedAt, name, input:{project, level, hours}, route:{name, goal, stages[]}, tasks:[bool], doneAt:{stageIdx: ts} }
//   - 概念是否学会不另存，直接读 aig:done（在概念页点「我学会了」项目进度会自动同步）
//   - tasks[i] = 第 i 个阶段的动手任务是否完成
import { useSyncExternalStore } from 'react'
import { lsGet, lsSet } from './store'

export const PLANNER_URL = (import.meta.env.VITE_PLANNER_URL || 'https://aig-planner.q1f0730.workers.dev').replace(/\/+$/, '')
export const MAX_PROJECT = 500
export const MAX_ADJUST = 200
const TIMEOUT_MS = 45000

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
  missing_key: '站长还没配置好 AI 密钥，规划功能暂时用不了，晚点再来看看。',
  bad_key: 'AI 服务的密钥出了问题，站长正在处理，晚点再试。',
  rate_limited: '你今天的生成次数用完了，明天再来吧（每天 0 点重置）。',
  rate_limited_global: '今天全站的 AI 规划次数用完了，明天再来吧（每天 0 点重置）。',
  timeout: 'AI 想得太久了，再试一次。把描述写短一点会更快。',
  network: '网络好像断了，连不上 AI 服务。检查一下网络再试。',
  bad_output: 'AI 这次给的路线不完整，再试一次就好。',
  upstream_busy: 'AI 服务现在有点忙，过一会儿再试。',
  forbidden_origin: '这个网址不能调用规划服务。',
}
export const errorText = e => (e instanceof PlanError ? (MSG[e.code] || e.message) : '') || '出了点问题，再试一次。'
export const canRetry = e => !(e instanceof PlanError) || !['missing_key', 'bad_key', 'rate_limited', 'rate_limited_global', 'forbidden_origin'].includes(e.code)

// 请求一条路线。body: { project, level?, hours?, current_route?, adjust? }
export async function requestPlan(body, { signal } = {}) {
  const ctl = new AbortController()
  const onAbort = () => ctl.abort('user')
  signal?.addEventListener('abort', onAbort)
  const t = setTimeout(() => ctl.abort('timeout'), TIMEOUT_MS)
  let res
  try {
    res = await fetch(PLANNER_URL + '/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
  } catch (e) {
    if (ctl.signal.aborted && ctl.signal.reason === 'user') throw new PlanError('aborted', '已取消')
    if (ctl.signal.aborted) throw new PlanError('timeout', MSG.timeout)
    throw new PlanError('network', MSG.network)
  } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort) }
  let data = null
  try { data = await res.json() } catch { /* 非 JSON（网关错误页等） */ }
  if (!res.ok || !data?.route) {
    const code = data?.error || (res.status === 429 ? 'rate_limited' : res.status === 504 ? 'timeout' : 'http_' + res.status)
    throw new PlanError(code, data?.message || MSG[code] || `服务出错了（${res.status}），再试一次。`, res.status)
  }
  return data
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
  L.push('---', '由「AI 造物指南 · AI 帮我规划」生成（模型：Mercury 3）。')
  return L.join('\n')
}
export function downloadText(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) + '.md'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
