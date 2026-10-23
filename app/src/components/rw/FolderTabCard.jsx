// 来自 Rewamp UI: src/components/ui/FolderTabCard.jsx（registry: folder-tab-card）
// 用途：首页的 4 张「级别入口」卡片（初级 / 中级 / 高级 / 进阶），显示真实进度。
// 保留：外框 + 内画布结构、顶部渐变区、右上角圆形玻璃箭头按钮、不对称「文件夹标签」SVG 切口（同一条 path）、底部数据行。
// 改动：
//  - 整张卡变成 <Link>（原组件是 div + 独立按钮），键盘可达
//  - 四团动态模糊色块（每张卡 4 个无限动画 + blur）改为一层静态的级别色网格渐变，只在悬停时缓慢转动，
//    「暂停动画」/ 减少动效时完全静止 —— 首页同时有 4 张卡，原版太耗电
//  - 标题 / 副标题 / 数字字号放大（原 compact 13px 太小），中文排版；去掉鼠标视差
//  - 新增：级别 emoji 图块、进度条；颜色跟随本站浅色 / 深色变量
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'

const MESH = {
  l1: ['#9BE3B4', '#DDF6E4', '#7FD0A0', '#FFF3B8'],
  l2: ['#9CC8FF', '#E1EEFF', '#7FB0FF', '#C9F0FF'],
  l3: ['#C8B3FF', '#EFE8FF', '#A98BF5', '#FFD9F0'],
  l4: ['#FFB4A3', '#FFE7DF', '#FF9278', '#FFE0A8'],
}
const MESH_DARK = {
  l1: ['#1E6B42', '#12261A', '#2C8A57', '#3B3612'],
  l2: ['#1C4C8F', '#0F1C2E', '#2B66C4', '#163A4A'],
  l3: ['#4B338F', '#1A142B', '#6646C2', '#4A1F3E'],
  l4: ['#8F3626', '#2A1411', '#B5482F', '#4A3414'],
}

export default function FolderTabCard({ to, cls, emoji, title, subtitle, count, countLabel, right, percent = 0, dark, still, className = '' }) {
  const reduce = useReducedMotion() || still
  const [hover, setHover] = useState(false)
  const c = (dark ? MESH_DARK : MESH)[cls] || MESH.l1
  return (
    <Link to={to} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`${cls} group block no-underline relative w-full aspect-[1/1.14] lg:aspect-[4/4.5] rounded-[26px] lg:rounded-[32px] p-1.5 lg:p-2.5 overflow-hidden bg-[var(--surface)] border border-[var(--line)] shadow-[0_20px_45px_-14px_rgba(60,60,90,0.22)] dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.65)] transition-transform duration-200 hover:-translate-y-1 ${className}`}>
      <div className="relative w-full h-full rounded-[21px] lg:rounded-[26px] overflow-hidden">
        {/* 1. 顶部网格渐变（静态；悬停时缓慢转动） */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: c[1] }}>
          <motion.div className="absolute -top-[35%] -left-[35%] w-[170%] h-[170%]"
            animate={{ rotate: hover && !reduce ? 40 : 0 }} transition={{ duration: 6, ease: 'easeInOut' }}
            style={{
              background: `radial-gradient(40% 40% at 30% 35%, ${c[0]} 0%, transparent 70%),
                radial-gradient(35% 35% at 70% 30%, ${c[2]} 0%, transparent 70%),
                radial-gradient(30% 30% at 45% 55%, ${c[3]} 0%, transparent 70%)`,
              filter: 'blur(6px)',
            }} />
        </div>
        {/* 级别 emoji 图块 */}
        <span className="absolute z-10 top-2.5 left-2.5 lg:top-4 lg:left-4 emo text-[28px] lg:text-[40px] w-12 h-12 lg:w-[68px] lg:h-[68px] grid place-items-center rounded-[16px] lg:rounded-[22px] bg-white/75 dark:bg-white/10 backdrop-blur-md shadow-sm">{emoji}</span>
        {/* 2. 右上角玻璃箭头按钮 */}
        <span aria-hidden="true"
          className="absolute z-20 top-2.5 right-2.5 lg:top-3.5 lg:right-3.5 w-9 h-9 lg:w-11 lg:h-11 rounded-full flex items-center justify-center backdrop-blur-xl bg-white/75 dark:bg-white/15 text-neutral-800 dark:text-white border border-black/[0.08] dark:border-white/25 shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
          <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5" />
        </span>
        {/* 3. 不对称文件夹标签切口（原组件同一条 path） */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end">
          <div className="relative w-full h-[62%]">
            <svg viewBox="0 0 380 240" preserveAspectRatio="none" className="absolute inset-0 w-full h-full drop-shadow-[0_-10px_20px_rgba(0,0,0,0.12)]" aria-hidden="true">
              <path d="M 0 28 A 28 28 0 0 1 28 0 L 180 0 A 22 22 0 0 1 202 22 A 22 22 0 0 0 224 44 L 352 44 A 28 28 0 0 1 380 72 L 380 212 A 28 28 0 0 1 352 240 L 28 240 A 28 28 0 0 1 0 212 Z"
                fill="var(--surface)" stroke="var(--line)" strokeWidth="1" />
            </svg>
            <div className="relative z-20 w-full h-full flex flex-col justify-between p-3 lg:p-5">
              <div className="pt-0.5">
                <h3 className="m-0 max-w-[56%] font-extrabold tracking-tight leading-tight text-[21px] lg:text-[27px] text-[var(--acci)]">{title}</h3>
                <p className="m-0 mt-0.5 font-semibold leading-snug text-[12.5px] lg:text-[14px] text-[var(--ink2)] whitespace-nowrap overflow-hidden text-ellipsis">{subtitle}</p>
              </div>
              <div>
                <div className="flex items-end justify-between gap-2 pb-1.5">
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="font-black tracking-tight leading-none text-[22px] lg:text-[30px] text-[var(--ink)] tabular">{count}</span>
                    <span className="font-semibold text-[12px] lg:text-[13px] text-[var(--ink2)] whitespace-nowrap">{countLabel}</span>
                  </div>
                  <div className="font-semibold text-[12px] lg:text-[13px] text-[var(--ink2)] whitespace-nowrap">{right}</div>
                </div>
                <div className="pbar !h-[6px] lg:!h-2"><i style={{ width: `${percent}%` }} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
