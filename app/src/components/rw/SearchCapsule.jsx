// 来自 Rewamp UI: src/components/ui/MorphSearchCapsule.jsx（registry: morph-search-capsule）
// 用途：首页搜索 + 全站搜索浮层（按 / 打开），搜 500 个概念，最多显示 8 条。
// 保留：胶囊外形、点击涟漪、放大镜 ⇄ 光标的 SVG 形变动画、清空按钮。
// 改动：
//  - 宽度改成 100% 自适应（原组件固定 270/320px，手机会挤）
//  - 颜色改用本站变量，自动跟随深色模式（去掉 MutationObserver 主题探测）
//  - 加上结果列表：↑ ↓ 选择、回车打开、Esc 清空/关闭；ARIA combobox/listbox
//  - placeholder 常显（原组件激活后才显示），中文文案
//  - 尊重「暂停动画」/ 系统减少动效
//  v2（全文搜索）：
//  - 第一次聚焦才懒加载全文索引（search.json + fulltext 模块），加载好之前用 index.json 的结果顶上
//  - 每条结果显示命中字段（如「专业 · 代码」）和高亮片段；拼音命中会高亮标题里对应的汉字
//  - 列表末尾「查看全部 N 条结果」→ #/search?q=（也能用 ↑↓ 选中、回车进入）
//  - 可受控（value / onValueChange）、可不显示列表（list=false，给完整结果页用）、可把「选中」交给外部（onChoose，图谱定位用）
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { runSearch, useFulltext } from '../../lib/data'
import Hl, { FieldChip } from '../search/Hl'

export default function SearchCapsule({
  idx, done, placeholder = '中文、英文、拼音都行：token、bushu、缓存…', max = 8,
  autoFocus = false, onPick, onEscape, still = false, className = '', dropdown = true,
  filters, fullLink = true, onChoose, list = true, value, onValueChange, onKeyExtra, inputLabel = '搜索概念', slot = null, listClassName = '',
}) {
  const reduce = useReducedMotion() || still
  const [isActive, setIsActive] = useState(autoFocus)
  const [qLocal, setQLocal] = useState('')
  const query = value ?? qLocal
  const setQuery = v => { if (value === undefined) setQLocal(v); onValueChange?.(v) }
  const [cur, setCur] = useState(0)
  const [open, setOpen] = useState(false)
  const [ripples, setRipples] = useState([])
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const listId = useId()
  const nav = useNavigate()
  const ft = useFulltext(isActive || !!query)
  const all = useMemo(() => (idx && query.trim() ? runSearch(idx, ft, query, filters) : []), [idx, ft, query, filters])
  const results = all.slice(0, max)
  const showFull = fullLink && !onChoose && all.length > 0
  const nOpts = results.length + (showFull ? 1 : 0)
  const levelBy = idx?.levelBy

  useEffect(() => { if (autoFocus) setTimeout(() => inputRef.current?.focus(), 60) }, [autoFocus])
  useEffect(() => {
    function out(e) { if (!dropdown) return; if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); if (!query) setIsActive(false) } }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [query, dropdown])

  const fullTo = '/search?q=' + encodeURIComponent(query.trim())
  const go = r => {
    setOpen(false)
    if (onChoose) { onChoose(r); return }
    setQuery(''); onPick?.(r.x)
    nav(r === 'all' ? fullTo : r.to)
  }

  const handleClick = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!reduce) {
      const r = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top }
      setRipples(p => [...p.slice(-2), r])
      setTimeout(() => setRipples(p => p.filter(q => q.id !== r.id)), 600)
    }
    setIsActive(true); setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }
  const onKey = e => {
    if (onKeyExtra && onKeyExtra(e)) return
    const n = list ? nOpts : 0
    if (e.key === 'ArrowDown' && n) { setCur(c => (c + 1) % n); setOpen(true); e.preventDefault() }
    else if (e.key === 'ArrowUp' && n) { setCur(c => (c - 1 + n) % n); setOpen(true); e.preventDefault() }
    else if (e.key === 'Enter' && list) { const i = Math.max(cur, 0); if (i < results.length) go(results[i]); else if (showFull) go('all') }
    else if (e.key === 'Escape') { if (query) { setQuery(''); e.stopPropagation() } else onEscape?.() }
  }
  const isMorphedToCaret = isActive && !query
  const showList = list && open && query.trim().length > 0
  const spring = reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <motion.div onClick={handleClick}
        animate={{ scale: isActive && !reduce ? 1.01 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative h-[56px] w-full rounded-full overflow-hidden flex items-center pl-5 pr-3 cursor-text z-10 border border-[var(--line)] focus-within:border-[var(--blue)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_22%,transparent)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_12px_30px_-6px_rgba(0,0,0,0.10),0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.65)]">
        <div className="absolute inset-0 rounded-full pointer-events-none shadow-[inset_0_1px_1.5px_0_rgba(255,255,255,1),inset_0_-1px_1px_0_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]" />
        {ripples.map(r => (
          <motion.span key={r.id} initial={{ scale: 0, opacity: 0.7 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute rounded-full pointer-events-none bg-black/[0.08] dark:bg-white/20" style={{ left: r.x - 30, top: r.y - 30, width: 60, height: 60 }} />
        ))}
        {/* 放大镜 ⇄ 光标 形变 */}
        <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0 mr-2.5" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-6 h-6 overflow-visible" fill="none">
            <motion.g style={{ transformOrigin: '11px 11px' }}
              animate={isMorphedToCaret ? { rotate: -45, scaleX: 0.08, scaleY: 1.35, x: -0.5 } : { rotate: 0, scaleX: 1, scaleY: 1, x: 0 }}
              transition={spring}>
              <motion.circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                animate={isMorphedToCaret && !reduce ? { opacity: [1, 1, 0, 0, 1] } : { opacity: 1 }}
                transition={isMorphedToCaret && !reduce ? { opacity: { repeat: Infinity, duration: 1.0, delay: 0.35, ease: 'easeInOut', times: [0, 0.45, 0.5, 0.95, 1] } } : { duration: 0.15 }} />
            </motion.g>
            <motion.line stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              animate={isMorphedToCaret ? { x1: 15.5, y1: 15.5, x2: 15.5, y2: 15.5, opacity: 0 } : { x1: 15.8, y1: 15.8, x2: 20.8, y2: 20.8, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 28 }} />
          </svg>
        </div>
        <input ref={inputRef} type="search" value={query} role="combobox" aria-expanded={showList} aria-controls={listId}
          aria-label={inputLabel} autoComplete="off" enterKeyHint="search"
          onChange={e => { setQuery(e.target.value); setCur(0); setOpen(true) }}
          onFocus={() => { setIsActive(true); setOpen(true) }}
          onBlur={() => { if (!query) setIsActive(false) }}
          onKeyDown={onKey} placeholder={placeholder}
          style={{ caretColor: query ? 'var(--ink)' : 'transparent' }}
          className="flex-1 min-w-0 h-full bg-transparent font-medium outline-none focus-visible:outline-none text-[16px] tracking-normal placeholder:text-[var(--ink3)] [&::-webkit-search-cancel-button]:hidden" />
        {query && (
          <button type="button" aria-label="清空"
            onClick={e => { e.stopPropagation(); setQuery(''); inputRef.current?.focus() }}
            className="w-11 h-11 -mr-1 rounded-full flex items-center justify-center text-[18px] text-[var(--ink2)] hover:text-[var(--ink)]">
            <span className="w-6 h-6 rounded-full grid place-items-center bg-[var(--surface2)]">×</span>
          </button>
        )}
      </motion.div>

      {slot}
      {showList && (
        <div className={`${dropdown ? 'absolute left-0 right-0 top-[calc(100%+8px)] z-40 shadow-[var(--sh2)] max-h-[min(62vh,560px)] overflow-auto' : 'mt-3 shadow-[var(--sh)]'} p-2 rounded-[22px] bg-[var(--surface)] border border-[var(--line)] ${listClassName}`}>
        <ul id={listId} role="listbox" aria-label="搜索结果" className="list-none m-0 p-0">
          {results.length ? results.map((r, i) => {
            const x = r.x
            const lv = levelBy?.[x.level]
            const th = r.snip?.title || {}
            return (
              <li key={x.slug} role="option" aria-selected={i === cur} data-field={r.f}>
                <button type="button" onMouseEnter={() => setCur(i)} onClick={() => go(r)}
                  className={`${lv?.cls || ''} w-full flex items-center gap-3 p-2.5 rounded-2xl text-left ${i === cur ? 'bg-[var(--sky)]' : 'hover:bg-[var(--surface2)]'}`}>
                  <span className="emo text-[24px] w-11 h-11 grid place-items-center rounded-[14px] bg-[var(--accs)] flex-none">{x.emoji}</span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <b className="block text-[16px] truncate"><Hl text={x.zh} hl={th.zh} />{done?.has(x.slug) ? ' ✅' : ''}</b>
                    {r.snip?.text ? (
                      <small className="flex items-center gap-1.5 text-[13px] text-[var(--ink2)] min-w-0">
                        <FieldChip r={r} />
                        <Hl text={r.snip.text} hl={r.snip.hl} className={`truncate min-w-0 ${r.snip.mono ? 'font-mono text-[12.5px]' : ''}`} />
                      </small>
                    ) : (
                      <small className="flex items-center gap-1.5 text-[13px] text-[var(--ink2)] min-w-0">
                        {r.f !== 'title' || th.zh || th.en ? <FieldChip r={r} /> : null}
                        <span className="truncate min-w-0"><Hl text={x.en} hl={th.en} /> · {x.oneLiner}</span>
                      </small>
                    )}
                  </span>
                  <span className="lvb flex-none hidden sm:inline-flex">{lv?.emoji} {x.level}</span>
                </button>
              </li>
            )
          }) : <li className="p-3.5 text-[15px] text-[var(--ink2)]">{ft ? '没找到。换个说法，或者试试英文、拼音 🙂' : '正在加载全文索引…'}</li>}
        </ul>
        {showFull && (
          <button type="button" data-testid="search-all" data-active={cur === results.length} onMouseEnter={() => setCur(results.length)} onClick={() => go('all')}
            className={`mt-1 w-full flex items-center justify-between gap-3 px-3.5 min-h-[48px] rounded-2xl text-left text-[15px] font-bold text-[var(--blue-d)] border-t border-[var(--line)] ${cur === results.length ? 'bg-[var(--sky)]' : 'hover:bg-[var(--surface2)]'}`}>
            <span>查看全部 {all.length} 条结果</span><span aria-hidden="true">→</span>
          </button>
        )}
        {!ft && results.length > 0 && <p className="m-0 px-3.5 pb-1 pt-1 text-[12px] text-[var(--ink3)]" aria-hidden="true">全文索引加载中，正文 / 代码命中马上就来…</p>}
        </div>
      )}
    </div>
  )
}
