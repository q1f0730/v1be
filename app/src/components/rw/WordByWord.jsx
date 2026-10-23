// 来自 Rewamp UI: src/components/ui/WordByWordTextShowcase.jsx（registry: word-by-word-text）
// 用途：首页大标题「AI 造物指南」逐词浮现（只在进入首页时播一次）。
// 保留：每个词淡入 + 上移 12px + 去模糊、0.12s 错峰、同一条缓动曲线；最后的词用强调色。
// 改动：中文按「词块」拆分（传入数组，不按空格切）；去掉点击重播；强调色改为本站蓝；「暂停动画」时直接显示。
import { motion, useReducedMotion } from 'framer-motion'

const wordVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: i => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { delay: i * 0.12, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } }),
}

export default function WordByWord({ words, accentFrom = Infinity, still, className = '', as: Tag = 'h1' }) {
  const reduce = useReducedMotion() || still
  return (
    <Tag className={className} aria-label={words.join('')}>
      {words.map((w, i) => (
        <motion.span key={i} custom={i} variants={wordVariants} initial={reduce ? false : 'hidden'} animate="visible" aria-hidden="true"
          className={`inline-block ${i >= accentFrom ? 'text-[var(--blue)]' : ''}`}>{w}</motion.span>
      ))}
    </Tag>
  )
}
