// #/projects 我的项目列表；#/projects/:id 项目详情（进度、按阶段一张一张看、勾任务、复制指令、重命名、删除、导出、让 AI 调整）
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Download, Pencil, Trash2, Wand2, Sparkles, Check, Plus, Rows3, GalleryHorizontal, Settings2 } from 'lucide-react'
import { useApp } from '../App'
import { useMedia } from '../lib/useMedia'
import {
  useProjects, updateProject, deleteProject, toggleTask, replaceRoute, progress, stageState, nextConcept, currentStage,
  toMarkdown, downloadText, requestPlan, errorText, canRetry, needsAiSetup, isAiConfigured, LEVEL_OPTS, MAX_ADJUST,
} from '../lib/planner'
import { StageCard, ConfirmDialog, ErrorCard, AiConfigDialog } from '../components/plan/RouteParts'
import FlipDeck from '../components/rw/FlipDeck'
import Skeleton from '../components/rw/Skeleton'
import mascotSm from '../assets/mascot-sm.webp'

const fmtDate = t => new Date(t).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

export default function Projects() {
  const { id } = useParams()
  return id ? <ProjectDetail key={id} id={id} /> : <ProjectList />
}

function ProjectList() {
  const { idx, done } = useApp()
  const projects = useProjects()
  useEffect(() => { document.title = '我的项目 · AI 造物指南' }, [])
  return (
    <div className="max-w-[1080px] mx-auto px-3.5 lg:px-6 pt-4 lg:pt-7 pb-6 grid grid-cols-1 gap-4 lg:gap-5 [&>*]:min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip-tag"><span className="emo">🗂️</span>只存在你的浏览器里</span>
          <h1 className="m-0 mt-3 text-[30px] lg:text-[40px] font-black leading-tight">我的项目</h1>
        </div>
        <Link to="/plan" className="btn btn-pri !min-h-[48px]" data-testid="new-plan"><Plus size={18} />规划新项目</Link>
      </header>
      {projects.length === 0 ? (
        <div className="card p-8 text-center grid justify-items-center gap-2" data-testid="projects-empty">
          <img src={mascotSm} alt="" width="80" height="80" className="w-20 h-20 rounded-3xl" />
          <b className="text-[20px]">还没有项目</b>
          <p className="m-0 text-[var(--ink2)]">说说你想做什么，AI 帮你排好学习路线。</p>
          <Link to="/plan" className="btn btn-pri mt-2"><Sparkles size={18} />AI 帮我规划</Link>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-3.5 lg:gap-5 sm:grid-cols-2">
          {projects.map(p => {
            const pr = progress(p, done)
            const nx = nextConcept(p, done); const nxi = nx && idx.bySlug[nx]
            const cs = currentStage(p, done)
            return (
              <li key={p.id}>
                <Link to={'/projects/' + p.id} data-testid="project-card" className="card h-full p-5 lg:p-6 flex flex-col gap-3 no-underline hover:-translate-y-1 transition-transform">
                  <div className="flex items-start justify-between gap-3">
                    <b className="text-[20px] leading-snug min-w-0 break-words">{p.name}</b>
                    <span className="text-[26px] font-black tabular leading-none text-[var(--blue)] flex-none">{pr.pct}%</span>
                  </div>
                  {p.route.goal && <p className="m-0 text-[15px] text-[var(--ink2)] leading-relaxed clamp2">{p.route.goal}</p>}
                  <div className="pbar" style={{ '--acc': pr.pct === 100 ? '#1E7F45' : 'var(--blue)' }}><i style={{ width: pr.pct + '%' }} /></div>
                  <p className="m-0 text-[14px] text-[var(--ink2)] leading-snug">
                    {pr.stagesDone === pr.stages ? '🎉 全部完成' : <>正在 <b className="text-[var(--ink)]">阶段 {cs + 1}：{p.route.stages[cs].title}</b></>}
                  </p>
                  <div className="mt-auto pt-1 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-[13px] text-[var(--ink3)] [&>*]:max-w-full">
                    <span>{fmtDate(p.createdAt)} 创建 · {pr.stagesDone}/{pr.stages} 阶段</span>
                    {nxi && <span className="truncate min-w-0">下一个：<span className="emo">{nxi.emoji}</span> {nxi.zh}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ProjectDetail({ id }) {
  const { idx, done, prefs } = useApp()
  const projects = useProjects()
  const p = projects.find(x => x.id === id)
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const isMobile = useMedia('(max-width:1023px)')
  const [all, setAll] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const pName = p?.name
  useEffect(() => { if (pName) document.title = pName + ' · 我的项目' }, [pName])

  const total = p?.route.stages.length || 0
  const sParam = sp.get('s')
  const sIdx = p ? Math.min(total - 1, Math.max(0, sParam == null ? currentStage(p, done) : (+sParam || 1) - 1)) : 0
  const go = useCallback(i => setSp(prev => { const n = new URLSearchParams(prev); n.set('s', String(i + 1)); return n }, { replace: true }), [setSp])
  const goPrev = useCallback(() => sIdx > 0 && go(sIdx - 1), [sIdx, go])
  const goNext = useCallback(() => sIdx < total - 1 && go(sIdx + 1), [sIdx, total, go])

  useEffect(() => {
    if (all) return
    const k = e => {
      if (e.target.closest?.('input,textarea,[contenteditable],[role=dialog],[role=alertdialog]')) return
      if (e.key === 'ArrowRight') goNext(); if (e.key === 'ArrowLeft') goPrev()
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [goNext, goPrev, all])

  if (!p) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center" data-testid="project-missing">
        <img src={mascotSm} alt="" width="96" height="96" className="w-24 h-24 rounded-3xl mx-auto mb-3" />
        <p className="text-[22px] font-extrabold m-0">找不到这个项目</p>
        <p className="text-[var(--ink2)]">可能已经删掉了，或者是在别的浏览器里创建的。</p>
        <Link to="/projects" className="btn btn-pri mt-2">回我的项目</Link>
      </div>
    )
  }

  const pr = progress(p, done)
  const nx = nextConcept(p, done); const nxi = nx && idx.bySlug[nx]
  const saveName = () => { const v = nameDraft.trim().slice(0, 30); if (v && v !== p.name) updateProject(p.id, { name: v, nameEdited: true }); setRenaming(false) }
  const lvLabel = LEVEL_OPTS.find(o => o.id === p.input?.level)?.label
  const stage = i => {
    const st = stageState(p, i, done)
    return <StageCard stage={p.route.stages[i]} i={i} total={total} idx={idx} done={done} taskDone={st.task} complete={st.complete} onToggleTask={() => toggleTask(p.id, i)} />
  }

  return (
    <div className="max-w-[1080px] mx-auto px-3.5 lg:px-6 pt-3 lg:pt-7 pb-6 grid grid-cols-1 gap-4 lg:gap-5 [&>*]:min-w-0">
      <Link to="/projects" className="inline-flex items-center gap-1.5 w-fit min-h-[40px] text-[15px] font-semibold text-[var(--ink2)] no-underline hover:text-[var(--ink)]"><ArrowLeft size={17} />我的项目</Link>

      {/* 项目头 */}
      <section className="card p-5 lg:p-8 bg-[linear-gradient(150deg,var(--sky),var(--surface)_65%)]" aria-label="项目概览">
        {renaming ? (
          <form onSubmit={e => { e.preventDefault(); saveName() }} className="flex gap-2 items-center">
            <label htmlFor="rename" className="sr-only">项目名</label>
            <input id="rename" data-testid="rename-input" autoFocus value={nameDraft} maxLength={30} onChange={e => setNameDraft(e.target.value)} onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Escape') setRenaming(false) }}
              className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-[var(--surface)] border-2 border-[var(--blue)] outline-none text-[20px] font-extrabold" />
            <button type="submit" className="btn btn-pri !min-h-[48px] !px-4" aria-label="保存名字"><Check size={18} /></button>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="m-0 text-[26px] lg:text-[36px] font-black leading-tight min-w-0 break-words" data-testid="project-name">{p.name}</h1>
            <button type="button" data-testid="rename" onClick={() => { setNameDraft(p.name); setRenaming(true) }} aria-label="重命名"
              className="flex-none w-10 h-10 mt-0.5 lg:mt-1.5 grid place-items-center rounded-full hover:bg-[var(--surface)] text-[var(--ink2)]"><Pencil size={17} /></button>
          </div>
        )}
        {p.route.goal && <p className="m-0 mt-2 text-[16px] lg:text-[18px] text-[var(--ink2)] leading-relaxed">{p.route.goal}</p>}

        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="m-0 leading-none"><b className="text-[40px] lg:text-[48px] font-black tabular" data-testid="project-pct">{pr.pct}</b><span className="text-[18px] font-bold text-[var(--ink2)]">%</span></p>
          <p className="m-0 text-[14px] text-[var(--ink2)] text-right">{pr.stagesDone}/{pr.stages} 个阶段完成<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>概念和任务共 {pr.d}/{pr.n}</p>
        </div>
        <div className="pbar !h-3 mt-2.5" style={{ '--acc': pr.pct === 100 ? '#1E7F45' : 'var(--blue)' }} role="progressbar" aria-valuenow={pr.pct} aria-valuemin={0} aria-valuemax={100} aria-label="项目进度"><i style={{ width: pr.pct + '%' }} /></div>

        <div className="flex flex-wrap gap-2.5 mt-5">
          {nxi ? (
            <Link to={'/c/' + nxi.slug} data-testid="next-concept" className="btn btn-pri !min-h-[50px] w-full sm:w-auto min-w-0">
              <span className="truncate min-w-0">继续学：<span className="emo">{nxi.emoji}</span> {nxi.zh}</span><ArrowRight size={18} className="flex-none" />
            </Link>
          ) : <span className="btn btn-ok !min-h-[50px]"><Check size={18} />概念全学会了</span>}
          <button type="button" className="btn btn-soft !min-h-[50px] flex-1 sm:flex-none" data-testid="adjust" onClick={() => setAdjustOpen(true)}><Wand2 size={17} />让 AI 调整</button>
          <button type="button" className="btn btn-soft !min-h-[50px] flex-1 sm:flex-none" data-testid="export-md" onClick={() => downloadText(p.name, toMarkdown(p, idx, done))}><Download size={17} />导出</button>
          <button type="button" className="btn btn-soft !min-h-[50px] !px-4 text-[#C2321F] dark:text-[#FF8B74]" data-testid="delete" onClick={() => setAskDelete(true)} aria-label="删除项目"><Trash2 size={17} /><span className="hidden sm:inline">删除</span></button>
        </div>
        <details className="mt-4 text-[14px] text-[var(--ink2)]">
          <summary className="cursor-pointer w-fit min-h-[32px] font-semibold">我当时的描述</summary>
          <p className="m-0 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{p.input?.project}</p>
          <p className="m-0 mt-1 text-[13px] text-[var(--ink3)]">{[lvLabel && '水平：' + lvLabel, p.input?.hours && `每周 ${p.input.hours} 小时`, fmtDate(p.createdAt) + ' 创建'].filter(Boolean).join(' · ')}</p>
        </details>
      </section>

      {/* 阶段条 */}
      <div className="flex items-center gap-2">
        <nav aria-label="阶段" className="flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar py-1 -my-1 pr-6 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]">
          {p.route.stages.map((s, i) => {
            const st = stageState(p, i, done); const on = !all && i === sIdx
            return (
              <button key={i} type="button" data-testid="stage-tab" onClick={() => { setAll(false); go(i) }} aria-current={on ? 'step' : undefined}
                className={`flex-none flex items-center gap-2 min-h-[46px] pl-1.5 pr-3.5 rounded-full border-2 text-[14px] font-bold transition-colors max-w-[220px] ${on ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--ink3)]'}`}>
                <span className={`w-8 h-8 rounded-full grid place-items-center text-[13px] flex-none tabular ${st.complete ? 'bg-[#1E7F45] text-white' : on ? 'bg-[var(--bg)] text-[var(--ink)]' : 'bg-[var(--surface2)]'}`}>{st.complete ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
                <span className="truncate">{s.title}</span>
              </button>
            )
          })}
        </nav>
        <button type="button" onClick={() => setAll(a => !a)} aria-pressed={all} title={all ? '一张一张看' : '全部展开'}
          className="flex-none hidden sm:inline-flex items-center gap-1.5 min-h-[46px] px-3.5 rounded-full bg-[var(--surface)] border-2 border-[var(--line)] text-[14px] font-bold">
          {all ? <GalleryHorizontal size={16} /> : <Rows3 size={16} />}{all ? '一张张看' : '全部展开'}
        </button>
      </div>

      {/* 阶段内容 */}
      {all ? (
        <div className="grid gap-4 lg:gap-5">{p.route.stages.map((_, i) => <div key={i}>{stage(i)}</div>)}</div>
      ) : isMobile ? (
        <>
          <FlipDeck index={sIdx} total={total} onPrev={goPrev} onNext={goNext} still={prefs.still}>{stage(sIdx)}</FlipDeck>
          <div className="flex items-center justify-between gap-2 bg-[var(--surface)] rounded-full p-1.5 shadow-[var(--sh)] border border-[var(--line)]">
            <button type="button" onClick={goPrev} disabled={sIdx === 0} className="btn btn-soft !min-h-[46px] !px-4 disabled:opacity-40"><ChevronLeft size={18} />上一阶段</button>
            <span className="text-[14px] font-bold tabular text-[var(--ink2)]">{sIdx + 1} / {total}</span>
            <button type="button" onClick={goNext} disabled={sIdx === total - 1} data-testid="stage-next" className="btn btn-pri !min-h-[46px] !px-4 disabled:opacity-40">下一阶段<ChevronRight size={18} /></button>
          </div>
        </>
      ) : (
        <>
          {stage(sIdx)}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={goPrev} disabled={sIdx === 0} className="btn btn-soft disabled:opacity-40"><ChevronLeft size={18} />上一阶段</button>
            <span className="text-[14px] text-[var(--ink3)]">← → 键也能翻</span>
            <button type="button" onClick={goNext} disabled={sIdx === total - 1} data-testid="stage-next" className="btn btn-pri disabled:opacity-40">下一阶段<ChevronRight size={18} /></button>
          </div>
        </>
      )}

      <ConfirmDialog open={askDelete} danger title={`删除「${p.name}」？`} body="删掉后找不回来。概念的学习记录不会受影响。" okText="删除"
        onCancel={() => setAskDelete(false)} onOk={() => { deleteProject(p.id); nav('/projects', { replace: true }) }} />
      {adjustOpen && <AdjustDialog p={p} onClose={() => setAdjustOpen(false)} onApplied={() => { setAdjustOpen(false); go(0) }} />}
    </div>
  )
}

// 让 AI 调整：输入一句话 → 带当前路线重新生成 → 预览 → 确认后覆盖
function AdjustDialog({ p, onClose, onApplied }) {
  const { idx } = useApp()
  const [text, setText] = useState('')
  const [st, setSt] = useState({ s: 'input' })
  const [ctl, setCtl] = useState(null)
  const [cfgOpen, setCfgOpen] = useState(false)
  useEffect(() => () => ctl?.abort(), [ctl])
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !cfgOpen) onClose() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose, cfgOpen])
  const len = [...text].length
  async function run(skipCfgCheck = false) {
    if (!text.trim() || len > MAX_ADJUST) return
    if (!skipCfgCheck && !isAiConfigured()) {
      setCfgOpen(true)
      return
    }
    const c = new AbortController(); setCtl(c); setSt({ s: 'loading' })
    try {
      const d = await requestPlan({ project: p.input?.project || p.name, ...(p.input?.level ? { level: p.input.level } : {}), ...(p.input?.hours ? { hours: p.input.hours } : {}), current_route: p.route, adjust: text.trim() }, { signal: c.signal })
      setSt({ s: 'preview', route: d.route })
    } catch (e) { if (e.code !== 'aborted') setSt({ s: 'error', error: e }) }
  }
  return (
    <div className="fixed inset-0 z-[110] grid place-items-end sm:place-items-center bg-black/40 p-3" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="让 AI 调整路线" data-testid="adjust-dialog"
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto bg-[var(--surface)] rounded-[24px] shadow-[var(--sh2)] border border-[var(--line)] p-5" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between gap-2">
          <b className="text-[18px] flex items-center gap-2"><Wand2 size={19} />让 AI 调整路线</b>
          <button type="button" onClick={() => setCfgOpen(true)} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-[var(--surface2)] text-[13px] font-bold hover:bg-[var(--sky)]">
            <Settings2 size={15} />AI 设置
          </button>
        </div>
        {(st.s === 'input' || st.s === 'error') && (
          <>
            <p className="text-[15px] text-[var(--ink2)] mt-2 mb-3">用一句话说想怎么改，比如「不想买域名」「加一个登录功能」「再简单一点」。</p>
            <textarea data-testid="adjust-input" autoFocus rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="想怎么改？"
              className={`block w-full rounded-2xl bg-[var(--surface2)] border-2 ${len > MAX_ADJUST ? 'border-[#D93A2B]' : 'border-transparent focus:border-[var(--blue)]'} outline-none p-3 text-[16px] leading-relaxed resize-none`} />
            <div className="text-right text-[13px] text-[var(--ink3)] tabular mt-1">{len} / {MAX_ADJUST}</div>
            {st.s === 'error' && (
              <div className="mt-2">
                <ErrorCard
                  message={errorText(st.error)}
                  retryable={canRetry(st.error)}
                  onRetry={() => run()}
                  onConfig={needsAiSetup(st.error) ? () => setCfgOpen(true) : undefined}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-soft !min-h-[46px]" onClick={onClose}>取消</button>
              <button type="button" data-testid="adjust-run" className="btn btn-pri !min-h-[46px] disabled:opacity-45" disabled={!text.trim() || len > MAX_ADJUST} onClick={() => run()}><Sparkles size={17} />生成新路线</button>
            </div>
          </>
        )}
        {st.s === 'loading' && (
          <div className="grid gap-2.5 mt-4" aria-busy="true" data-testid="adjust-loading">
            <p className="m-0 text-[15px] text-[var(--ink2)]">AI 正在按你的要求改路线…（一般 5–20 秒）</p>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-2xl" />)}
            <div className="flex justify-end mt-2"><button type="button" className="btn btn-soft !min-h-[46px]" onClick={() => { ctl?.abort(); setSt({ s: 'input' }) }}>取消</button></div>
          </div>
        )}
        {st.s === 'preview' && (
          <>
            <p className="text-[15px] text-[var(--ink2)] mt-2 mb-3">新路线：<b className="text-[var(--ink)]">{st.route.name}</b>，共 {st.route.stages.length} 个阶段。用它覆盖当前路线吗？（已学会的概念不受影响，标题没变的阶段会保留任务勾选。）</p>
            <ol className="list-none m-0 p-0 grid gap-2" data-testid="adjust-preview">
              {st.route.stages.map((s, i) => (
                <li key={i} className="flex gap-3 items-start bg-[var(--surface2)] rounded-2xl p-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--bg)] grid place-items-center text-[13px] font-black flex-none tabular">{i + 1}</span>
                  <span className="min-w-0"><b className="block text-[15px] leading-snug">{s.title}</b>
                    <small className="block text-[13px] text-[var(--ink2)] mt-0.5 leading-snug">{s.concepts.map(c => idx.bySlug[c]?.zh).filter(Boolean).join('、')}</small></span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2 justify-end mt-4 flex-wrap">
              <button type="button" className="btn btn-soft !min-h-[46px]" onClick={onClose}>不要了</button>
              <button type="button" data-testid="adjust-apply" className="btn btn-pri !min-h-[46px]" onClick={() => { replaceRoute(p.id, st.route); onApplied() }}>覆盖当前路线</button>
            </div>
          </>
        )}
      </div>
      <AiConfigDialog open={cfgOpen} onClose={() => setCfgOpen(false)} onSaved={() => { setCfgOpen(false); run(true) }} />
    </div>
  )
}
