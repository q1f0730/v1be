// 学习路线规划：系统提示、JSON Schema、输入与输出校验（纯前端直连用户自配的 OpenAI 兼容接口）
import { CATALOG_TEXT, CATS_TEXT, LEVEL_OF } from './catalog.js'

export const LIMITS = {
  project: 500, adjust: 200,
  name: 30, goal: 100, title: 24, stageGoal: 120, task: 300, prompt: 900, doneWhen: 160,
  minStages: 3, maxStages: 7, minConcepts: 2, maxConcepts: 6,
}
export const LEVELS = { none: '完全不会写代码', some: '会一点（看得懂一点代码，或用 AI 做过小玩意）', built: '自己做过能用的东西' }

export const SYSTEM_PROMPT = `你是「AI 造物指南」网站的学习路线规划师。网站读者大多完全不会写代码，靠 AI 编程工具（Cursor、Claude Code、Trae 等）把想法做出来。
访客会描述一个想做的项目。你要把它拆成 3–7 个循序渐进的阶段（里程碑），每个阶段先学几个站内概念，再动手做一步，最后得到能用的成品。

规则：
1. 每个阶段的 concepts 只能从下面的「站内概念目录」里选 slug，原样照抄（小写英文和连字符），不许编造目录里没有的 slug。每阶段 2–6 个，按先学后学排好。
2. 整条路线从易到难：前面的阶段优先选级别 1、2 的概念，级别 3、4 只在项目真的需要时放在后面。同一个概念不要在多个阶段重复出现。
3. 只选和这个项目真正相关的概念。比如做小程序不需要分布式共识；做网页一般需要 前端/HTML/部署 这类基础。
4. 面向不会写代码的人：语言用简体中文，大白话，句子短，少用术语；必须用术语时加一句解释。
5. task 是这一阶段要亲手做的一件具体的事（例如「让 AI 生成首页，在浏览器里打开看看」），不要写成学习清单。
6. prompt 是一段可以直接复制粘贴给 AI 编程工具的开发指令：写清楚要做什么、用什么技术（选对新手最简单的方案）、做完怎么检查。用「请你…」的口吻，第一人称是访客。不要包含任何真实的密钥或账号。
7. done_when 是一句可以自己检查的完成标准（看得见、点得到的结果）。
8. 根据访客的水平和每周时间调整阶段数量和难度：完全不会的人阶段要更小、更具体；时间少就少几个阶段。
9. name 是给项目起的简短中文名（不超过 15 个字），goal 是一句话说清做完能得到什么。
10. 如果给了「当前路线」和「调整要求」，在当前路线基础上按要求修改并输出完整的新路线（没被要求改的部分尽量保留）。
11. 只输出一个合法的 JSON 对象，不要包含 Markdown 代码块，不要任何别的文字。JSON 结构必须严格如下：
{"name":"项目简短中文名","goal":"一句话目标","stages":[{"title":"阶段名","goal":"本阶段目标","concepts":["slug-1","slug-2"],"task":"动手任务","prompt":"可直接复制给 AI 编程工具的开发指令","done_when":"完成标准"}]}

级别：1=初级（小白起步） 2=中级（能做出东西） 3=高级（做得稳、做得安全） 4=进阶（系统指挥官）
分类：${CATS_TEXT}

站内概念目录（每行：slug|中文名|级别|分类）：
${CATALOG_TEXT}`

export const ROUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'goal', 'stages'],
  properties: {
    name: { type: 'string', description: '项目简短中文名' },
    goal: { type: 'string', description: '一句话目标' },
    stages: {
      type: 'array', minItems: 3, maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'goal', 'concepts', 'task', 'prompt', 'done_when'],
        properties: {
          title: { type: 'string', description: '阶段名，短' },
          goal: { type: 'string', description: '这一阶段的目标' },
          concepts: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string', description: '站内概念 slug' } },
          task: { type: 'string', description: '动手任务' },
          prompt: { type: 'string', description: '可直接复制给 AI 编程工具的开发指令' },
          done_when: { type: 'string', description: '完成标准' },
        },
      },
    },
  },
}

const clip = (s, n) => {
  s = String(s ?? '').split('\0').join('').trim()
  return [...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s
}
export const textLen = s => [...String(s ?? '')].length

// 清洗访客输入；返回 { ok, input | error }
export function parseInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_request', message: '请求格式不对。' }
  const project = String(body.project ?? '').trim()
  if (!project) return { ok: false, error: 'empty', message: '先写一下你想做什么项目吧。' }
  if (textLen(project) > LIMITS.project) return { ok: false, error: 'too_long', message: `项目描述最多 ${LIMITS.project} 个字。` }
  const level = LEVELS[body.level] ? body.level : null
  const hours = Number.isFinite(+body.hours) && +body.hours > 0 && +body.hours <= 80 ? Math.round(+body.hours) : null
  const adjust = body.adjust == null ? '' : String(body.adjust).trim()
  if (textLen(adjust) > LIMITS.adjust) return { ok: false, error: 'too_long', message: `调整要求最多 ${LIMITS.adjust} 个字。` }
  let current = null
  if (body.current_route != null) {
    const v = validateRoute(body.current_route)
    if (!v.ok) return { ok: false, error: 'bad_route', message: '当前路线格式不对，没法调整。' }
    current = v.route
  }
  if (adjust && !current) return { ok: false, error: 'bad_request', message: '调整路线需要带上当前路线。' }
  return { ok: true, input: { project, level, hours, adjust, current } }
}

export function buildMessages({ project, level, hours, adjust, current }) {
  const lines = [`我想做的项目：${project}`]
  lines.push(`我现在的水平：${level ? LEVELS[level] : '没说（按完全不会写代码来规划）'}`)
  lines.push(`每周能花的时间：${hours ? hours + ' 小时' : '没说'}`)
  if (current) {
    lines.push('', '当前路线（JSON）：', JSON.stringify(current))
    lines.push('', `调整要求：${adjust || '请整体优化一下这条路线'}`)
    lines.push('请输出调整后的完整路线（纯 JSON）。')
  } else {
    lines.push('', '请给我设计学习路线（纯 JSON）。')
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

// 把模型输出（字符串或对象）变成干净的路线；丢掉不存在/重复的 slug、截断超长字段。
// 返回 { ok, route, dropped:[slug] } 或 { ok:false, error }
export function validateRoute(raw) {
  let r = raw
  if (typeof r === 'string') {
    let s = r.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    try {
      r = JSON.parse(s)
    } catch {
      const i = s.indexOf('{'), j = s.lastIndexOf('}')
      if (i >= 0 && j > i) {
        try { r = JSON.parse(s.slice(i, j + 1)) } catch { return { ok: false, error: 'not_json' } }
      } else {
        return { ok: false, error: 'not_json' }
      }
    }
  }
  if (!r || typeof r !== 'object' || !Array.isArray(r.stages)) return { ok: false, error: 'bad_shape' }
  const seen = new Set(), dropped = []
  const stages = []
  for (const st of r.stages.slice(0, LIMITS.maxStages)) {
    if (!st || typeof st !== 'object') continue
    const concepts = []
    for (const c of Array.isArray(st.concepts) ? st.concepts : []) {
      const slug = String(c ?? '').trim().toLowerCase()
      if (!LEVEL_OF[slug]) { dropped.push(slug); continue }
      if (seen.has(slug)) continue
      seen.add(slug); concepts.push(slug)
      if (concepts.length >= LIMITS.maxConcepts) break
    }
    if (!concepts.length) continue // 一个有效概念都没有的阶段直接丢掉
    const title = clip(st.title, LIMITS.title), task = clip(st.task, LIMITS.task)
    if (!title || !task) continue
    stages.push({
      title, goal: clip(st.goal, LIMITS.stageGoal), concepts, task,
      prompt: clip(st.prompt, LIMITS.prompt), done_when: clip(st.done_when, LIMITS.doneWhen),
    })
  }
  if (stages.length < LIMITS.minStages) return { ok: false, error: 'too_few_stages', dropped }
  const name = clip(r.name, LIMITS.name) || '我的项目'
  return { ok: true, route: { name, goal: clip(r.goal, LIMITS.goal), stages }, dropped }
}
