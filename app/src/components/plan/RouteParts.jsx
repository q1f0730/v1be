// AI 规划 / 我的项目 共用的小部件：概念卡、阶段卡、复制按钮、确认弹窗、生成中动画
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Copy, Hammer, Target, Flag, X } from 'lucide-react'
import { copyText } from '../../lib/fx'
import Skeleton from '../rw/Skeleton'

export function ConceptCard({ x, lv, learned, order }) {
  if (!x) return null
  return (
    <Link to={'/c/' + x.slug} data-testid="route-concept" data-learned={learned ? '1' : '0'}
      className={`${lv?.cls || ''} group relative flex items-center gap-3 min-h-[64px] p-2.5 pr-3 rounded-2xl no-underline border transition-[transform,background] hover:-translate-y-0.5 ${learned ? 'bg-[var(--accs)] border-[color-mix(in_srgb,var(--acc)_30%,transparent)]' : 'bg-[var(--surface2)] border-transparent hover:bg-[var(--surface3)]'}`}>
      <span className="emo text-[24px] w-11 h-11 grid place-items-center rounded-xl bg-[var(--surface)] flex-none shadow-[var(--sh)]">{x.emoji}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-snug clamp2 group-hover:text-[var(--blue)]">{x.zh}</b>
        <small className="flex items-center gap-1.5 text-[12px] text-[var(--ink2)] mt-0.5">
          {order != null && <span className="tabular">{order}.</span>}
          <span className="font-bold text-[var(--acci)]">{lv?.emoji} {x.level}</span>
        </small>
      </span>
      {learned
        ? <span className="flex-none w-7 h-7 rounded-full grid place-items-center bg-[#1E7F45] text-white" aria-label="已学会" title="已学会"><Check size={16} strokeWidth={3} /></span>
        : <span className="flex-none w-7 h-7 rounded-full border-2 border-[var(--line)]" aria-label="还没学" title="还没学" />}
    </Link>
  )
}

export function CopyButton({ text, label = '复制指令', className = '', testid = 'copy-prompt' }) {
  const [ok, setOk] = useState(false)
  const t = useRef(0)
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <button type="button" data-testid={testid} onClick={async () => { if (await copyText(text)) { setOk(true); clearTimeout(t.current); t.current = setTimeout(() => setOk(false), 1800) } }}
      className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-bold transition-colors flex-none ${ok ? 'bg-[#1E7F45] text-white' : 'bg-white/12 text-white hover:bg-white/20'} ${className}`}>
      {ok ? <Check size={16} strokeWidth={3} /> : <Copy size={15} />}{ok ? '已复制' : label}
    </button>
  )
}

// 一个阶段的完整内容。project 模式下动手任务可以勾选
export function StageCard({ stage, i, total, idx, done, taskDone, onToggleTask, complete, compact }) {
  const items = stage.concepts.map(s => idx.bySlug[s]).filter(Boolean)
  const learned = items.filter(x => done.has(x.slug)).length
  return (
    <article className="card p-4 lg:p-7 flex flex-col gap-4 lg:gap-5" data-testid="stage-card" aria-label={`阶段 ${i + 1}：${stage.title}`}>
      <header className="flex items-start gap-3">
        <span className={`flex-none w-11 h-11 lg:w-12 lg:h-12 rounded-2xl grid place-items-center text-[18px] font-black tabular ${complete ? 'bg-[#1E7F45] text-white' : 'bg-[var(--ink)] text-[var(--bg)]'}`}>
          {complete ? <Check size={22} strokeWidth={3} /> : i + 1}
        </span>
        <div className="min-w-0 flex-1">
          <small className="block text-[13px] text-[var(--ink3)] font-semibold">阶段 {i + 1} / {total}{complete ? ' · 已完成' : ''}</small>
          <h3 className="m-0 text-[20px] lg:text-[24px] font-extrabold leading-snug">{stage.title}</h3>
        </div>
      </header>
      {stage.goal && <p className="m-0 flex gap-2 text-[16px] leading-relaxed text-[var(--ink2)]"><Target size={18} className="flex-none mt-[5px] text-[var(--blue)]" /><span>{stage.goal}</span></p>}

      <section aria-label="要学的概念">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <b className="text-[15px]"><span className="emo mr-1">📚</span>先学这 {items.length} 个概念</b>
          <span className="text-[13px] text-[var(--ink2)] tabular" data-testid="stage-learned">已学会 {learned}/{items.length}</span>
        </div>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
          {items.map((x, k) => <ConceptCard key={x.slug} x={x} lv={idx.levelBy[x.level]} learned={done.has(x.slug)} order={k + 1} />)}
        </div>
      </section>

      <section aria-label="动手任务" className="rounded-2xl bg-[linear-gradient(150deg,var(--lemon),var(--surface2))] p-3.5 lg:p-4">
        <b className="flex items-center gap-1.5 text-[15px] mb-1.5"><Hammer size={17} />动手做</b>
        {onToggleTask ? (
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input type="checkbox" data-testid="task-check" checked={!!taskDone} onChange={onToggleTask}
              className="mt-0.5 w-6 h-6 flex-none accent-[#1E7F45] cursor-pointer" />
            <span className={`text-[16px] leading-relaxed ${taskDone ? 'line-through text-[var(--ink3)]' : ''}`}>{stage.task}</span>
          </label>
        ) : <p className="m-0 text-[16px] leading-relaxed">{stage.task}</p>}
      </section>

      {stage.prompt && (
        <section aria-label="复制给 AI 的指令" className="codebox">
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <span className="text-[13px] font-bold text-white/70"><span className="emo mr-1">🤖</span>复制给 AI 编程工具</span>
            <CopyButton text={stage.prompt} />
          </div>
          <p className="m-0 px-4 pt-2 pb-4 text-[15px] leading-[1.7] whitespace-pre-wrap break-words">{stage.prompt}</p>
        </section>
      )}

      {stage.done_when && (
        <p className="m-0 flex gap-2 text-[15px] leading-relaxed"><Flag size={17} className="flex-none mt-[4px] text-[#1E7F45]" /><span><b>完成标准：</b>{stage.done_when}</span></p>
      )}
    </article>
  )
}

export function ConfirmDialog({ open, title, body, okText = '确定', danger, onOk, onCancel, children }) {
  const reduce = useReducedMotion()
  const okRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') onCancel() }
    addEventListener('keydown', k); setTimeout(() => okRef.current?.focus(), 30)
    return () => removeEventListener('keydown', k)
  }, [open, onCancel])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[120] grid place-items-end sm:place-items-center bg-black/40 p-3" role="presentation"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
          <motion.div role="alertdialog" aria-modal="true" aria-label={title} data-testid="confirm-dialog"
            initial={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="w-full max-w-[420px] bg-[var(--surface)] rounded-[24px] shadow-[var(--sh2)] border border-[var(--line)] p-5"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-start justify-between gap-3">
              <b className="text-[18px] leading-snug">{title}</b>
              <button type="button" onClick={onCancel} aria-label="关闭" className="w-10 h-10 -mt-1 -mr-1 grid place-items-center rounded-full bg-[var(--surface2)] flex-none"><X size={17} /></button>
            </div>
            {body && <p className="text-[15px] text-[var(--ink2)] leading-relaxed mt-2 mb-0">{body}</p>}
            {children}
            <div className="flex gap-2 justify-end mt-5">
              <button type="button" className="btn btn-soft !min-h-[46px]" onClick={onCancel}>取消</button>
              <button type="button" ref={okRef} data-testid="confirm-ok" className={`btn !min-h-[46px] ${danger ? 'bg-[#D93A2B] text-white hover:bg-[#B92E21]' : 'btn-pri'}`} onClick={onOk}>{okText}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const STEPS = ['读懂你的想法…', '从 500 个概念里挑要学的…', '按难度排顺序…', '拆成一步一步的任务…', '写给 AI 的开发指令…']
export function PlanLoading({ still }) {
  const [k, setK] = useState(0)
  useEffect(() => { const t = setInterval(() => setK(v => Math.min(v + 1, STEPS.length - 1)), 2200); return () => clearInterval(t) }, [])
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite" data-testid="plan-loading">
      <div className="card p-5 lg:p-7 flex items-center gap-4">
        <span className={`emo text-[36px] ${still ? '' : 'animate-bounce'}`} aria-hidden="true">🧭</span>
        <div className="min-w-0 flex-1">
          <b className="block text-[18px]">AI 正在规划路线</b>
          <AnimatePresence mode="wait">
            <motion.span key={k} className="block text-[15px] text-[var(--ink2)]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{STEPS[k]}</motion.span>
          </AnimatePresence>
          <small className="block text-[13px] text-[var(--ink3)] mt-1">一般 5–15 秒</small>
        </div>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="card p-5 lg:p-7 grid gap-3">
          <div className="flex gap-3 items-center"><Skeleton className="w-12 h-12 rounded-2xl" /><Skeleton className="h-6 w-1/2" /></div>
          <Skeleton className="h-4 w-4/5" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl hidden sm:block" /></div>
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

export function ErrorCard({ message, onRetry, retryable = true }) {
  return (
    <div role="alert" data-testid="plan-error" className="card p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-3 border-2 border-[color-mix(in_srgb,#D93A2B_35%,transparent)]">
      <span className="emo text-[32px]" aria-hidden="true">😵</span>
      <p className="m-0 flex-1 text-[16px] leading-relaxed">{message}</p>
      {retryable && onRetry && <button type="button" className="btn btn-pri !min-h-[46px] flex-none" data-testid="plan-retry" onClick={onRetry}>再试一次</button>}
    </div>
  )
}
