// 搜索筛选：范围（全部 / 只看小白 / 只看专业）、级别、分类。完整结果页和搜索浮层共用。
// 用的是 Rewamp「magnetic-pill-navbar」改造版 MagneticPillTabs。
import MagneticPillTabs from '../rw/MagneticPillTabs'

export const SCOPES = [{ id: 'all', emoji: '🔎', label: '全部' }, { id: 'easy', emoji: '🧸', label: '只看小白' }, { id: 'pro', emoji: '🎓', label: '只看专业' }]

export default function SearchFilters({ idx, value, onChange, still, compact = false, idp = 'sf' }) {
  const { lv = 'all', cat = 'all', scope = 'all' } = value
  const levels = [{ id: 'all', label: '全部级别' }, ...idx.meta.levels.map(l => ({ id: l.cls, emoji: l.emoji, label: l.name }))]
  const cats = [{ id: 'all', label: '全部分类' }, ...idx.meta.catOrder.map(k => ({ id: k, emoji: idx.meta.cats[k].emoji, label: idx.meta.cats[k].name }))]
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] ${compact ? 'gap-2' : 'gap-2.5'}`}>
      <MagneticPillTabs role="radiogroup" ariaLabel="搜索范围" layoutId={idp + '-scope'} size="sm" still={still}
        items={SCOPES} value={scope} onChange={v => onChange({ ...value, scope: v })} />
      <MagneticPillTabs ariaLabel="按级别筛选" layoutId={idp + '-lv'} size="sm" still={still}
        items={levels} value={lv} onChange={v => onChange({ ...value, lv: v })} />
      <MagneticPillTabs ariaLabel="按分类筛选" layoutId={idp + '-cat'} size="sm" still={still} wrapDesktop={!compact}
        items={cats} value={cat} onChange={v => onChange({ ...value, cat: v })} />
    </div>
  )
}
export const filterCount = f => ['lv', 'cat', 'scope'].filter(k => f[k] && f[k] !== 'all').length
