// 来自 Rewamp UI: src/components/ui/ShimmerButtonShowcase.jsx（registry: shimmer-button）
// 用途：首页主按钮「▶ 继续学习 / 从第 1 个开始」。
// 保留：一道窄窄的斜向高光周期性扫过按钮表面、悬停上浮 2px、按下缩小。
// 改动：白底灰边改成本站主色蓝底（主按钮要醒目）；高光颜色改为半透明白；变成 <Link>；
//       去掉「复制提示词」演示部分；「暂停动画」时不扫光。
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function ShimmerButton({ to, children, still, className = '' }) {
  const reduce = useReducedMotion() || still
  return (
    <motion.div whileHover={reduce ? undefined : { y: -2 }} whileTap={{ scale: 0.97 }} className={`inline-flex ${className}`}>
      <Link to={to}
        className="relative w-full min-h-[52px] px-7 inline-flex items-center justify-center gap-2 rounded-full overflow-hidden select-none no-underline font-bold text-[17px] text-white bg-[var(--blue)] dark:bg-[#2F6FE8] shadow-[0_10px_24px_-10px_rgba(10,102,255,.7)]">
        {!reduce && (
          <motion.span aria-hidden="true" className="absolute inset-y-0 w-12 pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.55), rgba(255,255,255,0.08), transparent)' }}
            initial={{ left: '-20%' }} animate={{ left: '120%' }}
            transition={{ duration: 0.85, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.4 }} />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </Link>
    </motion.div>
  )
}
