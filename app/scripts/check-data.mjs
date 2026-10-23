// 校验 500 个概念全部能加载且字段完整：node scripts/check-data.mjs [base_url]
// 不传 base_url 时读本地 public/data；传了就逐个 fetch 线上 /data/c/<slug>.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2]
const get = async rel => base
  ? (await fetch(new URL('data/' + rel, base.endsWith('/') ? base : base + '/'))).json()
  : JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', rel), 'utf8'))

const ANIM = new Set(['flow', 'guard', 'queue', 'layers', 'split', 'merge', 'copy', 'loop', 'lock', 'filter', 'timer', 'chat', 'balance', 'toggle', 'grow'])
const idx = await get('index.json')
const problems = []
const need = (c, cond, msg) => { if (!cond) problems.push(`${c.slug}: ${msg}`) }
let pro = 0
const queue = [...idx.items]
async function worker() {
  while (queue.length) {
    const x = queue.shift()
    let c
    try { c = await get('c/' + x.slug + '.json') } catch (e) { problems.push(`${x.slug}: 加载失败 ${e.message}`); continue }
    need(c, c.slug === x.slug && c.no === x.no, '编号 / slug 与索引不一致')
    for (const k of ['zh', 'en', 'emoji', 'oneLiner', 'analogy', 'oops', 'prompt']) need(c, typeof c[k] === 'string' && c[k].length, '缺 ' + k)
    need(c, Array.isArray(c.points) && c.points.length, '缺 points')
    need(c, Array.isArray(c.steps) && c.steps.length, '缺 steps')
    need(c, c.table && c.table.head?.length && c.table.rows?.length, '缺 table')
    need(c, ANIM.has(c.anim?.type), '动画类型未知 ' + c.anim?.type)
    need(c, c.quiz && c.quiz.options?.length === 3 && [0, 1, 2].includes(+c.quiz.answer), 'quiz 不完整')
    need(c, (c.related || []).every(r => idx.items.some(y => y.slug === r)), 'related 指向不存在的概念')
    if (c.pro) {
      pro++
      const p = c.pro
      need(c, p.def && p.how?.length && p.terms?.length, '专业版缺 def/how/terms')
      need(c, p.code?.src, '专业版缺 code')
      need(c, p.table?.head?.length, '专业版缺 table')
      need(c, p.tradeoffs?.length && p.pitfalls?.length && p.checklist?.length && p.interview?.length && p.refs?.length, '专业版缺 trade/pit/check/int/refs')
      need(c, (p.refs || []).every(r => /^https?:\/\//.test(r.url)), 'refs URL 不合法')
    }
  }
}
await Promise.all(Array.from({ length: 16 }, worker))
const nos = idx.items.map(x => x.no)
if (nos.some((n, i) => n !== i + 1)) problems.push('index 编号不是 1..N 连续')
console.log(`检查 ${idx.items.length} 个概念（${base || '本地 public/data'}），专业版 ${pro} 个`)
console.log(problems.length ? `❌ ${problems.length} 个问题：\n` + problems.slice(0, 50).join('\n') : '✅ 全部通过')
process.exit(problems.length ? 1 : 0)
