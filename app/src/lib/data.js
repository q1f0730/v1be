// 数据加载：index.json 一次性加载（约 140KB，gzip 后更小）；单个概念按需 fetch 并缓存
import { useEffect, useState } from 'react'

const BASE = './data/'
let indexPromise = null
let indexData = null
const conceptCache = new Map()

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(BASE + 'index.json').then(r => { if (!r.ok) throw new Error('index ' + r.status); return r.json() })
      .then(d => {
        const bySlug = {}
        d.items.forEach((x, i) => { x.i = i; bySlug[x.slug] = x })
        const levelBy = Object.fromEntries(d.meta.levels.map(l => [l.name, l]))
        const levelByCls = Object.fromEntries(d.meta.levels.map(l => [l.cls, l]))
        indexData = { ...d, bySlug, levelBy, levelByCls }
        return indexData
      })
      .catch(e => { indexPromise = null; throw e })
  }
  return indexPromise
}

export function useIndex() {
  const [state, setState] = useState(() => ({ data: indexData, error: null }))
  useEffect(() => {
    if (indexData) return
    let live = true
    loadIndex().then(d => live && setState({ data: d, error: null })).catch(e => live && setState({ data: null, error: e }))
    return () => { live = false }
  }, [])
  return state
}

export function loadConcept(slug) {
  if (!conceptCache.has(slug)) {
    const p = fetch(BASE + 'c/' + encodeURIComponent(slug) + '.json').then(r => { if (!r.ok) throw new Error('404'); return r.json() })
    p.catch(() => conceptCache.delete(slug))
    conceptCache.set(slug, p)
  }
  return conceptCache.get(slug)
}

export function useConcept(slug) {
  const [state, setState] = useState({ slug: null, data: null, error: null })
  useEffect(() => {
    let live = true
    loadConcept(slug).then(d => live && setState({ slug, data: d, error: null }))
      .catch(e => live && setState({ slug, data: null, error: e }))
    return () => { live = false }
  }, [slug])
  return state.slug === slug ? state : { slug, data: null, error: null }
}

// 预取相邻概念，翻页更快
export function prefetchConcept(slug) { if (slug) loadConcept(slug).catch(() => {}) }

// 搜索：与旧站 find() 相同的打分规则
export function search(items, k, max = 8) {
  k = k.trim().toLowerCase(); if (!k) return []
  const res = []
  for (const x of items) {
    const z = x.zh.toLowerCase(), n = x.en.toLowerCase()
    let sc = -1
    if (z === k || n === k || x.slug === k) sc = 0
    else if (z.startsWith(k) || n.startsWith(k)) sc = 1
    else if (z.includes(k) || n.includes(k) || x.slug.includes(k.replace(/\s+/g, '-'))) sc = 2
    else if (x.oneLiner.toLowerCase().includes(k)) sc = 3
    else if ((x.words || []).some(w => w.toLowerCase().includes(k))) sc = 4
    if (sc >= 0) res.push([sc, x.i, x])
  }
  return res.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, max).map(r => r[2])
}

// 今日推荐：与旧站同一算法（按日期哈希，从没学过的里挑）
export function todayPick(items, done, date = new Date()) {
  const pool = items.filter(x => !done.has(x.slug))
  if (!pool.length) return null
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}

export function randomUnlearned(items, done) {
  const pool = items.filter(x => !done.has(x.slug)); const arr = pool.length ? pool : items
  return arr[Math.floor(Math.random() * arr.length)]
}

// ---------------- 全文搜索（懒加载） ----------------
// 第一次打开搜索时才 import('./fulltext') 并 fetch search.json；没加载好之前用上面的 search()（只搜 index.json）顶上
let ftPromise = null
let ftModule = null
export function loadFulltext() {
  if (!ftPromise) {
    ftPromise = Promise.all([
      import('./fulltext.js'),
      fetch(BASE + 'search.json').then(r => { if (!r.ok) throw new Error('search ' + r.status); return r.json() }),
      loadIndex(),
    ]).then(([m, json, idx]) => { m.prepare(idx, json); ftModule = m; return m })
      .catch(e => { ftPromise = null; throw e })
  }
  return ftPromise
}
export function useFulltext(active = true) {
  const [m, setM] = useState(ftModule)
  useEffect(() => {
    if (!active || ftModule) { if (ftModule && m !== ftModule) setM(ftModule); return }
    let live = true
    loadFulltext().then(x => live && setM(x)).catch(() => {})
    return () => { live = false }
  }, [active]) // eslint-disable-line
  return m
}
// 统一的结果格式；fulltext 没加载时的降级结果（只有标题 / 一句话 / 词汇）
export function quickResults(idx, q, filters = {}, max = 500) {
  const lvName = filters.lv && filters.lv !== 'all' ? idx.levelByCls[filters.lv]?.name : null
  const cat = filters.cat && filters.cat !== 'all' ? filters.cat : null
  let items = idx.items
  if (lvName || cat || filters.scope === 'pro') items = items.filter(x => (!lvName || x.level === lvName) && (!cat || x.cat === cat) && (filters.scope !== 'pro' || x.pro))
  return search(items, q, max).map(x => ({ x, f: 'title', label: '标题', pro: filters.scope === 'pro', to: `/c/${x.slug}${filters.scope === 'pro' ? '/pro' : ''}`, snip: { title: {} } }))
}
export function runSearch(idx, ft, q, filters) {
  return ft ? ft.ftSearch(idx, q, filters) : quickResults(idx, q, filters)
}

// ---------------- 知识图谱数据（懒加载） ----------------
let graphPromise = null
export function loadGraph() {
  if (!graphPromise) {
    graphPromise = Promise.all([fetch(BASE + 'graph.json').then(r => { if (!r.ok) throw new Error('graph ' + r.status); return r.json() }), loadIndex()])
      .then(([g, idx]) => {
        const nodes = g.n.map(([l, cat, x, y], i) => ({ i, slug: g.s[i], item: idx.items[i], l, cat, x, y, x0: x, y0: y, deg: 0 }))
        const adj = nodes.map(() => [])
        for (const [a, b] of g.e) { adj[a].push(b); adj[b].push(a); nodes[a].deg++; nodes[b].deg++ }
        const at = Object.fromEntries(nodes.map(n => [n.slug, n.i]))
        return { nodes, edges: g.e, adj, at }
      })
      .catch(e => { graphPromise = null; throw e })
  }
  return graphPromise
}
export function useGraph() {
  const [s, setS] = useState({ data: null, error: null })
  useEffect(() => {
    let live = true
    loadGraph().then(d => live && setS({ data: d, error: null })).catch(e => live && setS({ data: null, error: e }))
    return () => { live = false }
  }, [])
  return s
}
// 学习顺序：邻居按级别分成「建议先学」「同级相关」「学完可以看」
export function neighbourGroups(g, i) {
  const me = g.nodes[i]
  const nb = g.adj[i].map(j => g.nodes[j]).sort((a, b) => a.l - b.l || a.item.no - b.item.no)
  return { before: nb.filter(n => n.l < me.l), same: nb.filter(n => n.l === me.l), after: nb.filter(n => n.l > me.l) }
}
