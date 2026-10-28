// 首页：不放任何概念列表。英雄区 + 搜索、继续学习、四个级别入口（真实进度）、实战路线 + AI 规划 + 知识图谱入口、今日推荐、总进度、词汇表入口、怎么用
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, FolderKanban, Waypoints } from 'lucide-react'
import { useApp } from '../App'
import { getLast, lsGet } from '../lib/store'
import { todayPick } from '../lib/data'
import { useProjects } from '../lib/planner'
import SearchCapsule from '../components/rw/SearchCapsule'
import FolderTabCard from '../components/rw/FolderTabCard'
import ShimmerButton from '../components/rw/ShimmerButton'
import WordByWord from '../components/rw/WordByWord'
import mascot from '../assets/mascot.webp'
import mascotSm from '../assets/mascot-sm.webp'

const QUICK = ['token', 'prompt', 'api', 'database', 'git', 'deployment']

export default function Home() {
  const { idx, done, prefs, theme } = useApp()
  useEffect(() => { document.title = 'AI 造物指南' }, [])
  const { items, meta, bySlug, levelBy } = idx
  const total = items.length
  const doneN = items.filter(x => done.has(x.slug)).length
  const last = bySlug[getLast()] || null
  const first = items[0]
  const lastMode = lsGet('prefs', {}).pro && last?.pro ? '/pro' : ''
  const pick = todayPick(items, done)
  const pickLv = pick ? levelBy[pick.level] : null
  const lvStats = meta.levels.map(l => {
    const its = items.filter(x => x.level === l.name)
    const d = its.filter(x => done.has(x.slug)).length
    return { ...l, n: its.length, d }
  })

  return (
    <div className="max-w-[1240px] mx-auto px-3.5 lg:px-6 pt-4 lg:pt-7 pb-6 grid grid-cols-2 gap-3.5 lg:gap-5 lg:grid-cols-12">
      {/* 英雄区 */}
      <section className="card relative z-20 col-span-2 lg:col-span-8 lg:row-span-2 p-5 pt-6 lg:p-11 bg-[linear-gradient(140deg,var(--surface)_45%,var(--surface2))]">
        <div className="orbs" aria-hidden="true"><i /><i /><i /></div>
        <div className="relative flex gap-6 items-center">
          <div className="flex-1 min-w-0">
            <span className="chip-tag !bg-[var(--surface)]/80 backdrop-blur"><span className="emo">🧭</span>{total} 个概念 · 一页一个</span>
            <WordByWord words={['AI\u00A0', '造物', '指南']} accentFrom={1} still={prefs.still}
              className="text-[38px] lg:text-[60px] leading-[1.08] font-black tracking-[-0.01em] mt-4 mb-2.5 lg:mt-5 lg:mb-3.5" />
            <p className="text-[15px] lg:text-[19px] text-[var(--ink2)] m-0 mb-5 lg:mb-7">每页 2 分钟：一句话、比喻、动画、小测验。</p>
            <SearchCapsule idx={idx} done={done} still={prefs.still} className="max-w-[560px] z-30"
              placeholder={typeof matchMedia !== 'undefined' && matchMedia('(max-width:640px)').matches ? '搜 token、bushu、缓存…' : '中文、英文、拼音都行：token、bushu、缓存…'} />
            <div className="flex lg:flex-wrap items-center gap-2 mt-3.5 -mx-5 px-5 lg:mx-0 lg:px-0 overflow-x-auto no-scrollbar" aria-label="常见的词">
              <span className="text-[13px] text-[var(--ink3)] hidden lg:inline">常见的词：</span>
              {QUICK.filter(k => bySlug[k]).map(k => (
                <Link key={k} to={'/c/' + k} className="inline-flex flex-none items-center gap-1 min-h-[40px] px-3 rounded-full bg-[var(--surface2)]/90 hover:bg-[var(--sky)] no-underline text-[14px] font-semibold">
                  <span className="emo">{bySlug[k].emoji}</span>{bySlug[k].zh.replace(/\s*\(.*\)$/, '')}
                </Link>
              ))}
            </div>
          </div>
          <img src={mascot} alt="小罗盘：本站的吉祥物" width="640" height="640"
            className="mascot hidden md:block w-[min(260px,30%)] aspect-square object-cover rounded-[36px] shadow-[var(--sh2)] flex-none" />
          <img src={mascotSm} alt="" width="76" height="76" className="md:hidden absolute right-0 -top-2 w-[64px] h-[64px] rounded-[20px] object-cover shadow-[var(--sh)]" />
        </div>
      </section>

      {/* 继续学习 */}
      <section className="card col-span-2 lg:col-span-4 p-5 lg:p-6 flex flex-col gap-3 order-1 lg:order-none" aria-labelledby="h-resume">
        <span id="h-resume" className="chip-tag w-fit"><span className="emo">▶️</span>{last ? '继续学习' : '从这里开始'}</span>
        {(() => {
          const x = last || first
          const lv = levelBy[x.level]
          return (
            <>
              <Link to={'/c/' + x.slug + (last ? lastMode : '')} className={`${lv.cls} flex items-center gap-3.5 no-underline group`}>
                <span className="emo text-[34px] w-[60px] h-[60px] grid place-items-center rounded-[18px] bg-[var(--accs)] flex-none">{x.emoji}</span>
                <span className="min-w-0">
                  <small className="block text-[13px] text-[var(--ink2)]">{last ? '上次看到' : '第 1 个'} · {lv.emoji} {x.level} · No.{x.no}</small>
                  <b className="block text-[19px] leading-snug truncate group-hover:text-[var(--blue)]">{x.zh}</b>
                </span>
              </Link>
              <ShimmerButton to={'/c/' + x.slug + (last ? lastMode : '')} still={prefs.still} className="mt-auto w-full">
                {last ? '▶ 继续学习' : '▶ 从第 1 个开始'}
              </ShimmerButton>
            </>
          )
        })()}
      </section>

      {/* 总进度 */}
      <section className="card col-span-1 lg:col-span-4 p-4 lg:p-6 flex flex-col gap-2.5 order-4 lg:order-none" aria-labelledby="h-prog">
        <span id="h-prog" className="chip-tag w-fit"><span className="emo">🏆</span>总进度</span>
        <p className="m-0 leading-none"><b className="text-[36px] lg:text-[44px] font-black tabular">{doneN}</b><span className="text-[16px] lg:text-[19px] text-[var(--ink2)] font-semibold"> / {total}</span></p>
        <div className="pbar !h-3" style={{ '--acc': 'var(--blue)' }}><i style={{ width: `${total ? doneN / total * 100 : 0}%` }} /></div>
        <p className="m-0 text-[13px] lg:text-[14px] text-[var(--ink2)] leading-relaxed"><span className="hidden lg:inline">点概念页里的「🙋 我学会了」就会记在这里</span><span className="lg:hidden">点「我学会了」记进度</span>（只存在你的浏览器）。</p>
      </section>

      {/* 四个级别 */}
      <section className="col-span-2 lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 order-2 lg:order-none" aria-label="四个级别">
        {lvStats.map(l => (
          <FolderTabCard key={l.cls} to={'/l/' + l.cls} cls={l.cls} emoji={l.emoji} title={l.name} subtitle={l.tag}
            count={l.d} countLabel={`/ ${l.n} 已学会`} right={`${l.n ? Math.round(l.d / l.n * 100) : 0}%`}
            percent={l.n ? l.d / l.n * 100 : 0} dark={theme === 'dark'} still={prefs.still} />
        ))}
      </section>

      {/* AI 帮我规划 + 知识图谱（两个新功能并排一行：桌面 8 + 4；手机 AI 卡紧跟级别，图谱卡放词汇表后面） */}
      <AiPlanCard />
      <GraphCard total={total} />

      {/* 今日推荐 */}
      <section className={`card col-span-2 lg:col-span-5 p-5 lg:p-6 flex flex-col gap-3 order-3 lg:order-none ${pickLv?.cls || ''} bg-[linear-gradient(150deg,var(--lemon),var(--surface)_70%)]`} aria-labelledby="h-today">
        <span id="h-today" className="chip-tag w-fit !bg-[var(--surface)]/80"><span className="emo">☀️</span>今日推荐</span>
        {pick ? (
          <>
            <Link to={'/c/' + pick.slug} className="flex gap-3.5 items-center no-underline group">
              <span className="emo text-[38px] w-[68px] h-[68px] grid place-items-center bg-[var(--surface)]/85 rounded-[20px] flex-none shadow-[var(--sh)]">{pick.emoji}</span>
              <span className="min-w-0">
                <b className="block text-[21px] leading-snug group-hover:text-[var(--blue)]">{pick.zh}</b>
                <small className="block text-[14px] text-[var(--ink2)]">{pick.en} · {pickLv.emoji} {pick.level}</small>
              </span>
            </Link>
            <p className="m-0 text-[16px] leading-relaxed text-[var(--ink)]">{pick.oneLiner}</p>
            <Link to={'/c/' + pick.slug} className="btn btn-pri w-fit mt-auto !min-h-[46px] !text-[15px]">去看看 <ArrowRight size={17} /></Link>
          </>
        ) : (
          <div className="flex gap-3 items-center">
            <img src={mascotSm} alt="" className="w-16 h-16 rounded-[18px]" />
            <p className="m-0"><b>{total} 个全学会了！</b><br />随便挑一个复习吧。</p>
          </div>
        )}
      </section>

      {/* 词汇表 */}
      <Link to="/glossary" className="card col-span-1 lg:col-span-3 p-4 lg:p-6 flex flex-col gap-1.5 order-5 lg:order-none no-underline bg-[linear-gradient(150deg,var(--sky),var(--surface)_80%)] hover:-translate-y-1 transition-transform">
        <span className="chip-tag w-fit !bg-[var(--surface)]/80"><span className="emo">📚</span>词汇表</span>
        <b className="text-[26px] lg:text-[30px] font-black mt-2 leading-tight">{total} 个词</b>
        <p className="m-0 text-[15px] text-[var(--ink2)]">中英对照，按级别筛选</p>
        <span className="mt-auto pt-2 font-bold text-[var(--blue)] inline-flex items-center gap-1">打开 <ArrowRight size={17} /></span>
      </Link>

      {/* 怎么用 */}
      <section className="card col-span-2 lg:col-span-4 p-5 lg:p-6 order-6 lg:order-none" aria-labelledby="h-tips">
        <span id="h-tips" className="chip-tag"><span className="emo">💡</span>怎么用</span>
        <ul className="list-none m-0 mt-3.5 p-0 grid gap-2">
          {[['🐢', '一次只看一张', '看完点「我学会了」'], ['🔊', '不想读字？', '点「读给我听」'], ['⚙️', '字太挤？', '设置里开「宽松阅读」'], ['📋', '不会写？', '复制每页「给 AI 的话」']].map(([e, b, t]) => (
            <li key={b} className="flex gap-2.5 items-center bg-[var(--surface2)] rounded-2xl px-3 py-2 min-h-[44px]">
              <span className="emo text-[20px] w-7 text-center flex-none">{e}</span>
              <p className="m-0 text-[14px] leading-snug text-[var(--ink2)] min-w-0"><b className="text-[var(--ink)] mr-1.5">{b}</b>{t}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function AiPlanCard() {
  const projects = useProjects()
  return (
    <section className="card col-span-2 lg:col-span-8 p-5 lg:p-7 order-2 lg:order-none flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-7 bg-[linear-gradient(120deg,var(--lilac),var(--surface)_55%,var(--sky))]" aria-labelledby="h-ai" data-testid="home-ai-card">
      <div className="flex-1 min-w-0">
        <span id="h-ai" className="chip-tag !bg-[var(--surface)]/80"><span className="emo">✨</span>实战路线 · AI 规划</span>
        <b className="block text-[21px] lg:text-[26px] font-black leading-snug mt-3">挑一条精选实战路线直接开练，或让 AI 定制专属路线</b>
        <p className="m-0 mt-1.5 text-[15px] text-[var(--ink2)] leading-relaxed">内置 6 条零配置项目路线即点即学；也可配置你自己的 AI 按想法排课，概念页全程项目伴学。</p>
      </div>
      <div className="flex flex-wrap gap-2.5 flex-none">
        <Link to="/plan" className="btn btn-pri !min-h-[52px] flex-1 sm:flex-none"><Sparkles size={18} />开始规划</Link>
        {projects.length > 0 && <Link to="/projects" className="btn btn-soft !bg-[var(--surface)] !min-h-[52px] flex-1 sm:flex-none"><FolderKanban size={18} />我的项目 {projects.length}</Link>}
      </div>
    </section>
  )
}

function GraphCard({ total }) {
  return (
    <Link to="/graph" data-testid="home-graph-card" aria-labelledby="h-graph"
      className="card col-span-2 lg:col-span-4 p-5 lg:p-7 order-6 lg:order-none no-underline flex lg:flex-col gap-4 lg:gap-2 items-center lg:items-start bg-[linear-gradient(150deg,var(--pist),var(--surface)_75%)] hover:-translate-y-1 transition-transform">
      <span className="lg:hidden emo text-[30px] w-[58px] h-[58px] grid place-items-center rounded-[18px] bg-[var(--surface)]/85 flex-none shadow-[var(--sh)]">🕸️</span>
      <span className="min-w-0 flex-1 lg:flex-none flex flex-col gap-1.5 lg:gap-2">
        <span id="h-graph" className="chip-tag w-fit !bg-[var(--surface)]/80"><Waypoints size={15} />知识图谱</span>
        <b className="text-[19px] lg:text-[22px] font-black leading-snug"><span className="lg:hidden">概念关系网</span><span className="hidden lg:inline">{total} 个概念连成一张网</span></b>
        <span className="text-[14px] lg:text-[15px] text-[var(--ink2)] leading-snug lg:leading-relaxed"><span className="lg:hidden">谁和谁有关、先学哪个</span><span className="hidden lg:inline">看谁和谁有关、先学哪个，学会的会亮起来。</span></span>
      </span>
      <span className="lg:mt-auto lg:pt-1 font-bold text-[var(--blue)] inline-flex items-center gap-1 flex-none"><span className="hidden lg:inline">打开图谱</span><ArrowRight size={19} className="lg:w-[17px] lg:h-[17px]" /></span>
    </Link>
  )
}
