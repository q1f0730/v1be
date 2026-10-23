// 知识图谱页 #/graph（懒加载；graph.json 也是进来才 fetch）
//  - 500 个概念 + 关系边，canvas 力导向；可缩放、可拖拽；颜色按级别 / 分类切换；已学会的节点有绿环
//  - 级别、分类筛选（?lv= ?cat=），颜色模式（?color=cat），选中节点（?focus=<slug>，可直接分享 / 从概念页跳进来）
//  - 点节点：高亮它和邻居，侧卡（桌面右侧 / 手机底部抽屉）显示名字、一句话、进入概念，以及按级别分组的「建议先学 / 同级相关 / 学完可以看」
//  - 搜索框（Rewamp morph-search-capsule）定位节点
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useDragControls } from 'framer-motion'
import { Plus, Minus, Maximize2, X, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../App'
import { useGraph, neighbourGroups } from '../lib/data'
import { useMedia } from '../lib/useMedia'
import GraphCanvas, { LV_COLORS, CAT_COLORS, DONE_COLOR, shortName } from '../components/graph/GraphCanvas'
import SearchCapsule from '../components/rw/SearchCapsule'
import MagneticPillTabs from '../components/rw/MagneticPillTabs'
import Skeleton from '../components/rw/Skeleton'

export default function Graph() {
  const { idx, done, prefs, theme } = useApp()
  const { data: g, error } = useGraph()
  const [sp, setSp] = useSearchParams()
  const isMobile = useMedia('(max-width:1023px)')
  const reduce = useReducedMotion() || prefs.still
  const dark = theme === 'dark'
  const levels = idx.meta.levels
  const color = sp.get('color') === 'cat' ? 'cat' : 'level'
  const lv = levels.some(l => l.cls === sp.get('lv')) ? sp.get('lv') : 'all'
  const cat = idx.meta.catOrder.includes(sp.get('cat')) ? sp.get('cat') : 'all'
  const focusSlug = sp.get('focus')
  const sel = g && focusSlug && g.at[focusSlug] != null ? g.at[focusSlug] : null
  const [showF, setShowF] = useState(false)
  const canvas = useRef(null)
  const drag = useDragControls()
  const toolbar = useRef(null)
  const [topInset, setTopInset] = useState(isMobile ? 40 : 230)
  useEffect(() => {
    if (isMobile) { setTopInset(40); return }
    const el = toolbar.current; if (!el) return
    const ro = new ResizeObserver(() => setTopInset(Math.round(el.getBoundingClientRect().height) + 24))
    ro.observe(el); return () => ro.disconnect()
  }, [isMobile, !!g]) // eslint-disable-line
  const centerNext = useRef(true) // 下一次选中是否把节点移到视图中心（画布上点的不移）

  useEffect(() => { document.title = '🕸️ 知识图谱 · AI 造物指南' }, [])

  const setParam = useCallback(patch => {
    const n = { color, lv, cat, focus: focusSlug, ...patch }
    const o = {}
    if (n.color === 'cat') o.color = 'cat'
    if (n.lv && n.lv !== 'all') o.lv = n.lv
    if (n.cat && n.cat !== 'all') o.cat = n.cat
    if (n.focus) o.focus = n.focus
    setSp(o, { replace: true })
  }, [color, lv, cat, focusSlug, setSp])

  const catIndex = useMemo(() => Object.fromEntries(idx.meta.catOrder.map((k, i) => [k, i])), [idx])
  const visible = useMemo(() => {
    if (lv === 'all' && cat === 'all') return null
    const li = levels.findIndex(l => l.cls === lv)
    return n => (lv === 'all' || n.l === li) && (cat === 'all' || n.cat === cat)
  }, [lv, cat, levels])
  const visCount = g ? (visible ? g.nodes.filter(visible).length : g.nodes.length) : 0
  const doneCount = g ? g.nodes.filter(n => done.has(n.slug) && (!visible || visible(n))).length : 0

  const select = useCallback((i, from) => {
    centerNext.current = from !== 'canvas'
    setParam({ focus: i == null ? null : g.nodes[i].slug })
  }, [g, setParam])

  // 选中变化 → 居中（URL 直接带 focus、搜索定位、侧卡里点邻居）
  useEffect(() => {
    if (!g || sel == null) return
    const c = centerNext.current
    centerNext.current = true
    // 搜索 / 地址 / 侧卡里点的：放大并居中；画布上点的：只在被挡住时平移
    const id = setTimeout(() => c ? canvas.current?.focus(sel, isMobile ? 1.2 : 1.5) : isMobile ? canvas.current?.focus(sel, 1.1) : canvas.current?.ensureVisible(sel), 60)
    return () => clearTimeout(id)
  }, [g, sel]) // eslint-disable-line
  // 筛选变化 → 适应视图
  const firstFilter = useRef(true)
  useEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; if (sel == null && visible) setTimeout(() => canvas.current?.fit(false), 30); return }
    canvas.current?.fit()
  }, [lv, cat]) // eslint-disable-line

  const theme2 = dark ? 'dark' : 'light'
  const legend = color === 'level'
    ? levels.map((l, i) => ({ k: l.cls, c: LV_COLORS[theme2][i], t: `${l.emoji} ${l.name}` }))
    : idx.meta.catOrder.map((k, i) => ({ k, c: CAT_COLORS[theme2][i % 15], t: `${idx.meta.cats[k].emoji} ${idx.meta.cats[k].name}` }))

  const colorTabs = (
    <MagneticPillTabs role="radiogroup" ariaLabel="节点颜色" layoutId="graph-color" size="sm" scroll={false} still={prefs.still}
      items={[{ id: 'level', emoji: '🎚️', label: '按级别' }, { id: 'cat', emoji: '🗂️', label: '按分类' }]}
      value={color} onChange={v => setParam({ color: v })} />
  )
  const lvTabs = (
    <MagneticPillTabs ariaLabel="按级别筛选" layoutId="graph-lv" size="sm" still={prefs.still}
      items={[{ id: 'all', label: '全部级别' }, ...levels.map(l => ({ id: l.cls, emoji: l.emoji, label: l.name }))]}
      value={lv} onChange={v => setParam({ lv: v })} />
  )
  const catTabs = (
    <MagneticPillTabs ariaLabel="按分类筛选" layoutId="graph-cat" size="sm" still={prefs.still}
      items={[{ id: 'all', label: '全部分类' }, ...idx.meta.catOrder.map(k => ({ id: k, emoji: idx.meta.cats[k].emoji, label: idx.meta.cats[k].name }))]}
      value={cat} onChange={v => setParam({ cat: v })} />
  )
  const search = (
    <SearchCapsule idx={idx} done={done} still={prefs.still} max={6} className="w-full z-30" inputLabel="在图谱里找概念"
      placeholder={isMobile ? '找节点：token、dyymx…' : '在图谱里找：中文、英文、拼音'}
      onChoose={r => { const i = g?.at[r.x.slug]; if (i != null) select(i, 'search') }} />
  )

  const zoomBtns = (
    <div className="flex flex-col gap-1.5 p-1.5 rounded-[18px] bg-[var(--surface)]/95 backdrop-blur border border-[var(--line)] shadow-[var(--sh)]">
      {[[Plus, '放大', () => canvas.current?.zoom(1.3), 'zoom-in'], [Minus, '缩小', () => canvas.current?.zoom(1 / 1.3), 'zoom-out'], [Maximize2, '看全部', () => canvas.current?.fit(), 'zoom-fit']].map(([I, l, f, id]) => (
        <button key={l} type="button" onClick={f} aria-label={l} title={l} data-testid={id}
          className="w-11 h-11 grid place-items-center rounded-xl hover:bg-[var(--surface2)] active:scale-95 transition-transform"><I size={19} /></button>
      ))}
    </div>
  )
  const legendBox = (
    <div className="max-w-[min(560px,calc(100vw-120px))] rounded-[18px] bg-[var(--surface)]/95 backdrop-blur border border-[var(--line)] shadow-[var(--sh)] px-3 py-2 text-[12.5px] leading-tight">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center">
        {legend.map(x => <span key={x.k} className="inline-flex items-center gap-1.5 whitespace-nowrap"><i className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: x.c }} />{x.t}</span>)}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold">
          <i className="w-3 h-3 rounded-full flex-none border-[2.5px] grid place-items-center" style={{ borderColor: DONE_COLOR[theme2] }} />已学会 {doneCount}
        </span>
      </div>
    </div>
  )

  const card = g && sel != null ? <NodeCard g={g} i={sel} onPick={j => select(j, 'card')} onClose={() => select(null, 'card')} /> : null
  const stage = !g ? (
    <div className="absolute inset-0 grid place-items-center p-6">
      {error ? <div className="text-center"><p className="font-bold">图谱数据没加载出来 😵</p><button className="btn btn-pri" onClick={() => location.reload()}>刷新试试</button></div>
        : <Skeleton className="w-full h-full rounded-[24px]" />}
    </div>
  ) : (
    <GraphCanvas ref={canvas} graph={g} catIndex={catIndex} done={done} colorMode={color} visible={visible} selected={sel}
      onSelect={select} dark={dark} reduce={reduce} rightInset={!isMobile && sel != null ? 392 : 0} topInset={topInset}
      bottomInset={isMobile ? (sel != null ? Math.round((typeof innerHeight !== 'undefined' ? innerHeight : 800) * 0.5) : 80) : 64}
      label={`知识图谱：${visCount} 个概念。拖动平移，滚轮或双指缩放，点圆点查看概念；也可以用上面的搜索框定位。`} />
  )

  if (isMobile) return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 58px)' }}>
      <div className="px-3.5 pt-3 pb-2 grid grid-cols-[minmax(0,1fr)] gap-2 relative z-20">
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">{search}</div>
          <button type="button" onClick={() => setShowF(v => !v)} aria-expanded={showF} data-testid="graph-filter-toggle"
            aria-label={`筛选和颜色${lv !== 'all' || cat !== 'all' ? '（已筛选）' : ''}`}
            className={`relative h-14 w-14 grid place-items-center rounded-full shadow-[var(--sh)] flex-none ${showF || lv !== 'all' || cat !== 'all' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)]'}`}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
        {showF && <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{colorTabs}{lvTabs}{catTabs}</div>}
      </div>
      <div className="relative flex-1 min-h-0 mx-2 mb-2 rounded-[24px] overflow-hidden bg-[var(--surface)] shadow-[var(--sh)]">
        {stage}
        <div className="absolute left-2.5 top-2.5 pointer-events-none text-[12px] font-semibold text-[var(--ink2)] bg-[var(--surface)]/90 rounded-full px-2.5 py-1">🕸️ {visCount} 个概念 · 双指缩放</div>
        {!card && <div className="absolute right-2.5 bottom-[96px]">{zoomBtns}</div>}
        {!card && <div className="absolute left-2.5 bottom-[96px] pointer-events-none">{legendBox}</div>}
      </div>
      <AnimatePresence>
        {card && (
          <motion.div key="drawer" role="dialog" aria-label="概念详情" data-testid="graph-card"
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag={reduce ? false : 'y'} dragListener={false} dragControls={drag} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(e, info) => { if (info.offset.y > 90) select(null, 'card') }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[var(--surface)] rounded-t-[26px] shadow-[0_-12px_40px_-12px_rgba(0,0,0,.35)] border-t border-[var(--line)] max-h-[52dvh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
            {/* 只有顶部把手能拖（往下拖关闭），里面的内容照常滚动 */}
            <div className="sticky top-0 z-10 bg-[var(--surface)] pt-2.5 pb-2 touch-none cursor-grab" onPointerDown={e => drag.start(e)} aria-hidden="true">
              <div className="w-10 h-[5px] rounded-full bg-[var(--surface3)] mx-auto" />
            </div>
            <div className="px-4">{card}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <div className="p-4 lg:pl-0" style={{ height: '100dvh' }}>
      <div className="relative h-full rounded-[28px] overflow-hidden bg-[var(--surface)] shadow-[var(--sh)]">
        {stage}
        {/* 顶部工具条 */}
        <div ref={toolbar} className="absolute left-4 top-4 z-20 flex flex-col gap-2.5 pointer-events-none" style={{ right: sel != null ? 408 : 16 }}>
          <div className="flex items-start gap-3 flex-wrap pointer-events-auto">
            <div className="w-[min(380px,100%)]">{search}</div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="chip-tag !bg-[var(--surface)] shadow-[var(--sh)] !py-3"><span className="emo">🕸️</span>知识图谱 · {visCount} 个概念 · {g ? g.edges.length : '…'} 条关系</span>
              {colorTabs}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-start pointer-events-auto w-full [&>div]:max-w-full">{lvTabs}{catTabs}</div>
        </div>
        <div className="absolute left-4 bottom-4 z-10">{legendBox}</div>
        <div className="absolute bottom-4 z-10" style={{ right: sel != null ? 408 : 16 }}>{zoomBtns}</div>
        <p className="absolute bottom-[22px] z-10 m-0 px-2.5 py-1 rounded-full bg-[var(--surface)]/90 text-[12.5px] text-[var(--ink2)] pointer-events-none hidden xl:block" style={{ right: sel != null ? 474 : 82 }}>拖动平移 · 滚轮缩放 · 拖圆点 · 点圆点看详情 · 键盘 + − 0</p>
        <AnimatePresence>
          {card && (
            <motion.aside key="card" aria-label="概念详情" data-testid="graph-card"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="absolute right-4 top-4 bottom-4 z-30 w-[376px] rounded-[24px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--sh2)] overflow-y-auto p-5">
              {card}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function NodeCard({ g, i, onPick, onClose }) {
  const { idx, done } = useApp()
  const n = g.nodes[i]; const x = n.item
  const lv = idx.levelBy[x.level]
  const cat = idx.meta.cats[x.cat] || { emoji: '📦', name: x.cat }
  const grp = neighbourGroups(g, i)
  const isDone = done.has(x.slug)
  const Group = ({ title, sub, list, testid }) => list.length ? (
    <div className="mt-4" data-testid={testid}>
      <h3 className="m-0 mb-2 text-[14px] font-bold flex items-baseline gap-1.5">{title}<small className="font-normal text-[12px] text-[var(--ink3)]">{sub}</small></h3>
      <ul className="list-none m-0 p-0 grid gap-1.5">
        {list.map(m => {
          const y = m.item; const ylv = idx.levelBy[y.level]
          return (
            <li key={m.slug}>
              <button type="button" onClick={() => onPick(m.i)}
                className={`${ylv.cls} w-full flex items-center gap-2.5 min-h-[46px] px-2.5 py-1.5 rounded-[14px] bg-[var(--surface2)] hover:bg-[var(--accs)] text-left`}>
                <span className="emo text-[18px] w-8 h-8 grid place-items-center rounded-[10px] bg-[var(--accs)] flex-none">{y.emoji}</span>
                <span className="flex-1 min-w-0 text-[14.5px] font-semibold leading-snug [overflow-wrap:anywhere]">{shortName(y.zh)}{done.has(y.slug) ? ' ✅' : ''}</span>
                <span className="lvb !text-[11.5px] !px-2 flex-none">{ylv.emoji} {y.level}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  ) : null
  return (
    <div className={lv.cls}>
      <div className="flex items-start gap-3">
        <span className="emo text-[30px] w-[54px] h-[54px] grid place-items-center rounded-[18px] bg-[var(--accs)] flex-none">{x.emoji}</span>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-[20px] leading-snug [overflow-wrap:anywhere]" data-testid="graph-card-title">{x.zh}</h2>
          <p className="m-0 text-[13px] text-[var(--ink2)] [overflow-wrap:anywhere]">{x.en}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭" className="w-11 h-11 -mr-1.5 -mt-1 grid place-items-center rounded-full bg-[var(--surface2)] flex-none"><X size={18} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3 text-[12.5px]">
        <span className="lvb">{lv.emoji} {x.level}</span>
        <span className="bg-[var(--surface2)] rounded-full px-2.5 font-semibold leading-[1.75]">{cat.emoji} {cat.name}</span>
        <span className="bg-[var(--surface2)] rounded-full px-2.5 font-semibold leading-[1.75]">🔗 {g.adj[i].length} 个关系</span>
        {isDone && <span className="rounded-full px-2.5 font-bold leading-[1.75] bg-[var(--pist)] text-[var(--l1i)]">✅ 已学会</span>}
      </div>
      <p className="m-0 mt-3 text-[16px] leading-relaxed">{x.oneLiner}</p>
      <div className="flex gap-2 mt-3.5">
        <Link to={'/c/' + x.slug} data-testid="graph-open" className="btn btn-pri flex-1 !min-h-[46px] !text-[15px]">进入概念 <ArrowRight size={17} /></Link>
        {x.pro && <Link to={'/c/' + x.slug + '/pro'} className="btn btn-soft !min-h-[46px] !text-[15px] !px-4">🎓 专业</Link>}
      </div>
      <Group title="⬅️ 建议先学" sub="级别更低的相关概念" list={grp.before} testid="grp-before" />
      <Group title="↔️ 同级相关" sub="一起看更好懂" list={grp.same} testid="grp-same" />
      <Group title="➡️ 学完可以看" sub="级别更高的相关概念" list={grp.after} testid="grp-after" />
    </div>
  )
}
