// 级别页：一次一个级别（顶部动画标签切换），一次一个分类（地址里记住 ?cat=），每页最多 12 张卡（手机 8 张）
import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useApp } from '../App'
import MorphingTabs from '../components/rw/MorphingTabs'
import MagneticPillTabs from '../components/rw/MagneticPillTabs'
import { useMedia } from '../lib/useMedia'
import mascotSm from '../assets/mascot-sm.webp'

export default function Level() {
  const { lv } = useParams()
  const { idx, done, prefs } = useApp()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const isMobile = useMedia('(max-width:1023px)')
  const reduce = useReducedMotion() || prefs.still
  const level = idx.levelByCls[lv]
  const levelItems = useMemo(() => level ? idx.items.filter(x => x.level === level.name) : [], [idx, level])
  const cats = useMemo(() => idx.meta.catOrder.filter(k => levelItems.some(x => x.cat === k)).map(k => {
    const its = levelItems.filter(x => x.cat === k)
    return { id: k, ...idx.meta.cats[k], items: its, d: its.filter(x => done.has(x.slug)).length }
  }), [idx, levelItems, done])
  useEffect(() => { if (level) document.title = `${level.emoji} ${level.name} · ${level.tag} · AI 造物指南` }, [level])
  if (!level) return <Navigate to="/" replace />

  const firstOpen = (cats.find(c => c.d < c.items.length) || cats[0]).id
  const catId = cats.some(c => c.id === sp.get('cat')) ? sp.get('cat') : firstOpen
  const cat = cats.find(c => c.id === catId)
  const PAGE = isMobile ? 8 : 12
  const pages = Math.max(1, Math.ceil(cat.items.length / PAGE))
  const page = Math.min(pages, Math.max(1, +sp.get('p') || 1))
  const shown = cat.items.slice((page - 1) * PAGE, page * PAGE)
  const lvDone = levelItems.filter(x => done.has(x.slug)).length
  const nextUn = levelItems.find(x => !done.has(x.slug))
  const li = idx.meta.levels.findIndex(l => l.cls === lv)
  const nextLevel = idx.meta.levels[li + 1]

  const setCat = id => { setSp({ cat: id }, { replace: true }) }
  const setPage = p => {
    setSp({ cat: catId, ...(p > 1 ? { p: String(p) } : {}) }, { replace: true })
    document.getElementById('cat-panel')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className={`${lv} max-w-[1240px] mx-auto px-3.5 lg:px-6 pt-3 lg:pt-7 pb-6`}>
      <nav aria-label="位置" className="text-[14px] text-[var(--ink2)] mb-3 flex items-center gap-1.5">
        <Link to="/" className="text-[var(--blue-d)] no-underline hover:underline">首页</Link><span>›</span><b className="text-[var(--ink)] font-semibold">{level.emoji} {level.name}</b>
      </nav>

      {/* 级别切换 */}
      <MorphingTabs className="w-full lg:w-auto mb-4 lg:mb-5" ariaLabel="切换级别" layoutId="level-tab" still={prefs.still}
        items={idx.meta.levels.map(l => {
          const n = idx.items.filter(x => x.level === l.name)
          return { id: l.cls, cls: l.cls, to: '/l/' + l.cls, replace: true, emoji: l.emoji, label: l.name, extra: `${n.filter(x => done.has(x.slug)).length}/${n.length}` }
        })} active={lv} />

      {/* 级别头 */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={lv} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.22 }}
          className="card bg-[var(--accs)] p-5 lg:p-9 grid grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_320px] gap-x-4 gap-y-4 lg:gap-7 items-center">
          <span className="emo text-[40px] lg:text-[64px] w-[72px] h-[72px] lg:w-[116px] lg:h-[116px] grid place-items-center rounded-[22px] lg:rounded-[32px] bg-[var(--surface)]/75">{level.emoji}</span>
          <div className="min-w-0">
            <span className="chip-tag !bg-[var(--surface)]/75">{level.name} · {levelItems.length} 个概念</span>
            <h1 className="text-[26px] lg:text-[42px] font-extrabold text-[var(--acci)] mt-2.5 mb-1 lg:mt-3.5 lg:mb-1.5">{level.tag}</h1>
            <p className="m-0 text-[15px] lg:text-[17px] text-[var(--ink2)] leading-relaxed max-w-[30em]">{level.desc}</p>
          </div>
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-3 bg-[var(--surface)]/75 rounded-[22px] p-4">
            <div className="flex items-center gap-2.5">
              <div className="pbar flex-1"><i style={{ width: `${lvDone / levelItems.length * 100}%` }} /></div>
              <em className="not-italic font-bold text-[15px] tabular text-[var(--acci)]">{lvDone} / {levelItems.length}</em>
            </div>
            {nextUn ? (
              <>
                <Link to={'/c/' + nextUn.slug} className="btn btn-pri w-full">学下一个没学的 <ArrowRight size={18} /></Link>
                <p className="m-0 text-[14px] text-[var(--ink2)] truncate">下一个：<span className="emo">{nextUn.emoji}</span> {nextUn.zh}</p>
              </>
            ) : (
              <>
                <Link to={nextLevel ? '/l/' + nextLevel.cls : '/'} className="btn btn-pri w-full">🎉 全学会了！{nextLevel ? `去${nextLevel.name} →` : '回首页'}</Link>
                <p className="m-0 text-[14px] text-[var(--ink2)]">这一级的概念你都点过「我学会了」。</p>
              </>
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* 分类标签 */}
      <div className="sticky top-[58px] lg:static z-30 -mx-3.5 px-3.5 lg:mx-0 lg:px-0 pt-3 pb-2 lg:pt-6 lg:pb-3 bg-[linear-gradient(var(--bg)_80%,transparent)]">
        <MagneticPillTabs ariaLabel="分类" wrapDesktop layoutId={'cat-pill-' + lv} value={catId} onChange={setCat} still={prefs.still} size="sm"
          items={cats.map(c => ({ id: c.id, emoji: c.emoji, label: c.name, badge: c.d ? `${c.d}/${c.items.length}` : c.items.length, allDone: c.d === c.items.length }))} />
      </div>

      <section id="cat-panel" role="tabpanel" aria-label={cat.name} className="scroll-mt-[130px] lg:scroll-mt-[90px]">
        <div className="flex items-baseline justify-between gap-3 mx-1 mb-3.5 mt-1">
          <h2 className="m-0 text-[20px] lg:text-[24px]"><span className="emo">{cat.emoji}</span> {cat.name}</h2>
          <span className="text-[14px] text-[var(--ink2)] whitespace-nowrap tabular">{cat.d ? `${cat.d} / ${cat.items.length} 已学会` : `${cat.items.length} 个`}</span>
        </div>
        {cat.d === cat.items.length && (
          <div className="flex items-center gap-3.5 bg-[var(--pist)] rounded-[22px] px-4 py-3.5 mb-4">
            <img src={mascotSm} alt="" width="56" height="56" className="w-14 h-14 rounded-2xl" />
            <p className="m-0 leading-snug"><b className="block">这一类全学会了！</b>换个分类，或者去下一级看看。</p>
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={catId + page} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 lg:gap-4">
            {shown.map(x => {
              const isDone = done.has(x.slug)
              return (
                <Link key={x.slug} to={'/c/' + x.slug}
                  className={`relative flex gap-3.5 items-start no-underline bg-[var(--surface)] rounded-[22px] p-3.5 lg:p-[18px] leading-snug shadow-[var(--sh)] hover:-translate-y-0.5 hover:shadow-[var(--sh2)] transition-all ${isDone ? 'ring-2 ring-[var(--acc)] ring-inset' : ''}`}>
                  <span className="emo text-[26px] lg:text-[30px] w-12 h-12 lg:w-14 lg:h-14 grid place-items-center rounded-[16px] bg-[var(--accs)] flex-none">{x.emoji}</span>
                  <span className="min-w-0 flex-1 pr-6">
                    <b className="block text-[16px] lg:text-[17px]">{x.zh}</b>
                    <small className="block text-[13px] text-[var(--ink3)] truncate">{x.en}</small>
                    <span className="clamp2 mt-1 text-[14px] lg:text-[15px] text-[var(--ink2)]">{x.oneLiner}</span>
                  </span>
                  <span className="absolute top-3 right-3 text-[12px] text-[var(--ink3)] tabular">{isDone
                    ? <span className="w-6 h-6 rounded-full grid place-items-center bg-[var(--acc)] text-white" aria-label="已学会"><Check size={15} strokeWidth={3} /></span>
                    : <span className="sr-only">未学</span>}</span>
                </Link>
              )
            })}
          </motion.div>
        </AnimatePresence>

        {pages > 1 && (
          <nav aria-label="分页" className="flex items-center justify-center gap-2 mt-5">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-soft !px-4 disabled:opacity-40" aria-label="上一页"><ChevronLeft size={18} /><span className="hidden sm:inline">上一页</span></button>
            <div className="flex gap-1.5">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}
                  className={`w-11 h-11 rounded-full font-bold tabular ${p === page ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] shadow-[var(--sh)]'}`}>{p}</button>
              ))}
            </div>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="btn btn-soft !px-4 disabled:opacity-40" aria-label="下一页"><span className="hidden sm:inline">下一页</span><ChevronRight size={18} /></button>
          </nav>
        )}
        <p className="text-center text-[13px] text-[var(--ink3)] mt-3 tabular">{cat.name} · 第 {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, cat.items.length)} 个，共 {cat.items.length} 个</p>
      </section>

      <nav aria-label="其他级别" className="flex flex-wrap gap-2.5 mt-8">
        {idx.meta.levels.filter(l => l.cls !== lv).map(l => (
          <button key={l.cls} type="button" onClick={() => nav('/l/' + l.cls)} className={`${l.cls} inline-flex items-center gap-2 min-h-[46px] px-5 rounded-full bg-[var(--accs)] font-bold text-[var(--acci)]`}>
            <span className="emo">{l.emoji}</span>{l.name} · {l.tag}
          </button>
        ))}
      </nav>
    </div>
  )
}
