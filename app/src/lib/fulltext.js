// 全文搜索（懒加载模块：第一次打开搜索时才 import，同时 fetch public/data/search.json）
// 覆盖：标题中英文 + slug、标题拼音（全拼 / 首字母）、词汇 / 专业术语（含拼音）、一句话、比喻、要点、步骤、翻车现场、
//       专业定义、原理、术语解释、代码。打分：标题 > 术语/词汇 > 一句话 > 正文 > 代码。
// 结果：{ x, f, label, pro, sec, to, snip: { text, hl: [[s, e]] }, titleHl, score }

const HAN = /\p{Script=Han}/u
const ASCII = /^[a-z]+$/

// 字段定义：权重、显示名、对应概念页的章节（?s=）、是否专业内容
export const FIELDS = {
  title: { w: 1000, label: '标题' },
  tpy: { w: 820, label: '标题 · 拼音' },
  words: { w: 640, label: '词汇', sec: 'words' },
  wpy: { w: 560, label: '词汇 · 拼音', sec: 'words' },
  terms: { w: 620, label: '专业 · 术语', sec: 'terms', pro: true },
  tmpy: { w: 540, label: '专业 · 术语拼音', sec: 'terms', pro: true },
  one: { w: 420, label: '一句话' },
  ana: { w: 220, label: '比喻', sec: 'ana' },
  pts: { w: 210, label: '要点', sec: 'ana' },
  steps: { w: 210, label: '步骤', sec: 'how' },
  oops: { w: 210, label: '翻车现场', sec: 'oops' },
  def: { w: 230, label: '专业 · 定义', sec: 'def', pro: true },
  how: { w: 205, label: '专业 · 原理', sec: 'how', pro: true },
  termd: { w: 200, label: '专业 · 术语', sec: 'terms', pro: true },
  code: { w: 110, label: '专业 · 代码', sec: 'code', pro: true },
}

let docs = null // 与 index.items 对齐的预处理文档

const low = s => String(s || '').toLowerCase()
function sylInfo(py, text) {
  if (!py) return null
  const sy = py.split(' ')
  const joined = sy.join('')
  const starts = []; let p = 0
  for (const s of sy) { starts.push(p); p += s.length }
  const ini = sy.map(s => s[0]).join('')
  const han = []; [...text].forEach((ch, k) => { if (HAN.test(ch)) han.push(k) })
  // han[k] 是第 k 个汉字在 [...text] 里的下标；转成 UTF-16 下标
  const cps = [...text]; const off = []; let o = 0
  for (const ch of cps) { off.push(o); o += ch.length }
  return { sy, joined, starts, ini, han: han.map(k => [off[k], off[k] + cps[k].length]) }
}

// 预处理：search.json（按位置存）+ index.json
export function prepare(idx, json) {
  const F = json.f
  docs = idx.items.map((x, i) => {
    const row = json.d[i] || []
    const o = {}; F.forEach((k, j) => { o[k] = row[j] || null })
    const words = x.words || []
    const terms = o.terms || []
    const wpy = o.wpy || []
    return {
      x,
      zh: x.zh, en: x.en, zhL: low(x.zh), enL: low(x.en), slug: x.slug,
      abbr: (low(x.zh).match(/[(（]([^)）]*)[)）]/)?.[1] || '').split(/\s*[/／,，]\s*/).map(s => s.trim()).filter(Boolean),
      tpy: sylInfo(o.py, x.zh),
      words: words.map((w, k) => ({ t: w, l: low(w), py: sylInfo(wpy[k], w) })),
      terms: terms.map((t, k) => ({ t: t[0], l: low(t[0]), d: t[1], dl: low(t[1]), py: sylInfo(wpy[words.length + k], t[0]) })),
      one: x.oneLiner, oneL: low(x.oneLiner),
      ana: o.ana || '', pts: o.pts || [], steps: o.steps || [], oops: o.oops || '',
      def: o.def || '', how: o.how || [], code: o.code ? o.code[1] : '', codeTitle: o.code ? o.code[0] : '',
    }
  })
  for (const d of docs) {
    d.anaL = low(d.ana); d.ptsL = d.pts.map(low); d.stepsL = d.steps.map(low); d.oopsL = low(d.oops)
    d.defL = low(d.def); d.howL = d.how.map(low); d.codeL = low(d.code); d.codeTitleL = low(d.codeTitle)
  }
  return docs
}
export const ready = () => !!docs

// 拼音匹配：全拼（从音节开头起，末尾可以只打半个音节）或首字母。返回命中的汉字区间 [s, e)
function pyMatch(info, t) {
  if (!info || t.length < 2 || !ASCII.test(t)) return null
  // 首字母：dyymx → 大语言模型
  const ii = info.ini.indexOf(t)
  if (ii >= 0) return { s: ii, n: t.length, at0: ii === 0 }
  // 全拼：必须从某个音节开头起；末尾可以只打半个音节（dayuy → 大语言）；只有 2 个字母时必须是完整音节
  for (let k = 0; k < info.starts.length; k++) {
    if (!info.joined.startsWith(t, info.starts[k])) continue
    const end = info.starts[k] + t.length
    let m = k; while (m + 1 < info.starts.length && info.starts[m + 1] < end) m++
    if (t.length < 3 && t !== info.sy[k]) continue
    return { s: k, n: m - k + 1, at0: k === 0 }
  }
  return null
}
const pyHl = (info, m) => [[info.han[m.s][0], info.han[m.s + m.n - 1][1]]]

function snipOf(text, pos, len, before = 18, after = 46) {
  const s = Math.max(0, pos - before), e = Math.min(text.length, pos + len + after)
  const pre = s > 0 ? '…' : ''
  const out = pre + text.slice(s, e).replace(/\s+/g, ' ') + (e < text.length ? '…' : '')
  return { text: out, at: pre.length + (pos - s) }
}
// 代码：取命中的那一行
function codeSnip(code, pos, len) {
  const ls = code.lastIndexOf('\n', pos - 1) + 1
  let le = code.indexOf('\n', pos); if (le < 0) le = code.length
  const line = code.slice(ls, le)
  const lead = line.length - line.trimStart().length
  const sn = snipOf(line.trim(), pos - ls - lead, len, 24, 50)
  return sn
}

// 单个词在一个文档里的最好命中
function bestHit(d, t, scope) {
  let best = null
  const take = (f, score, snip) => { if (!best || score > best.score) best = { f, score, snip } }
  const allowEasy = scope !== 'pro', allowPro = scope !== 'easy'
  // 标题
  const zi = d.zhL.indexOf(t), ei = d.enL.indexOf(t)
  if (zi >= 0 || ei >= 0 || d.slug.includes(t.replace(/\s+/g, '-'))) {
    let sc = FIELDS.title.w
    const exact = d.zhL === t || d.enL === t || d.slug === t || d.zhL.replace(/\s*\(.*\)$/, '') === t
    if (exact) sc += 300
    else if (d.abbr.includes(t)) sc += 260 // 括号里的缩写正好是它：LLM → 大语言模型 (LLM)
    else if (zi === 0 || ei === 0) sc += 150
    else if (zi > 0 && /[\s(（]/.test(d.zhL[zi - 1])) sc += 120 // 括号里的英文缩写：大语言模型 (LLM)
    const hl = zi >= 0 ? { zh: [[zi, zi + t.length]] } : ei >= 0 ? { en: [[ei, ei + t.length]] } : {}
    take('title', sc, { title: hl })
  }
  // 标题拼音
  const pm = pyMatch(d.tpy, t)
  if (pm) take('tpy', FIELDS.tpy.w + (pm.at0 ? 80 : 0) + (pm.n === d.tpy.sy.length ? 60 : 0), { title: { zh: pyHl(d.tpy, pm) } })
  if (best && best.f === 'title' && best.score >= 1150) return best
  // 词汇
  if (allowEasy) d.words.forEach(w => {
    const k = w.l.indexOf(t)
    if (k >= 0) take('words', FIELDS.words.w + (k === 0 ? 40 : 0), { text: w.t, hl: [[k, k + t.length]] })
    const m = pyMatch(w.py, t)
    if (m) take('wpy', FIELDS.wpy.w + (m.at0 ? 30 : 0), { text: w.t, hl: pyHl(w.py, m) })
  })
  // 专业术语
  if (allowPro) d.terms.forEach(w => {
    const k = w.l.indexOf(t)
    if (k >= 0) take('terms', FIELDS.terms.w + (k === 0 ? 40 : 0), { text: w.t + '：' + w.d, hl: [[k, k + t.length]] })
    const m = pyMatch(w.py, t)
    if (m) take('tmpy', FIELDS.tmpy.w + (m.at0 ? 30 : 0), { text: w.t + '：' + w.d, hl: pyHl(w.py, m) })
  })
  if (best && best.score >= FIELDS.terms.w) return best
  // 一句话
  if (allowEasy) { const k = d.oneL.indexOf(t); if (k >= 0) { const s = snipOf(d.one, k, t.length); take('one', FIELDS.one.w, { text: s.text, hl: [[s.at, s.at + t.length]] }) } }
  if (best) return best
  // 正文
  const str = (f, raw, l) => { const k = l.indexOf(t); if (k >= 0) { const s = snipOf(raw, k, t.length); take(f, FIELDS[f].w, { text: s.text, hl: [[s.at, s.at + t.length]] }); return true } }
  const arr = (f, raws, ls) => { for (let j = 0; j < ls.length; j++) if (str(f, raws[j], ls[j])) return }
  if (allowPro) { str('def', d.def, d.defL); arr('how', d.how, d.howL); d.terms.forEach(w => str('termd', w.t + '：' + w.d, low(w.t + '：') + w.dl)) }
  if (allowEasy) { str('ana', d.ana, d.anaL); arr('pts', d.pts, d.ptsL); arr('steps', d.steps, d.stepsL); str('oops', d.oops, d.oopsL) }
  if (best) return best
  // 代码
  if (allowPro && d.code) {
    const k = d.codeL.indexOf(t)
    if (k >= 0) { const s = codeSnip(d.code, k, t.length); take('code', FIELDS.code.w, { text: s.text, hl: [[s.at, s.at + t.length]], mono: true }) }
    else { const k2 = d.codeTitleL.indexOf(t); if (k2 >= 0) take('code', FIELDS.code.w, { text: d.codeTitle, hl: [[k2, k2 + t.length]] }) }
  }
  return best
}

export function linkFor(x, f) {
  const F = FIELDS[f] || {}
  if (F.pro && x.pro) return `/c/${x.slug}/pro${F.sec && F.sec !== 'def' ? '?s=' + F.sec : ''}`
  return `/c/${x.slug}${F.sec && F.sec !== 'one' ? '?s=' + F.sec : ''}`
}

// filters: { lv: 'all'|'l1'..., cat: 'all'|key, scope: 'all'|'easy'|'pro' }
export function ftSearch(idx, q, filters = {}) {
  const raw = low(q).trim()
  if (!raw || !docs) return []
  const toks = raw.split(/\s+/).filter(Boolean)
  const lvName = filters.lv && filters.lv !== 'all' ? idx.levelByCls[filters.lv]?.name : null
  const cat = filters.cat && filters.cat !== 'all' ? filters.cat : null
  const scope = filters.scope || 'all'
  const out = []
  for (const d of docs) {
    const x = d.x
    if (lvName && x.level !== lvName) continue
    if (cat && x.cat !== cat) continue
    if (scope === 'pro' && !x.pro) continue
    let hit = toks.length > 1 ? bestHit(d, raw, scope) : null
    let score
    if (hit) score = hit.score + 200
    else {
      const hs = toks.map(t => bestHit(d, t, scope))
      if (hs.some(h => !h)) continue
      hit = hs.reduce((a, b) => (b.score > a.score ? b : a))
      score = Math.min(...hs.map(h => h.score)) + hs.length
      // 片段里把其他词也高亮
      if (hit.snip.text) {
        const L = low(hit.snip.text); const hl = [...hit.snip.hl]
        for (const t of toks) { const k = L.indexOf(t); if (k >= 0 && !hl.some(([s, e]) => k < e && k + t.length > s)) hl.push([k, k + t.length]) }
        hit = { ...hit, snip: { ...hit.snip, hl: hl.sort((a, b) => a[0] - b[0]) } }
      }
    }
    // 只看专业时：标题 / 一句话 命中也算，但进专业版
    let f = hit.f
    const F = FIELDS[f]
    const pro = scope === 'pro' ? true : !!F.pro
    out.push({ x, f, label: scope === 'pro' && !F.pro ? F.label : F.label, pro, score, snip: hit.snip,
      to: scope === 'pro' && !F.pro ? `/c/${x.slug}/pro` : linkFor(x, f) })
  }
  return out.sort((a, b) => b.score - a.score || a.x.i - b.x.i)
}
