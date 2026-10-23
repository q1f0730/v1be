// 概念页「关系」小图：当前概念 + 一跳邻居（可选二跳），SVG 静态布局（不跑力导向，不引 d3）。
// 左边「建议先学」（级别更低）、右边「学完可以看」（级别更高）、上下是同级相关；点节点跳到那个概念。
// 「在图谱中打开」→ #/graph?focus=<slug>
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../App'
import { useGraph, neighbourGroups } from '../../lib/data'
import { LV_COLORS, DONE_COLOR, shortName } from './colors'

const cutName = (s, n) => { s = shortName(s); return [...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s }

export default function RelationMini({ slug, mode }) {
  const { idx, done, theme } = useApp()
  const { data: g } = useGraph()
  const nav = useNavigate()
  const box = useRef(null)
  const [w, setW] = useState(640)
  const [two, setTwo] = useState(false)
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.getBoundingClientRect().width))))
    ro.observe(el); return () => ro.disconnect()
  }, [g])

  const dark = theme === 'dark'
  const th = dark ? 'dark' : 'light'
  const narrow = w < 560
  const i = g?.at[slug]

  // 三栏布局（从左往右 = 学习顺序）：左「建议先学」、中「当前 + 同级相关（上下）」、右「学完可以看」
  const layout = useMemo(() => {
    if (!g || i == null) return null
    const grp = neighbourGroups(g, i)
    const rowH = 58
    const sub = narrow ? 1 : 2 // 每栏几列
    const capSide = 6 * sub, capSame = narrow ? 2 : 3
    const L = grp.before.slice(0, capSide), R = grp.after.slice(0, capSide)
    const top = grp.same.slice(0, capSame), bot = grp.same.slice(capSame, capSame * 2)
    const rowsSide = Math.max(Math.ceil(L.length / sub), Math.ceil(R.length / sub))
    const rowsMid = Math.max(top.length, bot.length) * 2 + 1
    const H = Math.max(240, Math.max(rowsSide * rowH + 40, rowsMid * rowH + 80))
    const cx = w / 2, cy = H / 2 - 2
    const colX = narrow ? [w * 0.15, w * 0.85] : [w * 0.17, w * 0.83]
    const pos = []
    const column = (list, x0, tag, dir) => {
      const rows = Math.ceil(list.length / sub)
      list.forEach((m, j) => {
        const r = Math.floor(j / sub), c = j % sub
        const x = sub === 2 ? x0 + (c === 0 ? -1 : 1) * 66 * dir * (list.length - r * sub > 1 || c === 1 ? 1 : 0) : x0
        pos.push({ m, tag, x, y: cy + (r - (rows - 1) / 2) * rowH, side: dir })
      })
    }
    column(L, colX[0], 'before', -1)
    column(R, colX[1], 'after', 1)
    top.forEach((m, k) => pos.push({ m, tag: 'same', x: cx, y: cy - (k + 1) * rowH - 16, side: 0 }))
    bot.forEach((m, k) => pos.push({ m, tag: 'same', x: cx, y: cy + (k + 1) * rowH + 18, side: 0 }))
    const more = { before: grp.before.length - L.length, after: grp.after.length - R.length, same: grp.same.length - top.length - bot.length }
    // 二跳：挂在一跳邻居外侧的小点（每个最多 2 个）
    const p2 = []
    if (two) {
      const have = new Set([i, ...g.adj[i]]); const used = new Set()
      for (const p of pos) {
        const kids = g.adj[p.m.i].filter(j => !have.has(j) && !used.has(j)).slice(0, 2)
        kids.forEach((j, t) => {
          used.add(j)
          const dx = p.side === 0 ? (t ? 1 : -1) * (narrow ? 44 : 64) : p.side * (narrow ? 26 : 40)
          const dy = p.side === 0 ? -10 : (t ? 1 : -1) * 14
          p2.push({ m: g.nodes[j], from: p, x: p.x + dx, y: p.y + dy })
        })
      }
    }
    return { grp, pos, p2, cx, cy, H, more, colX }
  }, [g, i, w, narrow, two])

  if (!g || i == null || !layout) return <div ref={box} className="card mt-5 h-[120px]" aria-hidden="true" />
  const me = g.nodes[i]
  const colorOf = n => LV_COLORS[th][n.l]
  const to = m => `/c/${m.slug}${mode === 'pro' && m.item.pro ? '/pro' : ''}`
  const go = m => nav(to(m))
  const label = (m, n) => cutName(m.item.zh, n)
  const { pos, p2, cx, cy, grp, H, more, colX } = layout
  const ink = dark ? '#F2F2F5' : '#1D1D1F'
  const halo = dark ? '#18181D' : '#FFFFFF'
  const line = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'

  const Node = ({ m, x, y, r, small }) => (
    <g role="link" tabIndex={0} aria-label={`${m.item.zh}（${m.item.level}）`} className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--blue)]"
      onClick={() => go(m)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(m) } }} data-slug={m.slug}>
      <title>{m.item.zh} · {m.item.level}</title>
      <circle cx={x} cy={y} r={r + 8} fill="transparent" stroke="transparent" strokeWidth="3" />
      <circle cx={x} cy={y} r={r} fill={small ? colorOf(m) : halo} stroke={colorOf(m)} strokeWidth={small ? 0 : 2.5} />
      {done.has(m.slug) && <circle cx={x} cy={y} r={r + 3.5} fill="none" stroke={DONE_COLOR[th]} strokeWidth="2.5" />}
      {!small && <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.05} className="emo select-none">{m.item.emoji}</text>}
      {!small && (
        <text x={x} y={y + r + 14} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={ink} stroke={halo} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" className="select-none">
          {label(m, narrow ? 5 : 8)}
        </text>
      )}
    </g>
  )

  return (
    <section className="card mt-5 p-4 lg:p-6 dim-in-focus" aria-labelledby="h-rel" data-testid="relation-mini">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 id="h-rel" className="m-0 text-[18px] lg:text-[20px]"><span className="emo">🕸️</span> 关系 <small className="text-[13px] font-normal text-[var(--ink2)]">{g.adj[i].length} 个相关概念</small></h2>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full bg-[var(--surface2)] text-[13.5px] font-semibold cursor-pointer">
            <input type="checkbox" checked={two} onChange={e => setTwo(e.target.checked)} className="w-4 h-4 accent-[var(--blue)]" />显示二跳
          </label>
          <Link to={`/graph?focus=${slug}`} data-testid="open-in-graph" className="inline-flex items-center gap-1 min-h-[44px] px-3.5 rounded-full bg-[var(--ink)] text-[var(--bg)] no-underline text-[13.5px] font-bold">在图谱中打开 →</Link>
        </div>
      </div>
      <div ref={box} className="mt-2 -mx-1">
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="group" aria-label={`${me.item.zh} 的关系图`} className="block max-w-full">
          {p2.map(p => <line key={'l2' + p.m.slug} x1={p.from.x} y1={p.from.y} x2={p.x} y2={p.y} stroke={line} strokeWidth="1" strokeDasharray="3 3" />)}
          {pos.map(p => <path key={'l' + p.m.slug} d={p.side ? `M${cx},${cy} C${(cx + p.x) / 2},${cy} ${(cx + p.x) / 2},${p.y} ${p.x},${p.y}` : `M${cx},${cy} L${p.x},${p.y}`}
            fill="none" stroke={colorOf(p.tag === 'before' ? p.m : me)} strokeOpacity=".5" strokeWidth="2" />)}
          {!narrow && grp.before.length > 0 && <text x={colX[0]} y={18} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={dark ? '#B9B9C2' : '#55555C'}>⬅️ 建议先学</text>}
          {!narrow && grp.after.length > 0 && <text x={colX[1]} y={18} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={dark ? '#B9B9C2' : '#55555C'}>学完可以看 ➡️</text>}
          {[['before', 6, 'start'], ['after', w - 6, 'end']].map(([k, x, anchor]) => more[k] > 0 && (
            <text key={k} x={x} y={H - 6} textAnchor={anchor} fontSize="12.5" fontWeight="600" fill={dark ? '#6FA2FF' : '#0052D6'} role="link" tabIndex={0}
              className="cursor-pointer" onClick={() => nav(`/graph?focus=${slug}`)} onKeyDown={e => { if (e.key === 'Enter') nav(`/graph?focus=${slug}`) }}>
              还有 {more[k]} 个，去图谱看 →
            </text>
          ))}
          {p2.map(p => <Node key={'n2' + p.m.slug} m={p.m} x={p.x} y={p.y} r={5} small />)}
          {pos.map(p => <Node key={'n' + p.m.slug} m={p.m} x={p.x} y={p.y} r={narrow ? 15 : 17} />)}
          <g aria-hidden="true">
            <circle cx={cx} cy={cy} r={narrow ? 25 : 29} fill={colorOf(me)} />
            {done.has(me.slug) && <circle cx={cx} cy={cy} r={(narrow ? 25 : 29) + 4} fill="none" stroke={DONE_COLOR[th]} strokeWidth="3" />}
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={narrow ? 24 : 28} className="emo select-none">{me.item.emoji}</text>
            <text x={cx} y={cy + (narrow ? 25 : 29) + 16} textAnchor="middle" fontSize="13.5" fontWeight="800" fill={ink} stroke={halo} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">{cutName(me.item.zh, narrow ? 8 : 12)}</text>
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[var(--ink2)] mt-1">
        <span>⬅️ <b className="text-[var(--ink)]">建议先学</b> {grp.before.length}</span>
        <span>↕️ <b className="text-[var(--ink)]">同级相关</b> {grp.same.length}</span>
        <span>➡️ <b className="text-[var(--ink)]">学完可以看</b> {grp.after.length}</span>
        <span className="inline-flex items-center gap-1.5">{idx.meta.levels.map((l, k) => <i key={l.cls} title={l.name} className="w-2.5 h-2.5 rounded-full" style={{ background: LV_COLORS[th][k] }} />)}颜色 = 级别</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-full border-[2.5px]" style={{ borderColor: DONE_COLOR[th] }} />已学会</span>
      </div>
    </section>
  )
}
