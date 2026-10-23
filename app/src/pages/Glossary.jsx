// 词汇表：搜索 + 级别标签 + 分页（每页 30 条，手机 15 条）；桌面表格、手机卡片。默认不会一次渲染 500 行。
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useApp } from '../App'
import MagneticPillTabs from '../components/rw/MagneticPillTabs'
import { useMedia } from '../lib/useMedia'
import mascotSm from '../assets/mascot-sm.webp'

export default function Glossary() {
  const { idx, done, prefs } = useApp()
  const [sp, setSp] = useSearchParams()
  const isMobile = useMedia('(max-width:1023px)')
  const [q, setQ] = useState(sp.get('q') || '')
  useEffect(() => { document.title = '📚 词汇表 · AI 造物指南' }, [])
  const levels = idx.meta.levels
  const lv = ['all', ...levels.map(l => l.cls)].includes(sp.get('lv')) ? sp.get('lv') : 'all'
  const rank = Object.fromEntries(levels.map((l, i) => [l.name, i]))
  const sorted = useMemo(() => [...idx.items].sort((a, b) => rank[a.level] - rank[b.level] || a.en.toLowerCase().localeCompare(b.en.toLowerCase())), [idx]) // eslint-disable-line
  const k = q.trim().toLowerCase()
  const list = useMemo(() => {
    if (k) return sorted.filter(x => (x.zh + ' ' + x.en + ' ' + x.slug + ' ' + x.oneLiner).toLowerCase().includes(k))
    if (lv === 'all') return sorted
    const name = idx.levelByCls[lv].name
    return sorted.filter(x => x.level === name)
  }, [sorted, k, lv, idx])
  const PAGE = isMobile ? 15 : 30
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const page = Math.min(pages, Math.max(1, +sp.get('p') || 1))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)

  const update = patch => {
    const n = { lv, p: String(page), q, ...patch }
    const o = {}
    if (n.lv !== 'all') o.lv = n.lv
    if (n.q) o.q = n.q
    if (+n.p > 1) o.p = String(n.p)
    setSp(o, { replace: true })
  }
  const goPage = p => { update({ p }); document.getElementById('gl-list')?.scrollIntoView({ block: 'start' }) }
  const counts = Object.fromEntries(levels.map(l => [l.cls, idx.items.filter(x => x.level === l.name).length]))

  return (
    <div className="max-w-[1240px] mx-auto px-3.5 lg:px-6 pt-3 lg:pt-7 pb-6">
      <nav aria-label="位置" className="text-[14px] text-[var(--ink2)] mb-3 flex items-center gap-1.5">
        <Link to="/" className="text-[var(--blue-d)] no-underline hover:underline">首页</Link><span>›</span><b className="text-[var(--ink)] font-semibold">📚 词汇表</b>
      </nav>
      <section className="card p-5 lg:p-9 grid lg:grid-cols-[1fr_minmax(300px,440px)] gap-4 lg:gap-6 items-end bg-[linear-gradient(150deg,var(--sky),var(--surface)_75%)]">
        <div>
          <span className="chip-tag !bg-[var(--surface)]/80"><span className="emo">📚</span>词汇表</span>
          <h1 className="text-[26px] lg:text-[40px] font-extrabold mt-3 mb-1">{idx.meta.total} 个词，中英对照</h1>
          <p className="m-0 text-[15px] text-[var(--ink2)]">按级别分组、英文字母排。点一个词就进它的那一页。</p>
        </div>
        <label className="flex items-center gap-2.5 h-[56px] rounded-full bg-[var(--surface)] border border-[var(--line)] pl-5 pr-2 shadow-[var(--sh)]">
          <Search size={20} className="text-[var(--ink2)] flex-none" />
          <input type="search" value={q} placeholder="中文或英文都能搜" aria-label="搜索词汇" autoComplete="off"
            onChange={e => { setQ(e.target.value); update({ q: e.target.value, p: 1 }) }}
            className="flex-1 min-w-0 h-full bg-transparent outline-none text-[16px] placeholder:text-[var(--ink3)] [&::-webkit-search-cancel-button]:hidden" />
          {q && <button type="button" aria-label="清空" onClick={() => { setQ(''); update({ q: '', p: 1 }) }} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[var(--surface2)]"><X size={18} /></button>}
        </label>
      </section>

      <div className="sticky top-[58px] lg:top-0 z-30 -mx-3.5 px-3.5 lg:mx-0 lg:px-0 pt-3 pb-2 lg:pt-5 bg-[linear-gradient(var(--bg)_80%,transparent)]">
        <MagneticPillTabs ariaLabel="级别" layoutId="gl-lv" still={prefs.still} size="sm" value={k ? null : lv} onChange={id => { setQ(''); update({ lv: id, q: '', p: 1 }) }}
          items={[{ id: 'all', label: '全部', badge: idx.meta.total }, ...levels.map(l => ({ id: l.cls, emoji: l.emoji, label: l.name, badge: counts[l.cls] }))]} />
      </div>
      <p id="gl-list" className="mx-1 mb-3 mt-1 text-[15px] text-[var(--ink2)] scroll-mt-[130px] lg:scroll-mt-[80px] tabular" aria-live="polite">
        {k ? `在全部级别里找到 ${list.length} 个` : `共 ${list.length} 个`}{list.length > PAGE ? ` · 第 ${page} / ${pages} 页` : ''}
      </p>

      {list.length === 0 ? (
        <div className="card p-5 flex gap-3.5 items-center">
          <img src={mascotSm} alt="" width="64" height="64" className="w-16 h-16 rounded-[18px]" />
          <p className="m-0"><b className="block">没找到这个词。</b>换个说法，或者试试英文。</p>
        </div>
      ) : isMobile ? (
        <ul className="list-none m-0 p-0 grid gap-2">
          {shown.map(x => {
            const l = idx.levelBy[x.level]
            return (
              <li key={x.slug}>
                <Link to={'/c/' + x.slug} className={`${l.cls} grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-3 no-underline bg-[var(--surface)] rounded-[20px] px-3.5 py-3 shadow-[var(--sh)] leading-snug`}>
                  <span className="emo row-span-3 self-start text-[24px] w-11 h-11 grid place-items-center bg-[var(--accs)] rounded-[14px]">{x.emoji}</span>
                  <b className="text-[16px] min-w-0">{x.zh}{done.has(x.slug) && <span className="text-[13px]"> ✅</span>}</b>
                  <span className="lvb !text-[12px] self-start">{l.emoji} {x.level}</span>
                  <span className="col-span-2 text-[13px] text-[var(--ink2)] truncate">{x.en}</span>
                  <span className="col-span-2 text-[14px] text-[var(--ink2)] mt-0.5">{x.oneLiner}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="card p-2 overflow-hidden">
          <table className="w-full border-separate border-spacing-0 text-[15px]">
            <thead>
              <tr className="text-[13px] text-[var(--ink2)] text-left">
                <th className="w-[56px] px-3 py-2.5 font-bold"><span className="sr-only">图标</span></th>
                <th className="px-3 py-2.5 font-bold w-[24%]">中文</th>
                <th className="px-3 py-2.5 font-bold w-[22%]">English</th>
                <th className="px-3 py-2.5 font-bold">一句话</th>
                <th className="px-3 py-2.5 font-bold w-[96px]">级别</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(x => {
                const l = idx.levelBy[x.level]
                return (
                  <tr key={x.slug} className={`${l.cls} group relative`}>
                    <td className="px-3 py-2 border-t border-[var(--line)] group-hover:bg-[var(--accs)] rounded-l-2xl"><span className="emo text-[24px]">{x.emoji}</span></td>
                    <td className="px-3 py-2 border-t border-[var(--line)] group-hover:bg-[var(--accs)]">
                      <Link to={'/c/' + x.slug} className="font-bold no-underline after:absolute after:inset-0 hover:text-[var(--blue-d)]">{x.zh}</Link>
                      {done.has(x.slug) && <span className="text-[13px]"> ✅</span>}
                    </td>
                    <td className="px-3 py-2 border-t border-[var(--line)] group-hover:bg-[var(--accs)] text-[14px] text-[var(--ink2)]">{x.en}</td>
                    <td className="px-3 py-2 border-t border-[var(--line)] group-hover:bg-[var(--accs)] text-[var(--ink2)]">{x.oneLiner}</td>
                    <td className="px-3 py-2 border-t border-[var(--line)] group-hover:bg-[var(--accs)] rounded-r-2xl"><span className="lvb">{l.emoji} {x.level}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="分页" className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          <button type="button" disabled={page <= 1} onClick={() => goPage(page - 1)} className="btn btn-soft !px-4 disabled:opacity-40" aria-label="上一页"><ChevronLeft size={18} /><span className="hidden sm:inline">上一页</span></button>
          {isMobile ? <span className="px-3 font-bold tabular">{page} / {pages}</span> : pageList(page, pages).map((p, i) => p === '…'
            ? <span key={'e' + i} className="w-6 text-center text-[var(--ink3)]">…</span>
            : <button key={p} type="button" onClick={() => goPage(p)} aria-current={p === page ? 'page' : undefined}
              className={`w-11 h-11 rounded-full font-bold tabular ${p === page ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)] shadow-[var(--sh)]'}`}>{p}</button>)}
          <button type="button" disabled={page >= pages} onClick={() => goPage(page + 1)} className="btn btn-soft !px-4 disabled:opacity-40" aria-label="下一页"><span className="hidden sm:inline">下一页</span><ChevronRight size={18} /></button>
        </nav>
      )}
    </div>
  )
}

// 1 … 4 5 6 … 17
function pageList(cur, n) {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const s = new Set([1, n, cur, cur - 1, cur + 1])
  const arr = [...s].filter(p => p >= 1 && p <= n).sort((a, b) => a - b)
  const out = []
  arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push('…'); out.push(p) })
  return out
}
