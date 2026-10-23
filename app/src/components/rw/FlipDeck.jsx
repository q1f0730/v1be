// 来自 Rewamp UI: src/components/ui/PerspectiveFlipDeck.jsx（registry: perspective-flip-deck）
// 用途：手机概念页「一次一张卡」—— 小白版 9 张 / 专业版 10 张内容卡。
// 保留：透视叠牌（后面两张错位 + 缩小 + 变淡）、翻到下一张时前卡绕「右侧铰链」向外翻开（rotateY → 85°）、
//       下一张带弹簧从牌堆里滑到前面，曲线与时长沿用原组件。
// 改动：
//  - 原组件是固定 260×160 的纯图片卡 + 自动轮播；这里改成高度自适应的内容卡，去掉自动播放
//  - 受控：index / onPrev / onNext 由页面控制（底部「上一张 / 下一张」、键盘 ← →、章节条都能翻）
//  - 新增左右滑动（drag x，阈值 70px），在表格、代码、动画、按钮上按下时不触发，避免抢横向滚动
//  - 往回翻时反向播放（卡片从右侧铰链合上回来）
//  - 「暂停动画」/ 系统减少动效：改为 150ms 淡入淡出
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

export default function FlipDeck({ index, total, onPrev, onNext, children, still = false, className = '' }) {
  const reduce = useReducedMotion() || still
  const controls = useDragControls()
  const dirRef = useRef(1)
  const prevIdx = useRef(index)
  if (prevIdx.current !== index) { dirRef.current = index > prevIdx.current ? 1 : -1; prevIdx.current = index }
  const dir = dirRef.current

  const variants = reduce ? {
    enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } },
  } : {
    enter: d => d > 0
      ? { opacity: 0.6, scale: 0.965, y: -10, rotateY: 0 }
      : { opacity: 0, scale: 0.98, rotateY: 85, y: 0 },
    center: d => ({
      opacity: 1, scale: 1, y: 0, rotateY: 0,
      transition: d > 0 ? { duration: 0.52, ease: [0.34, 1.3, 0.64, 1] } : { duration: 0.5, ease: [0.35, 0.85, 0.45, 1] },
    }),
    exit: d => d > 0
      ? { opacity: 0, scale: 0.98, rotateY: 85, transition: { duration: 0.5, ease: [0.35, 0.85, 0.45, 1] } }
      : { opacity: 0, scale: 0.965, y: -10, transition: { duration: 0.3 } },
  }
  const behind = Math.min(2, total - index - 1)

  return (
    <div className={`relative ${className}`} style={{ perspective: 1400, perspectiveOrigin: '50% 50%' }}>
      {/* 后面的牌（错位叠放，提示还有几张） */}
      {[2, 1].map(s => s <= behind && (
        <div key={s} aria-hidden="true"
          className="absolute inset-x-0 top-[40px] h-24 rounded-[24px] bg-[var(--surface)] border border-[var(--line)]"
          style={{ transform: `translateY(${-s * 7}px) scale(${1 - s * 0.035})`, opacity: 1 - s * 0.28, zIndex: 0, boxShadow: '0 18px 36px -18px rgba(0,0,0,.28)' }} />
      ))}
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div key={index} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
          drag="x" dragListener={false} dragControls={controls} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.22} dragSnapToOrigin
          onPointerDown={e => { if (!e.target.closest('.c-table, .sc, pre, input, textarea, button, a, details, label')) controls.start(e) }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 && Math.abs(info.offset.y) < 60) onNext?.()
            else if (info.offset.x > 70 && Math.abs(info.offset.y) < 60) onPrev?.()
          }}
          className="relative z-10 touch-pan-y"
          style={{ transformOrigin: 'right center', transformStyle: 'preserve-3d' }}>
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
