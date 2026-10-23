import { createContext, useCallback, useContext, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, Settings2, X, SlidersHorizontal } from 'lucide-react'
import { useIndex, randomUnlearned } from './lib/data'
import { useDone, usePrefs, useTheme, lsGet } from './lib/store'
import { stopSpeak } from './lib/fx'
import DockSidebar from './components/rw/DockSidebar'
import MobileDock from './components/rw/MobileDock'
import ThemeToggle from './components/rw/ThemeToggle'
import SearchCapsule from './components/rw/SearchCapsule'
import Skeleton from './components/rw/Skeleton'
import mascotSm from './assets/mascot-sm.webp'
import Home from './pages/Home'
import SearchFilters, { filterCount } from './components/search/SearchFilters'

const Level = lazy(() => import('./pages/Level'))
const Concept = lazy(() => import('./pages/Concept'))
const Glossary = lazy(() => import('./pages/Glossary'))
const Graph = lazy(() => import('./pages/Graph'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const Plan = lazy(() => import('./pages/Plan'))
const Projects = lazy(() => import('./pages/Projects'))

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export default function App() {
  return <HashRouter><Shell /></HashRouter>
}

function Shell() {
  const { data: idx, error } = useIndex()
  const [done, toggleDone] = useDone()
  const [prefs, setPrefs] = usePrefs()
  const [theme, setTheme] = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()

  // 阅读设置 / 主题 → <html>/<body>
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', prefs.fs + 'px')
    const b = document.body.classList
    b.toggle('calm', !!prefs.calm); b.toggle('focus', !!prefs.focus); b.toggle('still', !!prefs.still)
  }, [prefs])
  useEffect(() => {
    const dark = theme === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E0E11' : '#F5F5F7')
  }, [theme])

  // 换页：回到顶部、停止朗读、关浮层
  useEffect(() => { window.scrollTo(0, 0); stopSpeak(); setSearchOpen(false); setSettingsOpen(false) }, [loc.pathname])

  // 全局快捷键：/ 打开搜索，Esc 关闭
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { setSearchOpen(false); setSettingsOpen(false) }
      if (e.key === '/' && !e.target.closest?.('input,textarea,[contenteditable]')) { e.preventDefault(); setSearchOpen(true) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const goRandom = useCallback(() => {
    if (!idx) return
    const p = randomUnlearned(idx.items, done); if (p) nav('/c/' + p.slug)
  }, [idx, done, nav])

  const path = loc.pathname
  const active = path === '/' ? 'home' : path.startsWith('/l/') ? path.slice(3, 5) : path.startsWith('/glossary') ? 'glossary'
    : path.startsWith('/graph') ? 'graph' : path.startsWith('/search') ? 'search'
    : path.startsWith('/plan') ? 'plan' : path.startsWith('/projects') ? 'projects'
    : path.startsWith('/c/') && idx ? (idx.levelBy[idx.bySlug[path.split('/')[2]]?.level]?.cls || '') : ''
  const isConcept = path.startsWith('/c/')
  const isGraph = path.startsWith('/graph')
  const lastLevel = (() => { const s = lsGet('last', null); const x = idx?.bySlug[s]; return x ? idx.levelBy[x.level].cls : 'l1' })()

  const ctx = useMemo(() => ({
    idx, done, toggleDone, prefs, setPrefs, theme, setTheme,
    openSearch: () => setSearchOpen(true), openSettings: () => setSettingsOpen(o => !o), goRandom,
  }), [idx, done, toggleDone, prefs, setPrefs, theme, setTheme, goRandom])

  return (
    <Ctx.Provider value={ctx}>
      <a href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus() }}
        className="absolute -left-[999px] top-2 z-[200] bg-[var(--surface)] px-3.5 py-2 rounded-xl focus:left-2">跳到正文</a>

      {idx && (
        <DockSidebar active={settingsOpen ? 'settings' : active} levels={idx.meta.levels} onNav={p => nav(p)}
          onSearch={() => setSearchOpen(true)} onRandom={goRandom} onSettings={() => setSettingsOpen(o => !o)}
          settingsOpen={settingsOpen} theme={theme} setTheme={setTheme} still={prefs.still} />
      )}

      {/* 手机顶栏 */}
      <header className="lg:hidden sticky top-0 z-40 bg-[var(--bg)]/85 backdrop-blur-xl border-b border-[var(--line)]">
        <div className="h-[58px] flex items-center justify-between gap-2 pl-3.5 pr-2">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-[17px] font-extrabold whitespace-nowrap min-w-0">
            <img src={mascotSm} alt="" width="32" height="32" className="w-8 h-8 rounded-[10px] object-cover" />
            <span>AI 造物指南</span>
          </Link>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="搜索" className="w-11 h-11 grid place-items-center rounded-full hover:bg-[var(--surface2)]"><Search size={21} /></button>
            <button type="button" onClick={() => setSettingsOpen(o => !o)} aria-label="阅读设置" aria-expanded={settingsOpen} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[var(--surface2)]"><Settings2 size={21} /></button>
            <div className="w-[64px] h-11 grid place-items-center"><ThemeToggle size="md" isDark={theme === 'dark'} onChange={d => setTheme(d ? 'dark' : 'light')} /></div>
          </div>
        </div>
      </header>

      <div className="lg:pl-[100px]">
        <main id="main" tabIndex={-1} className="outline-none">
          {error ? <LoadError /> : !idx ? <PageSkeleton /> : (
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/l/:lv" element={<Level />} />
                <Route path="/c/:slug" element={<Concept mode="easy" />} />
                <Route path="/c/:slug/pro" element={<Concept mode="pro" />} />
                <Route path="/glossary" element={<Glossary />} />
                <Route path="/graph" element={<Graph />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<Projects />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          )}
        </main>
        {!isGraph && <footer className={`text-center text-[var(--ink3)] text-[14px] pt-7 ${isConcept ? 'pb-28 lg:pb-10' : 'pb-32 lg:pb-10'}`}>🧭 AI 造物指南 · by Q1f730</footer>}
      </div>

      {!isConcept && idx && <MobileDock active={/^l\d$/.test(active) ? 'learn' : active === 'projects' ? 'plan' : active} onNav={p => nav(p)} onRandom={goRandom} onSettings={() => setSettingsOpen(true)} learnTo={'/l/' + lastLevel} still={prefs.still} />}

      <AnimatePresence>{settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{searchOpen && idx && <SearchOverlay onClose={() => setSearchOpen(false)} />}</AnimatePresence>
    </Ctx.Provider>
  )
}

function PageSkeleton() {
  return (
    <div className="max-w-[1240px] mx-auto px-3.5 lg:px-6 py-4 lg:py-7 grid gap-4" aria-busy="true" aria-label="加载中">
      <Skeleton className="h-[220px] lg:h-[300px] rounded-[28px]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[180px] lg:h-[260px] rounded-[28px]" />)}</div>
    </div>
  )
}
function LoadError() {
  return <div className="max-w-xl mx-auto p-8 text-center"><p className="text-[20px] font-bold">数据没加载出来 😵</p><p className="text-[var(--ink2)]">检查一下网络，然后刷新页面试试。</p><button className="btn btn-pri mt-3" onClick={() => location.reload()}>刷新</button></div>
}
function NotFound() {
  return (
    <div className="max-w-xl mx-auto p-8 text-center">
      <img src={mascotSm} alt="" width="96" height="96" className="w-24 h-24 rounded-3xl mx-auto mb-3" />
      <p className="text-[22px] font-extrabold m-0">这一页不存在</p>
      <p className="text-[var(--ink2)]">可能是链接打错了。</p>
      <Link to="/" className="btn btn-pri mt-2">回首页</Link>
    </div>
  )
}

function Switch({ on, onClick, title, sub, emoji }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-3 px-1 min-h-[60px] text-left border-t border-[var(--line)]">
      <span className="font-semibold text-[16px] leading-snug"><span className="emo mr-1.5">{emoji}</span>{title}<small className="block font-normal text-[13px] text-[var(--ink2)]">{sub}</small></span>
      <i className={`flex-none relative w-[50px] h-[30px] rounded-full transition-colors ${on ? 'bg-[#34C759]' : 'bg-[var(--surface3)]'}`}>
        <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-[23px]' : 'left-[3px]'}`} />
      </i>
    </button>
  )
}

function SettingsSheet({ onClose }) {
  const { prefs, setPrefs, theme, setTheme } = useApp()
  const reduce = useReducedMotion() || prefs.still
  const isMobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width:1023px)').matches
  return (
    <>
      <motion.div key="scrim" className="fixed inset-0 z-[80] bg-black/30" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div key="sheet" role="dialog" aria-modal="true" aria-label="阅读设置"
        initial={reduce ? { opacity: 0 } : isMobile ? { y: '100%' } : { opacity: 0, x: -8, scale: 0.98 }}
        animate={reduce ? { opacity: 1 } : isMobile ? { y: 0 } : { opacity: 1, x: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : isMobile ? { y: '100%' } : { opacity: 0, x: -8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="fixed z-[90] bg-[var(--surface)] shadow-[var(--sh2)] border border-[var(--line)] inset-x-0 bottom-0 rounded-t-[24px] px-5 pt-2.5 lg:inset-x-auto lg:left-[100px] lg:top-auto lg:bottom-4 lg:w-[360px] lg:rounded-[24px] lg:pt-4 lg:pb-4"
        style={{ paddingBottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : undefined }}>
        <div className="lg:hidden w-10 h-[5px] rounded-full bg-[var(--surface3)] mx-auto mb-2.5" />
        <div className="flex items-center justify-between mb-2">
          <b className="text-[17px]"><span className="emo">⚙️</span> 阅读设置</b>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-11 h-11 grid place-items-center rounded-full bg-[var(--surface2)]"><X size={18} /></button>
        </div>
        <div className="flex items-center justify-between gap-3 py-3 px-1 border-t border-[var(--line)]">
          <span className="font-semibold text-[16px]"><span className="emo mr-1.5">🔠</span>字号</span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPrefs(p => ({ fs: Math.max(15, p.fs - 1) }))} aria-label="字变小" className="w-11 h-11 rounded-xl bg-[var(--surface2)] font-extrabold">A-</button>
            <em className="not-italic min-w-[2.4em] text-center tabular" aria-live="polite">{prefs.fs}</em>
            <button type="button" onClick={() => setPrefs(p => ({ fs: Math.min(26, p.fs + 1) }))} aria-label="字变大" className="w-11 h-11 rounded-xl bg-[var(--surface2)] font-extrabold">A+</button>
          </div>
        </div>
        <Switch emoji="🫧" title="宽松阅读" sub="字距、行距更大" on={prefs.calm} onClick={() => setPrefs(p => ({ calm: !p.calm }))} />
        <Switch emoji="🔦" title="专注模式" sub="只亮当前这一块" on={prefs.focus} onClick={() => setPrefs(p => ({ focus: !p.focus }))} />
        <Switch emoji="⏸️" title="暂停动画" sub="动画定格，不再晃" on={prefs.still} onClick={() => setPrefs(p => ({ still: !p.still }))} />
        <Switch emoji="🌙" title="深色模式" sub="晚上看更护眼" on={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      </motion.div>
    </>
  )
}

function SearchOverlay({ onClose }) {
  const { idx, done, prefs } = useApp()
  const [filters, setFilters] = useState({ lv: 'all', cat: 'all', scope: 'all' })
  const [showF, setShowF] = useState(false)
  const n = filterCount(filters)
  return (
    <motion.div role="dialog" aria-modal="true" aria-label="搜索" className="fixed inset-0 z-[95] bg-[var(--bg)]/90 backdrop-blur-xl overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="max-w-[680px] mx-auto px-3 pt-3 pb-10 lg:pt-[8vh]" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="flex items-start gap-2">
          <SearchCapsule className="flex-1 min-w-0" idx={idx} done={done} autoFocus dropdown={false} filters={filters}
            placeholder="中文、英文、拼音都行，比如 token、dyymx" onEscape={onClose} still={prefs.still} listClassName="mr-[-76px]"
            slot={
              <div className="mt-2.5 mr-[-76px]">
                <button type="button" onClick={() => setShowF(v => !v)} aria-expanded={showF} data-testid="overlay-filter"
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-[14px] font-semibold shadow-[var(--sh)] ${showF || n ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--ink2)]'}`}>
                  <SlidersHorizontal size={16} />筛选{n ? ` · ${n}` : ''}
                </button>
                {showF && <div className="mt-2.5"><SearchFilters idx={idx} value={filters} onChange={setFilters} still={prefs.still} compact idp="ov" /></div>}
              </div>
            } />
          <button type="button" onClick={onClose} className="h-14 w-[68px] rounded-full bg-[var(--surface)] font-semibold shadow-[var(--sh)] flex-none">取消</button>
        </div>
        <p className="text-center text-[var(--ink3)] text-[13px] mt-4">↑ ↓ 选择 · 回车打开 · Esc 关闭 · 支持拼音全拼和首字母</p>
      </div>
    </motion.div>
  )
}
