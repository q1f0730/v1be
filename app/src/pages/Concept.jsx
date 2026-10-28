// 概念页：一次只看一块内容。
//  桌面：左侧「本页目录」+ 中间一块「文件夹标签」内容卡 + 上一节 / 下一节；可「全部展开」
//  手机：翻牌式一次一张（FlipDeck，可左右滑）+ 底部「上一张 / 我学会了 / 下一张」；可「全部展开」
//  每个概念都有「小白版 ⇄ 🎓 专业模式」分段开关（记在 aig:prefs.pro）
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Volume2, Square, Rows3, GalleryHorizontal, Check } from 'lucide-react'
import { useApp } from '../App'
import { useConcept, prefetchConcept } from '../lib/data'
import { setLast } from '../lib/store'
import { burst, speak, speechState, onSpeech, canSpeak } from '../lib/fx'
import { useMedia } from '../lib/useMedia'
import { EASY_SECS, PRO_SECS, EasySection, ProSection, sectionText } from '../components/Sections'
import MagneticPillTabs from '../components/rw/MagneticPillTabs'
import FlipDeck from '../components/rw/FlipDeck'
import Skeleton from '../components/rw/Skeleton'
import mascot from '../assets/mascot.webp'
import RelationMini from '../components/graph/RelationMini'

function useSpeaking() { return useSyncExternalStore(onSpeech, speechState) }

function SayButton({ id, text, big, label = '读给我听', compact }) {
  const cur = useSpeaking()
  const on = cur === id
  if (!canSpeak() && !big) return null
  return big ? (
    <button type="button" data-testid="tts-main" onClick={() => speak(id, text)} aria-pressed={on} aria-label={on ? '停止朗读' : label}
      className={`inline-flex items-center justify-center gap-2 min-h-[46px] rounded-full font-bold text-[16px] transition-colors flex-none ${compact ? 'w-[52px] px-0' : 'px-5'} ${on ? 'bg-[var(--blue)] text-white animate-pulse' : 'bg-[var(--ink)] text-[var(--bg)]'}`}>
      {on ? <Square size={16} fill="currentColor" /> : <Volume2 size={compact ? 20 : 18} />}{!compact && (on ? '停止朗读' : label)}
    </button>
  ) : (
    <button type="button" onClick={() => speak(id, text)} aria-pressed={on} aria-label={on ? '停止朗读' : '读这一块'} title="读这一块"
      className={`h-[36px] px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-bold flex-none transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] relative ${on ? 'bg-[var(--blue)] text-white' : 'bg-[var(--surface)] text-[var(--ink2)] hover:text-[var(--ink)] shadow-[var(--sh)]'}`}>
      {on ? <Square size={12} fill="currentColor" /> : <Volume2 size={16} />}{on ? '停止' : '读这块'}
    </button>
  )
}

export default function Concept({ mode }) {
  const { slug } = useParams()
  const { idx, prefs } = useApp()
  const x = idx.bySlug[slug]
  if (!x) return <Navigate to="/" replace />
  // 记住了「专业模式」时小白地址会跳到专业版；但如果地址明确指向只有小白版才有的章节（比如搜索结果「翻车现场」），就留在小白版
  const sParam = new URLSearchParams(location.hash.split('?')[1] || '').get('s')
  const easyOnly = sParam && EASY_SECS.some(s => s.id === sParam) && !PRO_SECS.some(s => s.id === sParam)
  if (mode === 'easy' && prefs.pro && x.pro && !easyOnly) return <Navigate to={`/c/${slug}/pro${location.hash.includes('?') ? '?' + location.hash.split('?')[1] : ''}`} replace />
  if (mode === 'pro' && !x.pro) return <Navigate to={`/c/${slug}`} replace />
  return <ConceptView key={slug + mode} x={x} mode={mode} />
}

function ConceptView({ x, mode }) {
  const { idx, done, toggleDone, prefs, setPrefs } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const isMobile = useMedia('(max-width:1023px)')
  const reduce = useReducedMotion() || prefs.still
  const { data: c, error } = useConcept(x.slug)
  const lv = idx.levelBy[x.level]
  const cat = idx.meta.cats[x.cat] || { emoji: '📦', name: x.cat }
  const SECS = mode === 'pro' ? PRO_SECS : EASY_SECS
  const ids = SECS.map(s => s.id)
  const sIdx = Math.max(0, ids.indexOf(sp.get('s')))
  const sec = SECS[sIdx]
  const all = !!prefs.all
  const [seen, setSeen] = useState(() => new Set([ids[sIdx]]))
  const [activeAll, setActiveAll] = useState(ids[0])
  const [quizSolved, setQuizSolved] = useState(false)
  const isDone = done.has(x.slug)
  const prev = idx.items[x.i - 1], next = idx.items[x.i + 1]

  const toConcept = y => y ? `/c/${y.slug}${mode === 'pro' && y.pro ? '/pro' : ''}` : '/'
  const panelTop = useRef(null)

  useEffect(() => { setLast(x.slug) }, [x.slug])
  useEffect(() => { document.title = `${mode === 'pro' ? '🎓 ' : x.emoji + ' '}${x.zh}${mode === 'pro' ? ' · 专业模式' : ''} · AI 造物指南` }, [x, mode])
  useEffect(() => { prefetchConcept(next?.slug); prefetchConcept(prev?.slug) }, [next, prev])
  useEffect(() => { setSeen(s => s.has(ids[sIdx]) ? s : new Set(s).add(ids[sIdx])) }, [sIdx]) // eslint-disable-line

  const goSec = useCallback((i, scroll = true) => {
    const j = Math.max(0, Math.min(ids.length - 1, i))
    setSp(j ? { s: ids[j] } : {}, { replace: true })
    if (scroll && panelTop.current) {
      const y = panelTop.current.getBoundingClientRect().top + window.scrollY - (isMobile ? 120 : 24)
      if (window.scrollY > y + 2) window.scrollTo({ top: y, behavior: 'auto' })
    }
  }, [ids, setSp, isMobile])
  const goPrev = useCallback(() => { if (!all && sIdx > 0) goSec(sIdx - 1); else if (prev) nav(toConcept(prev)) }, [all, sIdx, prev, goSec, nav]) // eslint-disable-line
  const goNext = useCallback(() => { if (!all && sIdx < ids.length - 1) goSec(sIdx + 1); else nav(toConcept(next)) }, [all, sIdx, ids.length, next, goSec, nav]) // eslint-disable-line

  // 键盘 ← →
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input,textarea,select,[role="dialog"]') || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // 全部展开 + 地址带 ?s=（例如从搜索结果进来）：滚到那一块
  useEffect(() => {
    if (!all || !c || !sp.get('s')) return
    const id = setTimeout(() => document.querySelector(`[data-sec="${sp.get('s')}"]`)?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(id)
  }, [c]) // eslint-disable-line

  // 全部展开时：滚动点亮目录
  useEffect(() => {
    if (!all || !c) return
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { const id = en.target.dataset.sec; setActiveAll(id); setSeen(s => s.has(id) ? s : new Set(s).add(id)) }
    }), { rootMargin: '-35% 0px -55% 0px' })
    document.querySelectorAll('[data-sec]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [all, c, mode])

  const doneToggle = () => { if (!isDone) burst(['🌟', '💪', '🎈', '✅']); toggleDone(x.slug) }
  const setMode = m => { setPrefs({ pro: m === 'pro' }); nav(`/c/${x.slug}${m === 'pro' ? '/pro' : ''}`, { replace: true }) }
  const heroText = c ? (mode === 'pro' ? `${x.zh}。${c.pro?.def || ''}` : `${x.zh}。${c.oneLiner}。${c.analogy}。${c.points.join('。')}`) : ''
  const curId = all ? activeAll : sec.id
  const scrollToSec = id => document.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })

  const renderBody = s => mode === 'pro'
    ? <ProSection id={s.id} p={c.pro} />
    : <EasySection id={s.id} c={c} bySlug={idx.bySlug} mode={mode} quizSolved={quizSolved} onQuizSolved={() => { setQuizSolved(true); setSeen(v => new Set(v).add('quiz')) }} />

  const renderPanel = (s, i, stacked) => (
    <div className={`relative pt-[40px] ${stacked ? `sec-all ${curId === s.id ? 'is-active' : ''} transition-[opacity,filter] duration-300` : ''}`} data-sec={stacked ? s.id : undefined}
      style={{ scrollMarginTop: isMobile ? 130 : 24 }}>
      {/* 文件夹标签（形状取自 Rewamp FolderTabCard 的切口） */}
      <div className="absolute top-0 left-0 z-10 h-[46px] pl-4 pr-5 rounded-t-[20px] flex items-center gap-2 font-bold text-[14px]"
        style={{ background: (mode === 'easy' && s.tint) || 'var(--surface)' }}>
        <span className="emo text-[17px]">{s.emoji}</span>
        <span className="tabular text-[var(--ink3)]">{String(i + 1).padStart(2, '0')}</span>
        <span>{s.label}</span>
        <i aria-hidden="true" className="absolute -right-[20px] bottom-[6px] w-5 h-5"
          style={{ background: `radial-gradient(circle at 100% 0, transparent 19.5px, ${(mode === 'easy' && s.tint) || 'var(--surface)'} 20px)` }} />
      </div>
      {s.say && c && <div className="absolute top-0 right-0 z-10"><SayButton id={x.slug + mode + s.id} text={sectionText(mode, s.id, c)} /></div>}
      <section aria-label={s.label} className="relative rounded-[24px] rounded-tl-none p-5 pt-6 lg:p-8 lg:pt-8 shadow-[var(--sh)] prose-calm min-h-[160px] lg:min-h-[240px]"
        style={{ background: (mode === 'easy' && s.tint) || 'var(--surface)' }}>
        {renderBody(s)}
      </section>
    </div>
  )

  const crumb = (
    <nav aria-label="位置" className="text-[13px] lg:text-[14px] text-[var(--ink2)] mb-3 flex flex-wrap items-center gap-1.5 leading-normal">
      <Link to="/" className="text-[var(--blue-d)] no-underline hover:underline">首页</Link><span>›</span>
      <Link to={`/l/${lv.cls}?cat=${x.cat}`} className="text-[var(--blue-d)] no-underline hover:underline">{lv.emoji} {x.level} · {cat.emoji} {cat.name}</Link>
      <span className="hidden lg:inline">›</span><b className="hidden lg:inline text-[var(--ink)] font-semibold">{x.zh}</b>
    </nav>
  )

  const modeSwitch = x.pro && (
    <MagneticPillTabs role="radiogroup" ariaLabel="内容版本" layoutId="mode-switch" scroll={false} size="sm" still={prefs.still}
      value={mode} onChange={setMode} className="w-full lg:w-auto" fill={isMobile}
      items={[{ id: 'easy', emoji: '🧸', label: '小白版' }, { id: 'pro', emoji: '🎓', label: '专业模式' }]} />
  )

  const hero = (
    <section className={`card ${mode === 'pro' ? 'pro-hero' : ''} p-4 lg:p-8 grid grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] gap-x-3.5 gap-y-3.5 lg:gap-7 items-center dim-in-focus`}
      style={{ background: `linear-gradient(140deg, var(--surface) 50%, ${mode === 'pro' ? 'var(--surface2)' : 'var(--accs)'})` }}>
      <div aria-hidden="true" className="hemo emo text-[34px] lg:text-[68px] w-[60px] h-[60px] lg:w-[124px] lg:h-[124px] grid place-items-center rounded-[22px] lg:rounded-[36px] bg-[var(--accs)]">{x.emoji}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5 lg:gap-2 text-[12px] lg:text-[13px] text-[var(--ink2)] items-center">
          {mode === 'pro' && <span className="lvb !bg-[var(--ink)] !text-[var(--bg)]">🎓 专业模式</span>}
          <span className="lvb">{lv.emoji} {x.level}</span>
          <span className="hidden sm:inline bg-[var(--surface2)] rounded-full px-2.5 font-semibold">{cat.emoji} {cat.name}</span>
          <span className={`${mode === 'pro' ? 'hidden sm:inline' : ''} bg-[var(--surface2)] rounded-full px-2.5 font-semibold tabular`}>No.{x.no} / {idx.meta.total}</span>
          <span className="hidden sm:inline bg-[var(--surface2)] rounded-full px-2.5 font-semibold">⏱ 约 {mode === 'pro' ? 10 : 2} 分钟</span>
        </div>
        <h1 className="text-[22px] lg:text-[44px] leading-tight font-extrabold mt-1 lg:mt-3 mb-0 [overflow-wrap:anywhere]">{x.zh}</h1>
        <p className="m-0 text-[14px] lg:text-[16px] text-[var(--ink2)]">{x.en}</p>
      </div>
      <div className="col-span-2 lg:col-span-1 flex lg:flex-col gap-2.5 items-center lg:items-end">
        <div className="flex-1 min-w-0 lg:flex-none">{modeSwitch}</div>
        <div className="flex gap-2.5 items-center flex-none">
          {c && <SayButton big compact={isMobile} id={x.slug + mode + 'hero'} text={heroText} />}
          <button type="button" onClick={doneToggle} aria-pressed={isDone} data-testid="done-hero"
            className={`hidden lg:inline-flex btn !min-h-[46px] !text-[15px] ${isDone ? 'btn-ok' : 'btn-soft'}`}>{isDone ? <><Check size={17} />已学会</> : '🙋 我学会了'}</button>
        </div>
      </div>
    </section>
  )

  const rail = (
    <aside aria-label="本页目录" className="hidden lg:block sticky top-6 dim-in-focus">
      <div className="card p-3.5">
        <div className="flex items-center justify-between gap-1.5 px-1.5 pb-2.5 text-[13px]">
          {mode === 'pro' ? <span className="lvb !bg-[var(--ink)] !text-[var(--bg)]">🎓 专业模式</span> : <span className="lvb">{lv.emoji} {x.level}</span>}
          <span className="text-[var(--ink2)] tabular">{Math.max(0, ids.indexOf(curId)) + 1} / {SECS.length}</span>
        </div>
        <ol className="list-none m-0 p-0 grid gap-0.5">
          {SECS.map((s, i) => {
            const on = curId === s.id
            return (
              <li key={s.id}>
                <button type="button" onClick={() => all ? scrollToSec(s.id) : goSec(i, false)} aria-current={on ? 'step' : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 min-h-[42px] rounded-[14px] text-left text-[15px] font-semibold transition-colors ${on ? 'bg-[var(--accs)] text-[var(--ink)]' : 'text-[var(--ink2)] hover:bg-[var(--surface2)]'}`}>
                  <span className="emo text-[18px] w-7 text-center">{s.emoji}</span>
                  <span className="flex-1">{s.label}</span>
                  <i className={`not-italic text-[11px] w-5 h-5 rounded-full grid place-items-center ${seen.has(s.id) ? 'bg-[#34C759] text-white' : 'bg-[var(--surface2)] text-transparent'}`}>✓</i>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={() => setPrefs({ all: !all })} aria-pressed={all}
          className="w-full mt-2.5 min-h-[42px] rounded-[14px] bg-[var(--surface2)] hover:bg-[var(--surface3)] text-[14px] font-semibold inline-flex items-center justify-center gap-2">
          {all ? <><GalleryHorizontal size={16} />一次一块</> : <><Rows3 size={16} />全部展开</>}
        </button>
        <div className="grid gap-2 mt-3 pt-3 border-t border-[var(--line)]">
          {[[prev, '‹ 上一个'], [next, '下一个 ›']].map(([y, lab]) => y ? (
            <Link key={lab} to={toConcept(y)} className={`no-underline rounded-2xl bg-[var(--surface2)] px-3 py-2.5 leading-snug hover:text-[var(--blue-d)] ${lab.startsWith('下') ? 'text-right' : ''}`}>
              <small className="block text-[12px] text-[var(--ink2)]">{lab}</small><b className="block text-[14px] truncate"><span className="emo">{y.emoji}</span> {y.zh}</b>
            </Link>
          ) : <span key={lab} />)}
        </div>
      </div>
    </aside>
  )

  const finish = (
    <section className={`card p-5 lg:p-8 grid grid-cols-[auto_1fr] gap-x-5 lg:gap-x-7 gap-y-4 items-center mt-5 ${all ? '' : 'dim-in-focus'}`}>
      <img src={mascot} alt="" width="640" height="640" className="w-[72px] h-[72px] lg:w-[110px] lg:h-[110px] rounded-[22px] lg:rounded-[30px] object-cover lg:row-span-2" />
      <div>
        <h2 className="m-0 mb-1 text-[20px] lg:text-[24px]">{mode === 'pro' ? '专业版也啃完了？' : '看完了？给自己打个卡'}</h2>
        <p className="m-0 mb-3 text-[var(--ink2)] text-[15px]">{mode === 'pro' ? '打卡和小白版共用一个进度。' : '进度只存在你的浏览器里。'}</p>
        <button type="button" onClick={doneToggle} aria-pressed={isDone} data-testid="done-finish" className={`btn ${isDone ? 'btn-ok' : 'btn-pri'}`}>{isDone ? '✅ 已学会（再点取消）' : '🙋 我学会了！'}</button>
      </div>
      <nav aria-label="上一个 / 下一个概念" className="col-span-2 lg:col-span-1 grid grid-cols-2 gap-3">
        {[[prev, '‹ 上一个'], [next, '下一个 ›']].map(([y, lab]) => y ? (
          <Link key={lab} to={toConcept(y)} className={`no-underline rounded-[18px] bg-[var(--surface2)] px-4 py-3 leading-snug min-w-0 hover:text-[var(--blue-d)] ${lab.startsWith('下') ? 'text-right' : ''}`}>
            <small className="block text-[12px] text-[var(--ink2)]">{lab}</small><b className="block text-[15px] truncate"><span className="emo">{y.emoji}</span> {y.zh}</b>
          </Link>
        ) : <span key={lab} />)}
      </nav>
    </section>
  )

  // ---- 加载中 / 出错 ----
  const loading = (
    <div className="grid gap-4" aria-busy="true" aria-label="正在加载内容">
      <Skeleton className="h-[46px] w-[180px] rounded-t-[20px] rounded-b-none" />
      <Skeleton className="h-[300px] rounded-[24px] -mt-4" />
    </div>
  )
  const failed = <div className="card p-6 text-center"><p className="font-bold">这一页内容没加载出来 😵</p><button className="btn btn-pri" onClick={() => location.reload()}>刷新试试</button></div>

  // ---- 内容区 ----
  let content
  if (error) content = failed
  else if (!c) content = loading
  else if (all) content = <div className="grid gap-5">{SECS.map((s, i) => <div key={s.id}>{renderPanel(s, i, true)}</div>)}{finish}</div>
  else if (isMobile) content = (
    <>
      <FlipDeck index={sIdx} total={SECS.length} onPrev={goPrev} onNext={goNext} still={prefs.still}>
        {renderPanel(sec, sIdx, false)}
      </FlipDeck>
      <div className="flex justify-between items-center gap-2.5 mt-3.5 mx-1 text-[14px] text-[var(--ink2)]" aria-live="polite">
        <span className="min-w-0 truncate">{SECS[sIdx + 1] ? <>下一张 › <b className="text-[var(--ink)]">{SECS[sIdx + 1].emoji} {SECS[sIdx + 1].label}</b></> : next ? '最后一张啦，右下角去下一个概念' : '最后一张了'}</span>
        <span className="flex gap-[5px] flex-none" aria-hidden="true">{SECS.map((_, j) => <i key={j} className={`h-[7px] rounded-full transition-all ${j === sIdx ? 'w-[18px] bg-[var(--ink)]' : 'w-[7px] bg-[var(--surface3)]'}`} />)}</span>
      </div>
      {sIdx === SECS.length - 1 && finish}
    </>
  )
  else content = (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sec.id} initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
          {renderPanel(sec, sIdx, false)}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3 mt-4">
        <button type="button" onClick={goPrev} disabled={sIdx === 0 && !prev} className="btn btn-soft disabled:opacity-40">
          <ChevronLeft size={18} />{sIdx === 0 ? '上一个概念' : `上一节 · ${SECS[sIdx - 1].label}`}
        </button>
        <span className="flex gap-1.5" aria-label={`第 ${sIdx + 1} 块，共 ${SECS.length} 块`}>
          {SECS.map((s, j) => <button key={s.id} type="button" onClick={() => goSec(j, false)} aria-label={s.label}
            className="w-6 h-11 grid place-items-center"><i className={`block h-2 rounded-full transition-all ${j === sIdx ? 'w-5 bg-[var(--ink)]' : seen.has(s.id) ? 'w-2 bg-[var(--ink3)]' : 'w-2 bg-[var(--surface3)]'}`} /></button>)}
        </span>
        <button type="button" onClick={goNext} className={`btn ${sIdx === SECS.length - 1 ? 'btn-ink' : 'btn-pri'}`}>
          {sIdx === SECS.length - 1 ? (next ? '下一个概念' : '回首页') : `下一节 · ${SECS[sIdx + 1].label}`}<ChevronRight size={18} />
        </button>
      </div>
      {finish}
    </>
  )

  return (
    <div className={`${lv.cls} ${mode === 'pro' ? 'pro-mode' : ''} max-w-[1320px] mx-auto px-3.5 lg:px-6 pt-3 lg:pt-7 pb-6`}>
      {crumb}
      <div className="lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        {rail}
        <div className="min-w-0">
          {hero}
          {/* 手机：章节条 + 全部展开 */}
          <div className="lg:hidden sticky top-[58px] z-30 -mx-3.5 px-3.5 py-2 mt-2 flex gap-2 items-center bg-[var(--bg)]/92 backdrop-blur-md">
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar [mask-image:linear-gradient(90deg,#000_85%,transparent)] pr-6" role="tablist" aria-label="本页卡片">
              {SECS.map((s, i) => {
                const on = curId === s.id
                return (
                  <button key={s.id} type="button" role="tab" aria-selected={on} ref={el => { if (on && el) el.scrollIntoView({ block: 'nearest', inline: 'center' }) }}
                    onClick={() => all ? scrollToSec(s.id) : goSec(i)}
                    className={`flex-none inline-flex items-center gap-1 h-11 px-3 rounded-full text-[14px] font-semibold whitespace-nowrap shadow-[var(--sh)] ${on ? 'bg-[var(--ink)] text-[var(--bg)]' : seen.has(s.id) ? 'bg-[var(--surface)] text-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--ink2)]'}`}>
                    <span className="emo">{s.emoji}</span>{s.label}{seen.has(s.id) && !on && <span className="text-[#1E7F45] dark:text-[#5FD08A] font-extrabold">✓</span>}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setPrefs({ all: !all })} aria-pressed={all}
              className="flex-none h-11 px-3 rounded-full bg-[var(--surface)] shadow-[var(--sh)] text-[13px] font-bold inline-flex items-center gap-1">
              {all ? <><GalleryHorizontal size={15} />一张张</> : <><Rows3 size={15} />全部展开</>}
            </button>
          </div>
          <div ref={panelTop} className="mt-3 lg:mt-5">{content}</div>
          <RelationMini slug={x.slug} mode={mode} />
        </div>
      </div>

      {/* 手机底栏：上一张 / 我学会了 / 下一张 */}
      <nav aria-label="翻卡" className="lg:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1.3fr_1fr] gap-2 px-3 pt-2.5 bg-[var(--surface)]/92 backdrop-blur-xl shadow-[0_-1px_0_var(--line),0_-10px_30px_-18px_rgba(0,0,0,.25)]"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={goPrev} disabled={(all || sIdx === 0) && !prev} data-testid="bb-prev"
          className="h-[52px] rounded-full bg-[var(--surface2)] font-bold text-[15px] whitespace-nowrap px-2 disabled:opacity-40">{!all && sIdx > 0 ? '‹ 上一张' : '‹ 上一个'}</button>
        <button type="button" onClick={doneToggle} aria-pressed={isDone} data-testid="bb-done"
          className={`h-[52px] rounded-full font-bold text-[15px] whitespace-nowrap px-2 text-white ${isDone ? 'bg-[#1E7F45]' : 'bg-[var(--blue)] dark:bg-[#2F6FE8]'}`}>{isDone ? '✅ 已学会' : '🙋 我学会了'}</button>
        <button type="button" onClick={goNext} data-testid="bb-next"
          className={`h-[52px] rounded-full font-bold text-[15px] whitespace-nowrap px-2 ${all || sIdx === SECS.length - 1 ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface2)]'}`}>
          {!all && sIdx < SECS.length - 1 ? '下一张 ›' : next ? '下一个 ›' : '回首页 ›'}
        </button>
      </nav>
    </div>
  )
}
