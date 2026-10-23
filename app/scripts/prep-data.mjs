// 把 ../guide/data 里的内容拆成：
//   public/data/index.json      —— 500 个概念的轻量索引（搜索 / 列表 / 词汇表用）
//   public/data/c/<slug>.json   —— 单个概念的完整内容（小白版 + 专业版），概念页按需加载
// 编号规则与 guide/src/build.py 一致：按级别排序，再按原 no 排序，然后重新编号 1..N
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
// 仓库布局：app/ 与 data/ 同级；本地开发布局：guide-rw/ 与 guide/data 同级
const SRC = process.env.GUIDE_DATA
  ? path.resolve(ROOT, process.env.GUIDE_DATA)
  : [path.resolve(ROOT, '../data'), path.resolve(ROOT, '../guide/data')].find(p => fs.existsSync(path.join(p, 'out'))) || path.resolve(ROOT, '../guide/data')
const OUT = path.join(ROOT, 'public', 'data')

// 与 build.py 的 LEVELS / CATS 保持一致
const LEVELS = [
  { name: '初级', cls: 'l1', emoji: '🌱', tag: '小白起步', desc: '先认识电脑、网页和 AI 的基本词。看完就能和 AI 正常聊需求。' },
  { name: '中级', cls: 'l2', emoji: '🌊', tag: '能做出东西', desc: '部署、数据库、测试、Agent 工具。看完能让 AI 帮你做出能用的小产品。' },
  { name: '高级', cls: 'l3', emoji: '🔮', tag: '做得稳、做得安全', desc: '安全、缓存、高可用、可观测。看完能看懂 AI 改的代码靠不靠谱。' },
  { name: '进阶', cls: 'l4', emoji: '🔥', tag: '系统指挥官', desc: '分布式、共识、大规模交付、Agent 工程。看完能指挥多个 AI 搭大系统。' },
]
const CATS = {
  ai: ['🤖', 'AI 与提示词'], base: ['💻', '电脑与网页地基'], git: ['🌿', 'Git 协作'],
  ship: ['🚀', '上线与测试'], sec: ['🛡️', '安全防线'], db: ['🗄️', '数据库'],
  net: ['🌐', '网络与 API'], cache: ['⚡', '缓存与队列'], dist: ['🕸️', '分布式'],
  sre: ['🩺', '高可用 SRE'], devops: ['🔭', '可观测与交付'],
}
const CAT_ORDER = Object.keys(CATS)
const nc = path.join(SRC, 'new_cats.json')
if (fs.existsSync(nc)) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(nc, 'utf8')))) {
    if (!CATS[k]) { CATS[k] = [v.emoji, v.name]; CAT_ORDER.push(k) }
  }
}

const readBatches = dir => fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .flatMap(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch (e) { console.warn('skip', f, e.message); return [] } })

const cs = readBatches(path.join(SRC, 'out'))
const rank = Object.fromEntries(LEVELS.map((l, i) => [l.name, i]))
cs.sort((a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9) || a.no - b.no)
cs.forEach((c, i) => { c.no = i + 1 })
const bySlug = Object.fromEntries(cs.map(c => [c.slug, c]))

const pro = {}
for (const x of readBatches(path.join(SRC, 'pro'))) if (x && bySlug[x.slug] && x.def) pro[x.slug] = x

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'c'), { recursive: true })

const stripOops = s => String(s || '').replace(/^\s*💥\s*(翻车现场[:：]\s*)?/u, '')
const index = cs.map(c => ({
  slug: c.slug, no: c.no, zh: c.zh, en: c.en, emoji: c.emoji, level: c.level, cat: c.cat,
  oneLiner: c.oneLiner, words: c.words || [], pro: !!pro[c.slug],
}))
const meta = {
  total: cs.length,
  levels: LEVELS.map(l => ({ ...l, count: cs.filter(c => c.level === l.name).length })),
  cats: Object.fromEntries(CAT_ORDER.map(k => [k, { emoji: CATS[k][0], name: CATS[k][1] }])),
  catOrder: CAT_ORDER,
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ meta, items: index }))

for (const c of cs) {
  const p = pro[c.slug]
  const doc = {
    slug: c.slug, no: c.no, zh: c.zh, en: c.en, emoji: c.emoji, level: c.level, cat: c.cat,
    oneLiner: c.oneLiner, analogy: c.analogy, points: c.points || [], anim: c.anim || { type: 'flow' },
    table: c.table || { title: '', head: [], rows: [] }, steps: c.steps || [], oops: stripOops(c.oops),
    prompt: c.prompt || '', quiz: c.quiz, words: c.words || [], related: (c.related || []).filter(r => bySlug[r]),
    pro: p ? {
      def: p.def, how: p.how || [], terms: p.terms || [], code: p.code || null, table: p.table || null,
      tradeoffs: p.tradeoffs || [], pitfalls: p.pitfalls || [], checklist: p.checklist || [],
      interview: p.interview || [], refs: p.refs || [],
    } : null,
  }
  fs.writeFileSync(path.join(OUT, 'c', c.slug + '.json'), JSON.stringify(doc))
}
const lv = meta.levels.map(l => `${l.name} ${l.count}`).join(' / ')
console.log(`prep-data: ${cs.length} 个概念（${lv}），${Object.keys(pro).length} 个专业版 -> public/data`)
