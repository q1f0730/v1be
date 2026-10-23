// 把 [[start, end], …] 区间高亮成 <mark>（搜索结果的标题 / 命中片段共用）
export default function Hl({ text, hl, className = '' }) {
  text = String(text ?? '')
  if (!hl || !hl.length) return <span className={className}>{text}</span>
  const out = []; let p = 0
  for (const [s, e] of hl) {
    if (s < p || s >= text.length) continue
    if (s > p) out.push(text.slice(p, s))
    out.push(<mark key={s} className="hl">{text.slice(s, e)}</mark>)
    p = e
  }
  if (p < text.length) out.push(text.slice(p))
  return <span className={className}>{out}</span>
}

// 结果行用的「命中字段」小标签
export function FieldChip({ r }) {
  return (
    <span className={`inline-flex items-center flex-none rounded-full px-2 py-px text-[11.5px] font-bold leading-[1.6] whitespace-nowrap ${r.pro ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface2)] text-[var(--ink2)]'}`}>
      {r.label}
    </span>
  )
}
