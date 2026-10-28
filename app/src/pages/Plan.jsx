// #/plan：AI 帮我规划 + 6 条官方精选实战路线。免 Key 可直接选模板或预览；自配 AI 可定制任意专属项目路线
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, RotateCcw, FolderPlus, PencilLine, FolderKanban, Settings2 } from 'lucide-react'
import { useApp } from '../App'
import {
  requestPlan, errorText, canRetry, needsAiSetup, createProject, useProjects,
  useAiConfig, isAiConfigured, LEVEL_OPTS, HOURS_OPTS, EXAMPLES, MAX_PROJECT,
} from '../lib/planner'
import { StageCard, PlanLoading, ErrorCard, AiConfigDialog, TemplateGrid } from '../components/plan/RouteParts'

const DRAFT = 'aig:plan-draft'
const loadDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT)) || {} } catch { return {} } }

export default function Plan() {
  const { idx, done, prefs } = useApp()
  const nav = useNavigate()
  const projects = useProjects()
  const aiCfg = useAiConfig()
  const configured = isAiConfigured(aiCfg)
  const draft = useRef(loadDraft()).current
  const [text, setText] = useState(draft.text || '')
  const [level, setLevel] = useState(draft.level || null)
  const [hours, setHours] = useState(draft.hours || null)
  const [state, setState] = useState(draft.result ? { st: 'done', result: draft.result, req: draft.req, templateId: draft.templateId || null } : { st: 'idle' })
  const [cfgOpen, setCfgOpen] = useState(false)
  const pendingReqRef = useRef(null)
  const abortRef = useRef(null)
  const resultRef = useRef(null)
  const taRef = useRef(null)
  useEffect(() => { document.title = 'AI 帮我规划 · AI 造物指南' }, [])
  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify({
        text, level, hours,
        ...(state.st === 'done' ? { result: state.result, req: state.req, templateId: state.templateId || null } : {}),
      }))
    } catch { /* 忽略 */ }
  }, [text, level, hours, state])

  const len = [...text].length
  const tooLong = len > MAX_PROJECT
  const busy = state.st === 'loading'

  async function generate(req = { project: text.trim(), level, hours }, skipCfgCheck = false) {
    if (!req.project || [...req.project].length > MAX_PROJECT || busy) return
    if (!skipCfgCheck && !isAiConfigured()) {
      pendingReqRef.current = req
      setCfgOpen(true)
      return
    }
    abortRef.current?.abort()
    const ctl = new AbortController(); abortRef.current = ctl
    setState({ st: 'loading', req })
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: prefs.still ? 'auto' : 'smooth', block: 'start' }))
    try {
      const data = await requestPlan({ project: req.project, ...(req.level ? { level: req.level } : {}), ...(req.hours ? { hours: req.hours } : {}) }, { signal: ctl.signal })
      if (ctl.signal.aborted) return
      setState({ st: 'done', result: data.route, req, templateId: null, remaining: data.remaining })
    } catch (e) {
      if (e.code === 'aborted') return
      setState({ st: 'error', error: e, req })
    }
  }

  function previewTemplate(tpl) {
    abortRef.current?.abort()
    setState({ st: 'done', result: tpl.route, req: tpl.input, templateId: tpl.id })
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: prefs.still ? 'auto' : 'smooth', block: 'start' }))
  }

  function create() {
    const p = createProject(state.result, state.req, state.templateId ? { templateId: state.templateId } : {})
    try { sessionStorage.removeItem(DRAFT) } catch { /* 忽略 */ }
    nav('/projects/' + p.id)
  }

  const route = state.st === 'done' ? state.result : null
  const allConcepts = route ? route.stages.flatMap(s => s.concepts) : []
  const isTplPreview = !!state.templateId

  return (
    <div className="max-w-[1080px] mx-auto px-3.5 lg:px-6 pt-4 lg:pt-7 pb-6 grid grid-cols-1 gap-5 lg:gap-6 [&>*]:min-w-0">
      {/* 输入区 */}
      <section className="card relative p-5 pt-6 lg:p-9 bg-[linear-gradient(140deg,var(--surface)_50%,var(--lilac))]" aria-labelledby="h-plan">
        <div className="orbs" aria-hidden="true"><i /><i /><i /></div>
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="chip-tag !bg-[var(--surface)]/80 backdrop-blur">
              <span className="emo">✨</span>AI 帮我规划{configured ? ` · ${aiCfg.model}` : ' · 支持自配 AI 或直接选下方精选路线'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { pendingReqRef.current = null; setCfgOpen(true) }} data-testid="open-ai-config"
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-[14px] font-bold transition-colors ${configured ? 'bg-[var(--surface)]/85 hover:bg-[var(--surface)] text-[var(--ink)]' : 'bg-[var(--ink)] text-[var(--bg)]'}`}>
                <Settings2 size={16} />{configured ? 'AI 设置' : '配置 AI 接口'}
              </button>
              {projects.length > 0 && (
                <Link to="/projects" className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full bg-[var(--surface)]/85 text-[14px] font-bold no-underline hover:bg-[var(--surface)]" data-testid="to-projects">
                  <FolderKanban size={16} />我的项目 {projects.length}
                </Link>
              )}
            </div>
          </div>
          <h1 id="h-plan" className="text-[30px] lg:text-[46px] leading-[1.12] font-black mt-4 mb-2">你想做个什么？</h1>
          <p className="text-[15px] lg:text-[18px] text-[var(--ink2)] m-0 mb-4 lg:mb-5">用大白话说说你的想法，让自配 AI 定制专属路线；或者直接在下方挑一条精选实战路线马上开干。</p>

          <label htmlFor="plan-input" className="sr-only">描述你想做的项目</label>
          <div className={`rounded-[22px] bg-[var(--surface)] border-2 transition-colors ${tooLong ? 'border-[#D93A2B]' : 'border-[var(--line)] focus-within:border-[var(--blue)]'} shadow-[var(--sh)]`}>
            <textarea id="plan-input" ref={taRef} data-testid="plan-input" value={text} onChange={e => setText(e.target.value)} rows={4}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
              placeholder="比如：做一个能记账的微信小程序，每天记花了多少钱，月底看统计图"
              className="block w-full resize-y min-h-[110px] max-h-[360px] bg-transparent outline-none px-4 pt-3.5 pb-1 text-[17px] leading-relaxed placeholder:text-[var(--ink3)]" />
            <div className="flex items-center justify-end px-4 pb-2.5">
              <span className={`text-[13px] tabular ${tooLong ? 'text-[#D93A2B] font-bold' : 'text-[var(--ink3)]'}`} aria-live="polite">{len} / {MAX_PROJECT}{tooLong ? ' · 太长了' : ''}</span>
            </div>
          </div>
          <div className="flex lg:flex-wrap items-center gap-2 mt-3 -mx-5 px-5 lg:mx-0 lg:px-0 overflow-x-auto no-scrollbar" aria-label="例子">
            <span className="text-[13px] text-[var(--ink3)] flex-none">试试：</span>
            {EXAMPLES.map(t => (
              <button key={t} type="button" onClick={() => { setText(t); taRef.current?.focus() }}
                className="flex-none min-h-[40px] px-3.5 rounded-full bg-[var(--surface2)]/90 hover:bg-[var(--sky)] text-[14px] font-semibold whitespace-nowrap">{t}</button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-3 lg:gap-6 mt-5">
            <fieldset className="min-w-0">
              <legend className="text-[14px] font-bold mb-2">现在的水平 <span className="font-normal text-[var(--ink3)]">（可选）</span></legend>
              <div className="flex gap-2" role="radiogroup" aria-label="现在的水平">
                {LEVEL_OPTS.map(o => (
                  <button key={o.id} type="button" role="radio" aria-checked={level === o.id} data-testid={'level-' + o.id} onClick={() => setLevel(v => v === o.id ? null : o.id)}
                    className={`flex-1 min-w-0 min-h-[48px] px-2 rounded-2xl text-[15px] font-bold border-2 transition-colors whitespace-nowrap ${level === o.id ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--ink3)]'}`}>
                    <span className="emo mr-1">{o.emoji}</span>{o.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="text-[14px] font-bold mb-2">每周能花多少时间 <span className="font-normal text-[var(--ink3)]">（可选）</span></legend>
              <div className="flex gap-2" role="radiogroup" aria-label="每周时间">
                {HOURS_OPTS.map(h => (
                  <button key={h} type="button" role="radio" aria-checked={hours === h} data-testid={'hours-' + h} onClick={() => setHours(v => v === h ? null : h)}
                    className={`flex-1 min-w-0 min-h-[48px] px-1 rounded-2xl text-[15px] font-bold border-2 transition-colors whitespace-nowrap tabular ${hours === h ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--ink3)]'}`}>
                    {h} 小时
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button type="button" data-testid="plan-generate" onClick={() => generate()} disabled={!text.trim() || tooLong || busy}
              className="btn btn-pri !min-h-[54px] !px-8 !text-[17px] disabled:opacity-45 disabled:cursor-not-allowed w-full sm:w-auto">
              <Sparkles size={19} />{busy ? '正在生成…' : route && !isTplPreview ? '重新生成路线' : '让 AI 定制路线'}
            </button>
            <small className="text-[13px] text-[var(--ink3)] leading-relaxed">
              {configured
                ? `当前模型：${aiCfg.model} · AI 只从站内 ${idx.items.length} 个概念里挑，密钥与路线只存在你的浏览器里。`
                : `定制路线需配置你自己的 AI 接口密钥（DeepSeek / OpenAI / 硅基流动 / 本地 Ollama 等）；不想配密钥可直接选下方精选路线。`}
            </small>
          </div>
        </div>
      </section>

      {/* 官方精选实战路线库（免配置） */}
      {!busy && (
        <TemplateGrid
          done={done}
          projects={projects}
          activeId={state.templateId}
          onPreview={previewTemplate}
        />
      )}

      {/* 结果区 */}
      <div ref={resultRef} className="scroll-mt-20 lg:scroll-mt-6 grid gap-4 lg:gap-5">
        {state.st === 'loading' && <PlanLoading still={prefs.still} />}
        {state.st === 'error' && (
          <ErrorCard
            message={errorText(state.error)}
            retryable={canRetry(state.error)}
            onRetry={() => generate(state.req)}
            onConfig={needsAiSetup(state.error) ? () => { pendingReqRef.current = state.req; setCfgOpen(true) } : undefined}
          />
        )}
        {route && (
          <>
            <section className="card p-5 lg:p-7 bg-[linear-gradient(150deg,var(--pist),var(--surface)_70%)]" data-testid="plan-result" aria-labelledby="h-route">
              <span className="chip-tag !bg-[var(--surface)]/80">
                <span className="emo">{isTplPreview ? '🎁' : '🗺️'}</span>
                {isTplPreview ? '精选实战路线预览' : '你的专属学习路线'}
              </span>
              <h2 id="h-route" className="m-0 mt-3 text-[26px] lg:text-[34px] font-black leading-tight">{route.name}</h2>
              {route.goal && <p className="m-0 mt-2 text-[16px] lg:text-[18px] text-[var(--ink2)] leading-relaxed">{route.goal}</p>}
              <div className="flex flex-wrap gap-2 mt-4 text-[14px] font-semibold">
                <span className="chip-tag !bg-[var(--surface)]">{route.stages.length} 个阶段</span>
                <span className="chip-tag !bg-[var(--surface)]">{allConcepts.length} 个概念</span>
                <span className="chip-tag !bg-[var(--surface)]">已学会 {allConcepts.filter(s => done.has(s)).length} 个</span>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <button type="button" className="btn btn-pri !min-h-[52px] flex-1 sm:flex-none" data-testid="plan-create" onClick={create}>
                  <FolderPlus size={19} />加入我的项目并开始伴学
                </button>
                {!isTplPreview && (
                  <button type="button" className="btn btn-soft !min-h-[52px]" onClick={() => generate(state.req)}><RotateCcw size={17} />重新生成</button>
                )}
                <button type="button" className="btn btn-soft !min-h-[52px]" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => taRef.current?.focus(), 300) }}>
                  <PencilLine size={17} />{isTplPreview ? '自己写想法定制' : '改描述'}
                </button>
              </div>
            </section>
            {route.stages.map((s, i) => <StageCard key={i} stage={s} i={i} total={route.stages.length} idx={idx} done={done} />)}
            <div className="flex justify-center">
              <button type="button" className="btn btn-pri !min-h-[54px] !px-8" onClick={create}><FolderPlus size={19} />加入我的项目并开始伴学</button>
            </div>
          </>
        )}
      </div>

      <AiConfigDialog
        open={cfgOpen}
        onClose={() => { pendingReqRef.current = null; setCfgOpen(false) }}
        onSaved={() => {
          setCfgOpen(false)
          const req = pendingReqRef.current
          pendingReqRef.current = null
          if (req) generate(req, true)
        }}
      />
    </div>
  )
}
