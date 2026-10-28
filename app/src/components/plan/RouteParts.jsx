// AI 规划 / 我的项目 共用的小部件：概念卡、阶段卡、复制按钮、确认弹窗、AI 配置弹窗、生成中动画
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Copy, Hammer, Target, Flag, X, Settings2, Eye, EyeOff } from 'lucide-react'
import { copyText } from '../../lib/fx'
import { AI_PRESETS, useAiConfig, saveAiConfig, isLocalEndpoint } from '../../lib/planner'
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

export function AiConfigDialog({ open, onClose, onSaved }) {
  const cfg = useAiConfig()
  const [baseUrl, setBaseUrl] = useState(cfg.baseUrl)
  const [apiKey, setApiKey] = useState(cfg.apiKey)
  const [model, setModel] = useState(cfg.model)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) {
      setBaseUrl(cfg.baseUrl)
      setApiKey(cfg.apiKey)
      setModel(cfg.model)
      setShowKey(false)
    }
  }, [open, cfg.baseUrl, cfg.apiKey, cfg.model])

  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open, onClose])

  if (!open) return null

  const local = isLocalEndpoint(baseUrl)
  const canSave = !!baseUrl.trim() && !!model.trim() && (local || !!apiKey.trim())

  function handleSave(e) {
    e.preventDefault()
    if (!canSave) return
    const saved = saveAiConfig({ baseUrl, apiKey, model })
    onSaved ? onSaved(saved) : onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-end sm:place-items-center bg-black/40 p-3" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSave} role="dialog" aria-modal="true" aria-label="配置 AI 接口" data-testid="ai-config-dialog"
        className="w-full max-w-[540px] max-h-[90vh] overflow-y-auto bg-[var(--surface)] rounded-[24px] shadow-[var(--sh2)] border border-[var(--line)] p-5 grid gap-3.5"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <b className="text-[19px] flex items-center gap-2"><Settings2 size={19} />配置你自己的 AI 接口</b>
            <p className="text-[13px] text-[var(--ink2)] m-0 mt-1 leading-relaxed">
              支持任何 OpenAI 兼容接口（`/v1/chat/completions`）。密钥只存在你当前浏览器的 `localStorage` 里，不会上传到任何第三方服务器。
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-10 h-10 -mt-1 -mr-1 grid place-items-center rounded-full bg-[var(--surface2)] flex-none"><X size={17} /></button>
        </div>

        <div>
          <span className="block text-[13px] font-bold text-[var(--ink2)] mb-1.5">快速选择常见服务商：</span>
          <div className="flex flex-wrap gap-1.5">
            {AI_PRESETS.map(p => {
              const active = baseUrl.trim().replace(/\/+$/, '') === p.baseUrl
              return (
                <button key={p.id} type="button"
                  onClick={() => { setBaseUrl(p.baseUrl); setModel(p.model) }}
                  className={`min-h-[34px] px-3 rounded-full text-[13px] font-bold border transition-colors ${active ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface2)] border-[var(--line)] hover:border-[var(--ink3)]'}`}>
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="grid gap-1">
          <span className="text-[14px] font-bold">API 地址 (Base URL)</span>
          <input type="url" required value={baseUrl} onChange={e => setBaseUrl(e.target.value)} data-testid="ai-base-url"
            placeholder="https://api.deepseek.com/v1"
            className="h-11 px-3.5 rounded-xl bg-[var(--surface2)] border-2 border-transparent focus:border-[var(--blue)] outline-none text-[15px] font-mono" />
        </label>

        <label className="grid gap-1">
          <span className="text-[14px] font-bold">API Key {local && <span className="font-normal text-[var(--ink3)]">（本地接口可留空）</span>}</span>
          <div className="relative flex items-center">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} data-testid="ai-api-key"
              placeholder={local ? '本地 Ollama 可不填' : 'sk-...'}
              className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--surface2)] border-2 border-transparent focus:border-[var(--blue)] outline-none text-[15px] font-mono" />
            <button type="button" onClick={() => setShowKey(s => !s)} aria-label={showKey ? '隐藏密钥' : '显示密钥'}
              className="absolute right-2 w-8 h-8 grid place-items-center rounded-lg text-[var(--ink2)] hover:bg-[var(--surface)]">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-[14px] font-bold">模型名称 (Model)</span>
          <input type="text" required value={model} onChange={e => setModel(e.target.value)} data-testid="ai-model"
            placeholder="deepseek-chat / gpt-4o-mini / qwen-plus"
            className="h-11 px-3.5 rounded-xl bg-[var(--surface2)] border-2 border-transparent focus:border-[var(--blue)] outline-none text-[15px] font-mono" />
        </label>

        <div className="flex items-center justify-between gap-2 pt-2">
          <button type="button" className="text-[13px] text-[var(--ink3)] hover:text-[#D93A2B] font-semibold"
            onClick={() => { setApiKey(''); saveAiConfig({ baseUrl, apiKey: '', model }) }}>
            清空已存密钥
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-soft !min-h-[44px]" onClick={onClose}>取消</button>
            <button type="submit" data-testid="ai-save" disabled={!canSave} className="btn btn-pri !min-h-[44px] disabled:opacity-45">保存配置</button>
          </div>
        </div>
      </form>
    </div>
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
          <small className="block text-[13px] text-[var(--ink3)] mt-1">一般 5–20 秒</small>
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

export function ErrorCard({ message, onRetry, retryable = true, onConfig }) {
  return (
    <div role="alert" data-testid="plan-error" className="card p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-3 border-2 border-[color-mix(in_srgb,#D93A2B_35%,transparent)]">
      <span className="emo text-[32px]" aria-hidden="true">😵</span>
      <p className="m-0 flex-1 text-[16px] leading-relaxed">{message}</p>
      <div className="flex gap-2 flex-none">
        {onConfig && <button type="button" className="btn btn-pri !min-h-[46px]" data-testid="plan-config-btn" onClick={onConfig}><Settings2 size={17} />配置 AI</button>}
        {retryable && onRetry && <button type="button" className="btn btn-pri !min-h-[46px]" data-testid="plan-retry" onClick={onRetry}>再试一次</button>}
      </div>
    </div>
  )
}
