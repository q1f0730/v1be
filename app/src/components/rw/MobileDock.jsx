// 来自 Rewamp UI: src/components/ui/DarkModeMobileNavbarShowcase.jsx（registry: dark-mode-mobile-navbar）
// 用途：手机（<1024px）底部悬浮导航：首页 / 学习（上次的级别）/ AI 规划 / 图谱 / 更多。
//       「更多」向上弹出一个小面板：我的项目 / 词汇表 / 随机一个 / 阅读设置。（搜索、设置、深色模式在顶栏）
//       概念页不显示（那里换成翻卡底栏）。
// 保留：白色（深色模式为 #181622）圆角胶囊、黑色选中圆块 layoutId 弹簧滑动、按下的浅色反馈。
// 改动：
//  - 手机没有悬停，原来的悬停气泡提示改成图标下方常驻的中文小字（不会代码的读者需要文字）
//  - 固定 5 个按钮，每个 62~68×52（≥ 44px 点击区；360px 宽也放得下，「AI 规划」不截断）；避开 iPhone 底部安全区
//  - 两个分支各加了第 5 个按钮（图谱 / AI 规划），合并后把词汇表、随机收进「更多」，我的项目也放这里
//    （/projects 仍高亮「AI 规划」，因为项目由规划生成）；搜索不进底栏，因为顶栏已有放大镜
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Home, BookOpen, Library, Dices, Waypoints, Sparkles, LayoutGrid, FolderKanban, Settings2, FlaskConical } from 'lucide-react'

export default function MobileDock({ active, onNav, onRandom, onSettings, learnTo, still }) {
  const reduce = useReducedMotion() || still
  const [more, setMore] = useState(false)
  const wrap = useRef(null)
  const moreIds = ['glossary', 'lab']
  useEffect(() => { setMore(false) }, [active])
  useEffect(() => {
    if (!more) return
    const onKey = e => { if (e.key === 'Escape') setMore(false) }
    const onDown = e => { if (wrap.current && !wrap.current.contains(e.target)) setMore(false) }
    window.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [more])

  const close = fn => () => { setMore(false); fn() }
  const items = [
    { id: 'home', label: '首页', icon: Home, run: () => onNav('/') },
    { id: 'learn', label: '学习', icon: BookOpen, run: () => onNav(learnTo) },
    { id: 'plan', label: 'AI 规划', icon: Sparkles, run: () => onNav('/plan') }, // 我的项目也高亮这里
    { id: 'graph', label: '图谱', icon: Waypoints, run: () => onNav('/graph') },
    { id: 'more', label: '更多', icon: LayoutGrid, run: () => setMore(m => !m) },
  ]
  const extra = [
    { id: 'lab', label: '动手实验室', icon: FlaskConical, run: close(() => onNav('/lab')) },
    { id: 'projects', label: '我的项目', icon: FolderKanban, run: close(() => onNav('/projects')) },
    { id: 'glossary', label: '词汇表', icon: Library, run: close(() => onNav('/glossary')) },
    { id: 'random', label: '随机一个', icon: Dices, run: close(onRandom) },
    { id: 'settings', label: '阅读设置', icon: Settings2, run: close(() => onSettings && onSettings()) },
  ]
  const shown = more ? 'more' : moreIds.includes(active) ? 'more' : active

  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
      <div ref={wrap} className="relative pointer-events-auto">
        <AnimatePresence>
          {more && (
            <motion.div key="more" id="dock-more" role="menu" aria-label="更多"
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34 }}
              style={{ transformOrigin: 'bottom right' }}
              className="absolute bottom-full right-0 mb-2.5 w-[min(320px,calc(100vw-24px))] rounded-[22px] bg-white/97 dark:bg-[#181622]/97 backdrop-blur-xl p-2 border border-black/[0.08] dark:border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.16)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.65)] grid grid-cols-2 gap-1.5">
              {extra.map(it => {
                const Icon = it.icon
                const cur = active === it.id
                return (
                  <button key={it.id} type="button" role="menuitem" onClick={it.run} aria-current={cur ? 'page' : undefined}
                    className={`h-[52px] flex items-center gap-2.5 px-3.5 rounded-2xl text-left whitespace-nowrap ${cur ? 'bg-zinc-900 text-white dark:bg-white/20' : 'bg-black/[0.035] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 active:bg-black/[0.08] dark:active:bg-white/[0.1]'}`}>
                    <Icon size={19} strokeWidth={2} className={cur ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'} />
                    <span className="text-[15px] font-semibold">{it.label}</span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
        <nav aria-label="主导航"
          className="relative inline-flex items-center gap-0.5 min-[400px]:gap-1 rounded-full bg-white/95 dark:bg-[#181622]/95 backdrop-blur-xl p-1.5 border border-black/[0.08] dark:border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          {items.map(it => {
            const isActive = shown === it.id
            const Icon = it.icon
            const isMore = it.id === 'more'
            return (
              <motion.button key={it.id} type="button" onClick={it.run}
                aria-current={isActive && !isMore ? 'page' : undefined}
                aria-expanded={isMore ? more : undefined} aria-controls={isMore ? 'dock-more' : undefined} aria-haspopup={isMore ? 'menu' : undefined}
                whileTap={reduce ? undefined : { scale: 0.92 }}
                className="relative w-[62px] min-[400px]:w-[68px] h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-full">
                {isActive && (
                  <motion.span layoutId="dark-nav-active" className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-white/20"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }} />
                )}
                <Icon size={19} strokeWidth={2} className={`relative z-10 ${isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span className={`relative z-10 text-[11px] font-semibold leading-none whitespace-nowrap ${isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{it.label}</span>
              </motion.button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
