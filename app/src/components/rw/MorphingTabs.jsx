// 来自 Rewamp UI: src/components/ui/MorphingTabNavbarShowcase.jsx（registry: morphing-tab-navbar）
// 用途：级别切换（初级 / 中级 / 高级 / 进阶），一次只看一个级别。
// 改动：
//  - 从演示组件改成通用受控组件：items/active 由外部传入，按钮换成 react-router 的 <Link>（可分享、可后退）
//  - lucide 图标换成每个级别的 emoji；滑动气泡用该级别的浅色（--accs）并加一圈级别色描边
//  - 手机 4 等分铺满（每格 ≥ 44px 高），桌面自适应宽度；显示可选的进度小字
//  - 尊重「暂停动画」/ 系统减少动效：气泡直接跳转不做弹簧
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function MorphingTabs({ items, active, layoutId = 'morph-tab-bubble', still = false, className = '', ariaLabel = '切换' }) {
  const reduce = useReducedMotion() || still
  return (
    <nav aria-label={ariaLabel}
      className={`relative grid grid-flow-col auto-cols-fr lg:inline-grid lg:auto-cols-auto items-center gap-1 p-1.5 rounded-full bg-[var(--surface)]/85 border border-[var(--line)] backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.08)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.6)] ${className}`}>
      {items.map(tab => {
        const isActive = active === tab.id
        return (
          <Link key={tab.id} to={tab.to} replace={tab.replace} aria-current={isActive ? 'page' : undefined}
            className={`${tab.cls || ''} relative flex items-center justify-center gap-1.5 min-h-[44px] px-2 lg:px-5 rounded-full no-underline transition-colors duration-300 ${isActive ? 'text-[var(--ink)]' : 'text-[var(--ink2)] hover:text-[var(--ink)]'}`}>
            {isActive && (
              <motion.div layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-[var(--accs)] shadow-[inset_0_0_0_1.5px_var(--acc),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} />
            )}
            <span className="relative z-10 emo text-[18px]">{tab.emoji}</span>
            <span className="relative z-10 text-[15px] font-bold tracking-wide whitespace-nowrap">{tab.label}</span>
            {tab.extra != null && <span className={`relative z-10 hidden lg:inline text-[12px] font-semibold tabular ${isActive ? 'text-[var(--acci)]' : 'text-[var(--ink3)]'}`}>{tab.extra}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
