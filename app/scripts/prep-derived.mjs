// 在 prep-data.mjs 之后运行，从 public/data 生成两份派生数据（都懒加载）：
//   public/data/graph.json   —— 知识图谱：节点（slug / 级别 / 分类 / 预计算坐标）+ 去重、双向、丢掉不存在 slug 的边
//   public/data/search.json  —— 全文索引：比喻、要点、步骤、翻车现场、专业定义/原理/术语/代码，以及标题/术语的拼音
// 标题、英文、一句话、词汇已在 index.json 里，这里不重复存。拼音在构建时用 pinyin-pro 算好，前端不打包拼音库。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(path.resolve(here, '..'), 'public', 'data')
const { meta, items } = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'))
const docs = items.map(x => JSON.parse(fs.readFileSync(path.join(OUT, 'c', x.slug + '.json'), 'utf8')))
const at = Object.fromEntries(items.map((x, i) => [x.slug, i]))
const lvIdx = Object.fromEntries(meta.levels.map((l, i) => [l.name, i]))

// ---------------- 图谱 ----------------
const seen = new Set(); const edges = []
let dropped = 0
docs.forEach((d, i) => {
  for (const r of d.related || []) {
    const j = at[r]
    if (j == null) { dropped++; continue }
    if (j === i) continue
    const key = i < j ? i + ',' + j : j + ',' + i
    if (seen.has(key)) continue
    seen.add(key); edges.push(i < j ? [i, j] : [j, i])
  }
})
// 预计算布局：力导向 + 按分类轻轻聚团（分类锚点排成一圈），前端拿来当初始坐标，不必从一团乱麻开始
const cats = meta.catOrder
const R = 900
const anchor = Object.fromEntries(cats.map((c, k) => {
  const a = (k / cats.length) * Math.PI * 2 - Math.PI / 2
  return [c, [Math.cos(a) * R, Math.sin(a) * R]]
}))
const nodes = items.map((x, i) => {
  const [ax, ay] = anchor[x.cat] || [0, 0]
  return { i, x: ax + Math.cos(i) * 60, y: ay + Math.sin(i) * 60, cat: x.cat }
})
const deg = new Array(items.length).fill(0)
edges.forEach(([a, b]) => { deg[a]++; deg[b]++ })
const sim = forceSimulation(nodes)
  .force('link', forceLink(edges.map(([s, t]) => ({ source: s, target: t }))).distance(60).strength(0.25))
  .force('charge', forceManyBody().strength(-90).distanceMax(700))
  .force('collide', forceCollide(d => 9 + Math.sqrt(deg[d.i]) * 1.6))
  .force('x', forceX(d => anchor[d.cat]?.[0] || 0).strength(0.07))
  .force('y', forceY(d => anchor[d.cat]?.[1] || 0).strength(0.07))
  .stop()
for (let k = 0; k < 500; k++) sim.tick()
const graph = {
  v: 1,
  // n: [级别下标, 分类键, x, y]，下标与 index.json 的 items 一一对应（slug 从 index.json 取）
  n: items.map((x, i) => [lvIdx[x.level] ?? 0, x.cat, Math.round(nodes[i].x), Math.round(nodes[i].y)]),
  s: items.map(x => x.slug), // 便于单独校验；名字仍从 index.json 取
  e: edges,
}
fs.writeFileSync(path.join(OUT, 'graph.json'), JSON.stringify(graph))
const iso = deg.filter(d => d === 0).length

// ---------------- 全文索引 ----------------
const HAN = /\p{Script=Han}/u
// 只取汉字的拼音，一字一个音节，用空格连接；没有汉字返回 ''
function py(s) {
  s = String(s || '')
  if (!HAN.test(s)) return ''
  const chars = [...s]
  const arr = pinyin(s, { toneType: 'none', type: 'array', v: true })
  const out = []
  // pinyin-pro 对每个字符（包括非汉字）都返回一项；对齐后只留汉字的
  if (arr.length === chars.length) chars.forEach((ch, k) => { if (HAN.test(ch)) out.push(arr[k].toLowerCase()) })
  else for (const ch of chars) if (HAN.test(ch)) out.push(pinyin(ch, { toneType: 'none', v: true }).toLowerCase())
  return out.join(' ')
}
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s }
const uniq = a => [...new Set(a.filter(Boolean))]
// 去掉要点/步骤开头的 emoji（不影响搜索，省体积）
const noEmo = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '')
// 代码：合并多余空白、删空行；注释只留前 12 个字（注释里的长解释很占体积，标识符全部保留）
function slimCode(src) {
  return String(src || '').split('\n').map(l => {
    const m = l.match(/(^|\s)(#|\/\/|--)\s?(.*)$/)
    if (m && m[3].length > 12) l = l.slice(0, m.index + m[0].length - m[3].length) + m[3].slice(0, 12)
    return l.replace(/[ \t]+/g, ' ').trimEnd()
  }).filter(l => l.trim()).join('\n').slice(0, 900)
}

const sdocs = docs.map((d, i) => {
  const p = d.pro
  const terms = p ? (p.terms || []).map(t => [cut(t.t, 60), cut(t.d, 60)]) : []
  const words = items[i].words || []
  const o = {
    py: py(items[i].zh),
    // 词汇 + 专业术语名的拼音（顺序：先 words 后 terms）
    wpy: [...words, ...terms.map(t => t[0])].map(py),
    ana: cut(d.analogy, 200),
    pts: uniq((d.points || []).map(noEmo)).map(x => cut(x, 80)),
    steps: uniq((d.steps || []).map(noEmo)).map(x => cut(x, 100)),
    oops: cut(d.oops, 200),
  }
  if (p) {
    o.def = cut(p.def, 180)
    o.how = uniq(p.how || []).slice(0, 6).map(x => cut(x, 90))
    o.terms = terms
    if (p.code?.src) o.code = [cut(p.code.title, 60), slimCode(p.code.src)]
  }
  if (!o.wpy.some(Boolean)) delete o.wpy
  return o
})
// 按位置存（省掉 500 遍重复的键名）：[py, wpy, ana, pts, steps, oops, def, how, terms, code]，缺的字段写 0
const FIELDS = ['py', 'wpy', 'ana', 'pts', 'steps', 'oops', 'def', 'how', 'terms', 'code']
fs.writeFileSync(path.join(OUT, 'search.json'), JSON.stringify({ v: 2, f: FIELDS, d: sdocs.map(o => FIELDS.map(k => o[k] ?? 0)) }))

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + 'KB'
console.log(`prep-derived: graph.json ${items.length} 节点 / ${edges.length} 条边（丢弃不存在 ${dropped}，孤立点 ${iso}）${kb('graph.json')}；search.json ${kb('search.json')}`)
