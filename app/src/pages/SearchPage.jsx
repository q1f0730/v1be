// 完整搜索结果页 #/search?q=&lv=&cat=&scope=&p=（懒加载）
//  - 全文索引：标题 > 术语/词汇 > 一句话 > 正文 > 代码；拼音全拼 / 首字母；英文缩写不区分大小写
//  - 每条显示命中字段 + 高亮片段；命中专业内容直接进 /pro 并定位到章节（?s=）
//  - 筛选：范围（全部 / 只看小白 / 只看专业）、级别、分类；分页每页 20 条
//  - 键盘：在输入框里 ↑ ↓ 选结果，回车打开，Esc 清空
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../App'
import { runSearch, useFulltext } from '../lib/data'
import SearchCapsule from '../components/rw/SearchCapsule'
import SearchFilters from '../components/search/SearchFilters'
import Hl, { FieldChip } from '../components/search/Hl'
import Skeleton from '../components/rw/Skeleton'

const PAGE = 20

export default function SearchPage() {
  const { idx, done, prefs } = useApp()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const q = sp.get('q') || ''
  const [text, setText] = useState(q)
  const filters = useMemo(() => ({
    lv: idx.meta.levels.some(l => l.cls === sp.get('lv')) ? sp.get('lv') : 'all',
    cat: idx.meta.catOrder.includes(sp.get('cat')) ? sp.get('cat') : 'all',
    scope: ['easy', 'pro'].includes(sp.get('scope')) ? sp.get('scope') : 'all',
  }), [sp, idx])
  const ft = useFulltext(true)
  const all = useMemo(() => (q.trim() ? runSearch(idx, ft, q, filters) : []), [idx, ft, q, filters])
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const page = Math.min(pages, Math.max(1, +sp.get('p') || 1))
  const shown = all.slice((page - 1) * PAGE, page * PAGE)
  const [cur, setCur] = useState(-1)
  const listRef = useRef(null)

  useEffect(() => { document.title = (q ? `「${q}」的搜索结果` : '🔎 搜索') + ' · AI 造物指南' }, [q])
  useEffect(() => { setText(q) }, [q])
  useEffect(() => { setCur(-1) }, [q, filters, page])

  const update = patch => {
    const n = { q, ...filters, p: page, ...patch }
    const o = {}
    if (n.q) o.q = n.q
    for (const k of ['lv', 'cat', 'scope']) if (n[k] && n[k] !== 'all') o[k] = n[k]
    if (+n.p > 1) o.p = String(n.p)
    setSp(o, { replace: true })
  }
  // 输入防抖写进地址栏
  useEffect(() => {
    if (text === q) return
    const id = setTimeout(() => update({ q: text.trim() ? text : '', p: 1 }), 160)
    return () => clearTimeout(id)
  }, [text]) // eslint-disable-line

  const onKeyExtra = e => {
    const n = shown.length
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); setCur(c => { const v = (c + 1) % n; scrollTo(v); return v }); return true }
    if (e.key === 'ArrowUp' && n) { e.preventDefault(); setCur(c => { const v = (c - 1 + n) % n; scrollTo(v); return v }); return true }
    if (e.key === 'Enter') { const r = shown[Math.max(0, cur)]; if (r) nav(r.to); return true }
    return false
  }
  const scrollTo = i => requestAnimationFrame(() => listRef.current?.querySelectorAll('li')[i]?.scrollIntoView({ block: 'nearest' }))
  const goPage = p => { update({ p }); window.scrollTo({ top: 0 }) }

  return (
    <div className="max-w-[920px] mx-auto px-3.5 lg:px-6 pt-4 lg:pt-8 pb-8">
      <nav aria-label="位置" className="text-[13px] lg:text-[14px] text-[var(--ink2)] mb-3 flex items-center gap-1.5">
        <Link to="/" className="text-[var(--blue-d)] no-underline hover:underline">首页</Link><span>›</span><b className="text-[var(--ink)] font-semibold">搜索</b>
      </nav>
      <h1 className="m-0 mb-4 text-[26px] lg:text-[36px] font-extrabold">🔎 全文搜索</h1>
      <SearchCapsule idx={idx} done={done} still={prefs.still} list={false} value={text} onValueChange={setText} onKeyExtra={onKeyExtra}
        autoFocus={!q} placeholder="中文、英文、拼音都行：dyymx、max_tokens、幂等" inputLabel="搜索全部内容" />
      <div className="mt-3.5"><SearchFilters idx={idx} value={filters} onChange={f => update({ ...f, p: 1 })} still={prefs.still} idp="sp" /></div>

      <div className="mt-5 flex items-baseline justify-between gap-3 flex-wrap" aria-live="polite">
        <p className="m-0 text-[15px] text-[var(--ink2)]" data-testid="search-count">
          {!q.trim() ? '输入关键词开始搜索。标题、比喻、步骤、翻车现场、专业定义 / 原理 / 术语 / 代码都能搜到。'
            : <>找到 <b className="text-[var(--ink)]">{all.length}</b> 个概念{pages > 1 ? `，第 ${page} / ${pages} 页` : ''}{!ft ? '（全文索引加载中，先显示标题结果）' : ''}</>}
        </p>
        {q.trim() && <p className="m-0 text-[13px] text-[var(--ink3)] hidden lg:block">↑ ↓ 选择 · 回车打开 · Esc 清空</p>}
      </div>

      {q.trim() && !ft && all.length === 0 && <div className="grid gap-3 mt-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-[84px] rounded-[22px]" />)}</div>}
      {q.trim() && ft && all.length === 0 && (
        <div className="card p-6 mt-3 text-center"><p className="m-0 font-bold text-[18px]">没找到 🙂</p><p className="m-0 mt-1 text-[var(--ink2)]">换个说法、试试英文或拼音首字母，或者放宽筛选。</p></div>
      )}

      <ul ref={listRef} className="list-none m-0 mt-3 p-0 grid gap-2.5" data-testid="search-results">
        {shown.map((r, i) => {
          const x = r.x; const lv = idx.levelBy[x.level]; const cat = idx.meta.cats[x.cat]
          const th = r.snip?.title || {}
          return (
            <li key={x.slug} data-field={r.f}>
              <Link to={r.to} onMouseEnter={() => setCur(i)}
                className={`${lv.cls} card !rounded-[22px] flex gap-3.5 p-3.5 lg:p-4 no-underline transition-[box-shadow,background] ${i === cur ? 'ring-2 ring-[var(--blue)] bg-[var(--sky)]' : 'hover:shadow-[var(--sh2)]'}`}>
                <span className="emo text-[26px] w-12 h-12 grid place-items-center rounded-[15px] bg-[var(--accs)] flex-none">{x.emoji}</span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="flex items-center gap-2 flex-wrap">
                    <b className="text-[17px] [overflow-wrap:anywhere]"><Hl text={x.zh} hl={th.zh} />{done.has(x.slug) ? ' ✅' : ''}</b>
                    <span className="lvb !text-[11.5px] !px-2">{lv.emoji} {x.level}</span>
                    <span className="hidden sm:inline text-[12.5px] text-[var(--ink3)]">{cat?.emoji} {cat?.name}</span>
                  </span>
                  <small className="block text-[13px] text-[var(--ink2)] mt-0.5 [overflow-wrap:anywhere]"><Hl text={x.en} hl={th.en} /> · {x.oneLiner}</small>
                  <span className="flex items-start gap-2 mt-1.5 text-[14px] min-w-0">
                    <FieldChip r={r} />
                    {r.snip?.text
                      ? <Hl text={r.snip.text} hl={r.snip.hl} className={`min-w-0 [overflow-wrap:anywhere] text-[var(--ink)] ${r.snip.mono ? 'font-mono text-[13px]' : ''}`} />
                      : <span className="text-[var(--ink3)] text-[13px]">{r.f === 'tpy' ? '拼音命中标题' : '标题命中'}</span>}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      {pages > 1 && (
        <nav aria-label="分页" className="flex items-center justify-center gap-2 mt-5">
          <button type="button" className="btn btn-soft !min-h-[46px] disabled:opacity-40" disabled={page <= 1} onClick={() => goPage(page - 1)}><ChevronLeft size={18} />上一页</button>
          <span className="tabular text-[15px] text-[var(--ink2)] px-2">{page} / {pages}</span>
          <button type="button" className="btn btn-soft !min-h-[46px] disabled:opacity-40" disabled={page >= pages} onClick={() => goPage(page + 1)} data-testid="search-next">下一页<ChevronRight size={18} /></button>
        </nav>
      )}
    </div>
  )
}
