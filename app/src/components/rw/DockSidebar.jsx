// 来自 Rewamp UI: src/components/ui/Sidebar.jsx（registry: sidebar，"Animated Dock Sidebar"）
// 用途：桌面端（≥1024px）左侧导航坞：首页 / 四个级别 / AI 帮我规划 / 我的项目 / 词汇表 / 知识图谱 / 随机一个 / 阅读设置 / 搜索 / 深色模式。
// 保留：68px 竖向坞、分组细线、选中药丸 + 左侧小竖条（layoutId 弹簧滑动）、悬停右侧黑色气泡提示 + 快捷键角标、
//       仪表盘四宫格 / 文档线条 / 齿轮旋转 / 放大镜摆动这些图标微动画（原样保留实现）。
// 改动：
//  - 去掉 macOS 红黄绿三个窗口按钮和花朵 logo（装饰），换成吉祥物头像（点了回首页）
//  - 菜单项接入路由：用 react-router 的 navigate，选中态由当前地址决定（不是本地 state）
//  - 四个级别用 emoji 图标；选中药丸用该级别的浅色
//  - 底部加入 Rewamp ThemeToggle；提示文字全部中文；颜色改用本站变量
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Settings, Search, Dices, Waypoints, Sparkles, FolderKanban, FlaskConical } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import mascot from '../../assets/mascot-sm.webp'

// 1. 仪表盘：四宫格错峰涟漪（原样）
function AnimatedDashboardIcon({ isHovered, isActive }) {
  return (
    <div className="relative w-5 h-5 grid grid-cols-2 gap-[2.5px] p-0.5">
      {[0, 1, 3, 2].map((i, idx) => (
        <motion.div key={i} className={`rounded-[2px] ${isActive ? 'bg-[var(--ink)]' : 'bg-[var(--ink2)]'}`}
          animate={isHovered ? { scale: [1, 1.22, 1], rotate: [0, idx % 2 === 0 ? 8 : -8, 0], borderRadius: ['2px', '3.5px', '2px'] } : { scale: 1, rotate: 0, borderRadius: '2px' }}
          transition={{ duration: 0.45, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }} />
      ))}
    </div>
  )
}
// 5. 文档：内容线条滑动（原样）→ 词汇表
function AnimatedDocumentsIcon({ isHovered, isActive }) {
  return (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <div className={`w-[17px] h-[19px] rounded-[3px] border-[1.8px] relative flex flex-col justify-center px-1 gap-[2.5px] ${isActive ? 'border-[var(--ink)]' : 'border-[var(--ink2)]'}`}>
        {[0, 1, 2].map(line => (
          <motion.div key={line} className={`h-[1.5px] rounded-full ${isActive ? 'bg-[var(--ink)]' : 'bg-[var(--ink2)]'}`}
            style={{ width: line === 2 ? '55%' : '80%', originX: 0 }}
            animate={isHovered ? { scaleX: [1, 0.4, 1.1, 1] } : { scaleX: 1 }}
            transition={{ duration: 0.45, delay: line * 0.07, ease: 'easeInOut' }} />
        ))}
      </div>
    </div>
  )
}
// 3. 齿轮旋转（原样）→ 阅读设置
function AnimatedSettingsIcon({ isHovered, isActive }) {
  return (
    <motion.div animate={isHovered ? { rotate: 90 } : { rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }} className="flex items-center justify-center">
      <Settings size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
    </motion.div>
  )
}
// 6. 日历摇摆（原样动画）→ 换成骰子图标做「随机一个」
function AnimatedDiceIcon({ isHovered, isActive }) {
  return (
    <motion.div animate={isHovered ? { rotate: [0, -7, 7, -3, 3, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.48, ease: 'easeInOut' }} className="flex items-center justify-center">
      <Dices size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
    </motion.div>
  )
}
// 7. 放大镜缩放摆动（原样）
function AnimatedSearchIcon({ isHovered }) {
  return (
    <motion.div animate={isHovered ? { rotate: [0, -12, 12, 0], scale: [1, 1.16, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }} className="flex items-center justify-center">
      <Search size={20} strokeWidth={1.9} className="text-[var(--ink2)]" />
    </motion.div>
  )
}
// 新增：知识图谱。沿用「放大镜摆动」同款弹簧：悬停时节点图标转一下、放大一点
function AnimatedGraphIcon({ isHovered, isActive }) {
  return (
    <motion.div animate={isHovered ? { rotate: [0, 18, -8, 0], scale: [1, 1.14, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="flex items-center justify-center">
      <Waypoints size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
    </motion.div>
  )
}
// AI 规划 / 我的项目（新增）：星光轻摇、文件夹上浮
function AnimatedSparkIcon({ isHovered, isActive }) {
  return (
    <motion.div animate={isHovered ? { rotate: [0, 14, -10, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.5, ease: 'easeInOut' }} className="flex items-center justify-center">
      <Sparkles size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
    </motion.div>
  )
}
function AnimatedFolderIcon({ isHovered, isActive }) {
  return (
    <motion.div animate={isHovered ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="flex items-center justify-center">
      <FolderKanban size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
    </motion.div>
  )
}
function AnimatedLabIcon({ isHovered, isActive }) {
  return <motion.div animate={isHovered ? { rotate: [0, -12, 8, 0], y: [0, -2, 0] } : { rotate: 0, y: 0 }} transition={{ duration: 0.45 }}>
    <FlaskConical size={20} strokeWidth={1.9} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'} />
  </motion.div>
}
function EmojiIcon({ emoji, isHovered }) {
  return <motion.span className="emo text-[20px]" animate={isHovered ? { scale: 1.18, rotate: -6 } : { scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>{emoji}</motion.span>
}

function Tip({ label, shortcut }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -6, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 480, damping: 28 }}
      className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 pointer-events-none flex items-center">
      <div className="w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-neutral-900" />
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/95 border border-white/10 text-white text-[13px] shadow-xl backdrop-blur-md whitespace-nowrap">
        <span className="font-medium">{label}</span>
        {shortcut && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/15 text-neutral-300 border border-white/10">{shortcut}</span>}
      </div>
    </motion.div>
  )
}

function IconCell({ item, active, hovered, setHovered, onAct, reduce }) {
  const Icon = item.icon
  const isActive = active === item.id
  const isHovered = hovered === item.id && !reduce
  return (
    <div className="relative w-full h-[clamp(44px,5.1vh,48px)] flex items-center justify-center" onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)}>
      <button type="button" onClick={() => onAct(item)} aria-label={item.label} title={item.label} aria-current={isActive ? 'page' : undefined}
        onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)}
        className={`${item.cls || ''} relative w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer`}>
        {isActive && (
          <motion.div layoutId="sidebar-active-pill"
            className="absolute inset-0 rounded-xl bg-[var(--accs)] border border-[color-mix(in_srgb,var(--acc)_35%,transparent)] shadow-xs"
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }} />
        )}
        <div className={`relative z-10 flex items-center justify-center rounded-lg w-full h-full ${!isActive ? 'hover:bg-[var(--surface2)]' : ''}`}>
          <Icon isHovered={isHovered} isActive={isActive} emoji={item.emoji} />
        </div>
        {isActive && (
          <motion.div layoutId="sidebar-active-pip" className="absolute -left-[13px] w-1 h-4 rounded-r-full bg-[var(--acc)]"
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }} />
        )}
      </button>
      <AnimatePresence>{hovered === item.id && <Tip label={item.label} shortcut={item.shortcut} />}</AnimatePresence>
    </div>
  )
}

export default function DockSidebar({ active, levels, onNav, onSearch, onRandom, onSettings, settingsOpen, theme, setTheme, still }) {
  const [hovered, setHovered] = useState(null)
  const reduce = useReducedMotion() || still
  const cell = { active, hovered, setHovered, reduce, onAct: it => it.run() }
  const home = { id: 'home', label: '首页', icon: AnimatedDashboardIcon, cls: 'l2', run: () => onNav('/') }
  const lv = levels.map(l => ({ id: l.cls, label: `${l.name} · ${l.tag}`, emoji: l.emoji, icon: EmojiIcon, cls: l.cls, run: () => onNav('/l/' + l.cls) }))
  const ai = [ // 新增分组：AI 规划 / 我的项目
    { id: 'plan', label: 'AI 帮我规划', icon: AnimatedSparkIcon, cls: 'l3', run: () => onNav('/plan') },
    { id: 'projects', label: '我的项目', icon: AnimatedFolderIcon, cls: 'l3', run: () => onNav('/projects') },
  ]
  const tools = [
    { id: 'lab', label: '动手实验室', icon: AnimatedLabIcon, cls: 'l3', run: () => onNav('/lab') },
    { id: 'glossary', label: '词汇表', icon: AnimatedDocumentsIcon, cls: 'l2', run: () => onNav('/glossary') },
    { id: 'graph', label: '知识图谱', icon: AnimatedGraphIcon, cls: 'l2', run: () => onNav('/graph') },
    { id: 'random', label: '随机学一个没学过的', icon: AnimatedDiceIcon, cls: 'l2', run: onRandom },
    { id: 'settings', label: '阅读设置', icon: AnimatedSettingsIcon, cls: 'l2', run: onSettings },
  ]
  return (
    <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="主导航"
      className="hidden lg:flex fixed z-40 left-4 top-4 w-[68px] max-h-[calc(100vh-32px)] rounded-2xl shadow-xl border border-[var(--line)] bg-[var(--surface)] flex-col overflow-visible">
      <div className="dock-scroll-area">
        <div className="flex items-center justify-center pt-3 pb-2.5 border-b border-[var(--line)]">
          <button type="button" onClick={() => onNav('/')} aria-label="AI 造物指南 首页" title="AI 造物指南"
            className="w-11 h-11 rounded-xl overflow-hidden shadow-xs hover:scale-105 transition-transform">
            <img src={mascot} alt="" width="44" height="44" className="w-full h-full object-cover" />
          </button>
        </div>
        <div className="border-b border-[var(--line)] py-1"><IconCell item={home} {...cell} /></div>
        <div className="border-b border-[var(--line)] py-1">{lv.map(it => <IconCell key={it.id} item={it} {...cell} />)}</div>
        <div className="border-b border-[var(--line)] py-1">{ai.map(it => <IconCell key={it.id} item={it} {...cell} />)}</div>
        <div className="py-1">{tools.map(it => <IconCell key={it.id} item={{ ...it }} {...cell} active={it.id === 'settings' && settingsOpen ? 'settings' : active} />)}</div>
      </div>
      <div className="border-t border-[var(--line)] pt-1">
        <div className="flex justify-center py-2"><ThemeToggle size="md" isDark={theme === 'dark'} onChange={d => setTheme(d ? 'dark' : 'light')} /></div>
        <div className="relative px-3 pb-3 pt-1" onMouseEnter={() => setHovered('search')} onMouseLeave={() => setHovered(null)}>
          <button type="button" onClick={onSearch} aria-label="搜索（按 / 键）"
            className="w-full h-11 flex items-center justify-center rounded-xl border border-[var(--line)] hover:border-[var(--ink3)] transition-colors">
            <AnimatedSearchIcon isHovered={hovered === 'search' && !reduce} />
          </button>
          <AnimatePresence>{hovered === 'search' && <Tip label="搜索" shortcut="/" />}</AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
