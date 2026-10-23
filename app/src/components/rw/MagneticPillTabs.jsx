// 来自 Rewamp UI: src/components/ui/MagneticPillNavbarShowcase.jsx（registry: magnetic-pill-navbar）
// 用途：① 级别页里的「分类」标签（一次只显示一个分类）；② 概念页「小白版 ⇄ 🎓 专业模式」分段开关；③ 词汇表级别筛选
// 改动：
//  - 改成受控通用组件（items / value / onChange），支持 emoji、角标（如 3/12）、全学会状态
//  - 手机横向可滚动（不换行、不溢出），选中项自动滚到可视区；桌面可选择换行显示全部分类
//  - 浅色模式滑块沿用原组件的 #18181B；深色模式原组件 #272333 与底色太接近，改成浅色滑块 + 深色字；按钮最小高度 44px
//  - 角色：分类用 role=tablist，分段开关用 role=radiogroup
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function MagneticPillTabs({
  items, value, onChange, layoutId = 'magnetic-pill-indicator', still = false,
  role = 'tablist', ariaLabel, size = 'md', scroll = true, className = '', fill = false, wrapDesktop = false,
}) {
  const reduce = useReducedMotion() || still
  const wrap = useRef(null)
  useEffect(() => {
    if (!scroll || !wrap.current) return
    const el = wrap.current.querySelector('[data-active="true"]')
    if (!el) return
    const w = wrap.current
    const left = el.offsetLeft - w.clientWidth / 2 + el.clientWidth / 2
    w.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [value, scroll, reduce])
  const itemRole = role === 'radiogroup' ? 'radio' : 'tab'
  const h = size === 'sm' ? 'min-h-[44px] px-3.5 text-[14px]' : 'min-h-[46px] px-4 text-[15px]'
  return (
    <div className={`relative ${className}`}>
      <div ref={wrap} role={role} aria-label={ariaLabel}
        className={`relative flex items-center gap-1 p-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-[0_10px_30px_-6px_rgba(0,0,0,0.1)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.6)] ${scroll ? 'overflow-x-auto no-scrollbar scroll-px-2' : ''} ${wrapDesktop ? 'lg:flex-wrap lg:overflow-visible lg:rounded-[28px]' : ''} ${fill ? 'w-full' : 'w-fit max-w-full'}`}>
        {items.map(it => {
          const isActive = value === it.id
          return (
            <button key={it.id} type="button" role={itemRole} data-active={isActive}
              aria-selected={itemRole === 'tab' ? isActive : undefined} aria-checked={itemRole === 'radio' ? isActive : undefined}
              onClick={() => onChange(it.id)}
              className={`relative z-10 shrink-0 ${fill ? 'flex-1' : ''} flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-300 ${h} ${isActive ? 'text-white dark:text-[#111114]' : 'text-[var(--ink2)] hover:text-[var(--ink)]'}`}>
              {isActive && (
                <motion.div layoutId={layoutId}
                  className="absolute inset-0 bg-[#18181B] dark:bg-[#EDEDF2] rounded-full -z-10 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} />
              )}
              {it.emoji && <span className="relative z-20 emo text-[17px]">{it.emoji}</span>}
              <span className="relative z-20">{it.label}</span>
              {it.badge != null && (
                <span className={`relative z-20 text-[12px] font-bold tabular rounded-full px-2 py-px ${isActive ? 'bg-white/20 text-white dark:bg-black/10 dark:text-[#111114]' : it.allDone ? 'bg-[var(--pist)] text-[var(--l1i)]' : 'bg-[var(--surface2)] text-[var(--ink2)]'}`}>{it.badge}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
