// 本地验证提示词与解析：用和 worker 完全相同的系统提示 / schema / 校验，直连 Inception API 跑真实例子。
// 用法：node worker/scripts/try-mercury.mjs [low|medium] [--save]
// （沙箱网络会自动给 api.inceptionlabs.ai 注入认证；在别处运行需自己设 INCEPTION_API_KEY）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requestBody, validateRoute } from '../planner-core.js'
import { LEVEL_OF } from '../catalog.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const effort = process.argv[2] || 'low'
const save = process.argv.includes('--save')
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)
const CASES = [
  { id: 'bookkeeping', input: { project: '做一个能记账的微信小程序，能记每天花了多少钱，按月看统计图', level: 'none', hours: 5 } },
  { id: 'portfolio', input: { project: '做一个个人作品集网站，放我的设计作品和联系方式，想让别人能通过网址访问', level: 'some', hours: 8 } },
  { id: 'excel', input: { project: '用 AI 自动整理 Excel 的工具：把乱七八糟的销售表格自动清洗、分类、汇总成报表', level: 'none', hours: 3 } },
]
for (const c of CASES) {
  if (only && c.id !== only) continue
  const body = requestBody({ ...c.input, adjust: '', current: null }, { effort })
  const t0 = Date.now()
  const res = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.INCEPTION_API_KEY ? { authorization: 'Bearer ' + process.env.INCEPTION_API_KEY } : {}) },
    body: JSON.stringify(body),
  })
  const ms = Date.now() - t0
  const j = await res.json().catch(() => null)
  if (!res.ok) { console.log(c.id, 'HTTP', res.status, JSON.stringify(j).slice(0, 400)); continue }
  const content = j.choices?.[0]?.message?.content
  let rawObj = null; try { rawObj = JSON.parse(content) } catch {}
  const rawSlugs = rawObj?.stages?.flatMap(s => s.concepts) || []
  const invalid = rawSlugs.filter(s => !LEVEL_OF[s])
  const v = validateRoute(content)
  console.log(`\n=== ${c.id} effort=${effort} ${ms}ms usage=${JSON.stringify(j.usage)} finish=${j.choices?.[0]?.finish_reason}`)
  console.log(`raw slugs ${rawSlugs.length}, invalid ${invalid.length} ${invalid.join(',')}  valid=${v.ok} ${v.error || ''}`)
  if (v.ok) {
    const r = v.route
    console.log(`《${r.name}》${r.goal}`)
    r.stages.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} | ${s.concepts.map(x => x + '(L' + LEVEL_OF[x] + ')').join(' ')}\n     任务:${s.task}\n     标准:${s.done_when}\n     指令(${s.prompt.length}字):${s.prompt.slice(0, 120)}…`))
    if (save) fs.writeFileSync(path.resolve(here, `../../e2e/fixtures/plan-${c.id}.json`), JSON.stringify({ route: r, dropped: v.dropped, meta: { model: 'mercury-3', effort, ms, usage: j.usage, input: c.input, at: new Date().toISOString() } }, null, 2))
  } else console.log(content?.slice(0, 600))
}
