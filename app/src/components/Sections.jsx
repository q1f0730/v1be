// 概念页的各个内容块（小白版 9 块 + 专业版 10 块），只负责渲染内容，翻页 / 布局由 Concept.jsx 管
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink, ChevronDown } from 'lucide-react'
import Anim from './Anim'
import { burst, copyText } from '../lib/fx'

export const EASY_SECS = [
  { id: 'one', emoji: '🎯', label: '一句话', tint: 'var(--lemon)', say: true },
  { id: 'ana', emoji: '🧸', label: '打个比方', say: true },
  { id: 'anim', emoji: '🎬', label: '动起来看', tint: 'var(--sky)' },
  { id: 'tab', emoji: '📊', label: '对比表' },
  { id: 'how', emoji: '👣', label: '三步做法', tint: 'var(--pist)', say: true },
  { id: 'oops', emoji: '💥', label: '翻车现场', tint: 'var(--blush)', say: true },
  { id: 'ai', emoji: '🤖', label: '给 AI 的话', tint: 'var(--lilac)', say: true },
  { id: 'quiz', emoji: '✅', label: '小测验' },
  { id: 'words', emoji: '📚', label: '词汇' },
]
export const PRO_SECS = [
  { id: 'def', emoji: '📐', label: '定义', say: true },
  { id: 'how', emoji: '⚙️', label: '原理', say: true },
  { id: 'terms', emoji: '🔤', label: '术语', say: true },
  { id: 'code', emoji: '💻', label: '代码' },
  { id: 'tab', emoji: '📊', label: '参数对比' },
  { id: 'trade', emoji: '⚖️', label: '方案取舍', say: true },
  { id: 'pit', emoji: '🕳️', label: '常见坑', say: true },
  { id: 'check', emoji: '☑️', label: '检查清单' },
  { id: 'int', emoji: '🎤', label: '面试追问' },
  { id: 'refs', emoji: '🔗', label: '延伸阅读' },
]

// 朗读用的纯文本
export function sectionText(mode, id, c) {
  const p = c.pro || {}
  const t = x => (x || []).join('。')
  if (mode === 'easy') {
    return ({
      one: c.oneLiner, ana: c.analogy + '。' + t(c.points), anim: c.anim?.caption,
      tab: c.table.title + '。' + c.table.rows.map(r => r.join('，')).join('。'),
      how: t(c.steps), oops: c.oops, ai: c.prompt, quiz: c.quiz.q + '。' + t(c.quiz.options), words: t(c.words),
    })[id] || ''
  }
  return ({
    def: p.def, how: t(p.how), terms: (p.terms || []).map(x => x.t + '：' + x.d).join('。'),
    code: p.code?.note, tab: p.table?.title, trade: (p.tradeoffs || []).map(x => `${x.opt}。优点：${x.pros}。代价：${x.cons}。适用：${x.when}`).join('。'),
    pit: (p.pitfalls || []).map(x => `错误：${x.bad}。正确：${x.fix}`).join('。'), check: t(p.checklist),
    int: (p.interview || []).map(x => x.q).join('。'), refs: (p.refs || []).map(x => x.title).join('。'),
  })[id] || ''
}

function Table({ tb }) {
  if (!tb || !tb.head?.length) return null
  return (
    <>
      {tb.title && <h3 className="m-0 mb-3 text-[1.05em]">{tb.title}</h3>}
      <div className="c-table stack">
        <table>
          <thead><tr>{tb.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{tb.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} data-h={tb.head[j] || ''}>{x}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

function CopyPrompt({ text }) {
  const [ok, setOk] = useState(false)
  return (
    <>
      <pre className="whitespace-pre-wrap font-[inherit] bg-[var(--surface)]/85 border-2 border-dashed border-[#B9A8F0] dark:border-[#5B4A99] rounded-[18px] px-[18px] py-4 m-0 mb-3.5">{text}</pre>
      <button type="button" data-testid="copy-prompt" onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 2200) } }}
        className={`btn btn-pri ${ok ? 'btn-ok' : ''}`} aria-live="polite">
        {ok ? <><Check size={18} /> 复制好了，去粘贴给 AI 吧</> : <><Copy size={18} /> 一键复制</>}
      </button>
    </>
  )
}

function Quiz({ q, solved, onSolved }) {
  const [wrong, setWrong] = useState({}) // i -> 次数（用来重放抖动）
  const ans = +q.answer
  return (
    <>
      <p className="font-extrabold text-[1.08em] m-0 mb-3">{q.q}</p>
      <div className="grid gap-2.5" role="group" aria-label="选项">
        {q.options.map((o, i) => {
          const right = solved && i === ans
          const isWrong = !!wrong[i] && !right
          return (
            <button key={i + '-' + (wrong[i] || 0)} type="button" data-testid={`quiz-opt-${i}`} disabled={solved && !right}
              onClick={() => {
                if (solved) return
                if (i === ans) { burst(['🎉', '✨', '⭐', '🥳']); onSolved?.() }
                else setWrong(w => ({ ...w, [i]: (w[i] || 0) + 1 }))
              }}
              className={`flex items-center gap-3 text-left border-2 rounded-[18px] px-3.5 py-3 min-h-[52px] text-[.95em] leading-snug transition-colors
                ${right ? 'opt-right bg-[var(--pist)] border-[#34C759]' : isWrong ? 'opt-wrong bg-[var(--blush)] border-[#E5484D]' : 'bg-[var(--surface2)] border-transparent hover:bg-[var(--surface3)]'} disabled:opacity-60`}>
              <span className={`flex-none w-8 h-8 rounded-full grid place-items-center font-extrabold text-[14px] ${right ? 'bg-[#34C759] text-white' : isWrong ? 'bg-[#E5484D] text-white' : 'bg-[var(--surface)]'}`}>{right ? '✓' : isWrong ? '✗' : 'ABC'[i]}</span>
              <span>{o}</span>
            </button>
          )
        })}
      </div>
      <div aria-live="polite">
        {solved ? <p className="bg-[var(--lemon)] rounded-2xl px-4 py-3 mt-3 mb-0" data-testid="quiz-why"><span className="emo">💡</span> 答对了！{q.why}</p>
          : Object.keys(wrong).length > 0 && <p className="text-[var(--ink2)] text-[.92em] mt-3 mb-0">不对哦，再想想 🤔</p>}
      </div>
    </>
  )
}

export function EasySection({ id, c, bySlug, mode, projId, quizSolved, onQuizSolved }) {
  switch (id) {
    case 'one': return <p className="text-[clamp(22px,2vw,30px)] leading-normal font-extrabold m-0">{c.oneLiner}</p>
    case 'ana': return (
      <>
        <p className="m-0 mb-3.5 text-[1.05em]">{c.analogy}</p>
        <ul className="list-none p-0 m-0 grid gap-2.5 lg:grid-cols-3">{c.points.map((p, i) => <li key={i} className="bg-[var(--surface2)] rounded-2xl px-4 py-2.5">{p}</li>)}</ul>
      </>
    )
    case 'anim': return (
      <div className="anim-zoom">
        <Anim a={c.anim} />
        {c.anim?.caption && <p className="text-center text-[#1F4A73] dark:text-[#9CC3F0] mt-3 mb-0 font-semibold"><span className="emo">👀</span> {c.anim.caption}</p>}
      </div>
    )
    case 'tab': return <Table tb={c.table} />
    case 'how': return (
      <ol className="list-none p-0 m-0 grid gap-3">
        {c.steps.map((s, i) => (
          <li key={i} className="flex gap-3.5 items-start bg-[var(--surface)]/75 rounded-[18px] px-3.5 py-3">
            <span className="flex-none grid place-items-center w-[34px] h-[34px] rounded-full bg-[var(--l1)] text-white font-extrabold">{i + 1}</span>
            <p className="m-0 mt-0.5">{s}</p>
          </li>
        ))}
      </ol>
    )
    case 'oops': return <p className="m-0 text-[1.05em] text-[#5C1A2A] dark:text-[#FFC9D3] bg-[var(--surface)]/70 rounded-[18px] px-[18px] py-4">{c.oops}</p>
    case 'ai': return <CopyPrompt text={c.prompt} />
    case 'quiz': return <Quiz q={c.quiz} solved={quizSolved} onSolved={onQuizSolved} />
    case 'words': {
      const rel = (c.related || []).map(r => bySlug[r]).filter(Boolean)
      return (
        <>
          <div className="flex flex-wrap gap-2">{c.words.map((w, i) => <span key={i} className="bg-[var(--surface2)] rounded-full px-3 py-1 text-[.9em]">{w}</span>)}</div>
          {rel.length > 0 && (
            <>
              <h3 className="text-[1em] mt-5 mb-2.5"><span className="emo">🔗</span> 相关概念</h3>
              <div className="flex flex-wrap gap-2">
                {rel.map(r => (
                  <Link key={r.slug} to={'/c/' + r.slug + (mode === 'pro' && r.pro ? '/pro' : '') + (projId ? `?proj=${encodeURIComponent(projId)}` : '')}
                    className="inline-flex items-center gap-1.5 min-h-[44px] no-underline bg-[var(--accs)] rounded-[14px] px-3.5 text-[.92em] font-semibold hover:shadow-[inset_0_0_0_2px_var(--acc)]">
                    <span className="emo">{r.emoji}</span>{r.zh}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )
    }
    default: return null
  }
}

function CodeBox({ cd }) {
  const [ok, setOk] = useState(false)
  if (!cd) return null
  return (
    <>
      <div className="codebox">
        <div className="flex items-center gap-2.5 py-2 pl-[18px] pr-2 bg-[#222228] dark:bg-[#17171C] text-[14px]">
          <span className="flex-1 min-w-0 font-bold truncate">{cd.title}</span>
          <em className="not-italic text-[#9A9AA3] font-mono text-[12px]">{cd.lang}</em>
          <button type="button" data-testid="copy-code" onClick={async () => { if (await copyText(cd.src)) { setOk(true); setTimeout(() => setOk(false), 1800) } }}
            className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-bold text-white inline-flex items-center gap-1.5 ${ok ? 'bg-[#1E7F45]' : 'bg-[#3A3A42] hover:bg-[#4A4A54]'}`}>
            {ok ? <><Check size={14} />已复制</> : <><Copy size={14} />复制</>}
          </button>
        </div>
        <pre tabIndex={0} aria-label="示例代码"><code>{cd.src}</code></pre>
      </div>
      {cd.note && <p className="mt-3 mb-0 mx-0.5 text-[var(--ink2)] text-[.94em]">{cd.note}</p>}
    </>
  )
}

function Checklist({ list }) {
  const [on, setOn] = useState({})
  const n = Object.values(on).filter(Boolean).length
  return (
    <>
      <ul className="list-none p-0 m-0 grid gap-2">
        {list.map((x, i) => (
          <li key={i}>
            <label className="flex gap-3 items-start bg-[var(--surface2)] rounded-2xl px-3.5 py-3 cursor-pointer text-[.94em] leading-normal min-h-[48px]">
              <input type="checkbox" checked={!!on[i]} onChange={e => setOn(o => ({ ...o, [i]: e.target.checked }))} className="w-5 h-5 mt-0.5 flex-none accent-[var(--l1)]" />
              <span className={on[i] ? 'line-through text-[var(--ink3)]' : ''}>{x}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-[var(--ink3)] mt-2.5 mb-0 tabular" aria-live="polite">已勾 {n} / {list.length}（只在这一页临时记录）</p>
    </>
  )
}

function Interview({ list }) {
  const [open, setOpen] = useState(-1)
  return (
    <div className="grid gap-2.5">
      {list.map((x, i) => (
        <div key={i} className="bg-[var(--surface2)] rounded-[18px]">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(o => o === i ? -1 : i)}
            className="w-full flex gap-2.5 items-start text-left font-bold px-4 py-3.5 min-h-[52px]">
            <span className="flex-none w-6 h-6 rounded-lg bg-[var(--ink)] text-[var(--bg)] grid place-items-center text-[13px] mt-0.5">Q</span>
            <span className="flex-1">{x.q}</span>
            <ChevronDown size={20} className={`flex-none mt-0.5 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="m-0 px-4 pb-4 pl-[50px] text-[var(--ink2)] leading-[1.7] text-[.94em]">{x.a}</p>}
        </div>
      ))}
      <p className="text-[13px] text-[var(--ink3)] m-0">先自己想一想，再点开看要点。</p>
    </div>
  )
}

const host = u => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

export function ProSection({ id, p }) {
  switch (id) {
    case 'def': return <p className="m-0 text-[17px] lg:text-[clamp(18px,1.5vw,21px)] leading-[1.8] font-medium lg:font-semibold">{p.def}</p>
    case 'how': return (
      <ol className="list-none p-0 m-0 grid gap-2.5">
        {p.how.map((h, i) => (
          <li key={i} className="flex gap-3.5 items-start bg-[var(--surface2)] rounded-[18px] px-3.5 py-3">
            <span className="flex-none grid place-items-center w-[30px] h-[30px] rounded-full bg-[var(--ink)] text-[var(--bg)] font-extrabold text-[15px]">{i + 1}</span>
            <p className="m-0 mt-0.5">{h}</p>
          </li>
        ))}
      </ol>
    )
    case 'terms': return (
      <dl className="m-0 grid gap-2.5 lg:grid-cols-2">
        {p.terms.map((t, i) => (
          <div key={i} className="bg-[var(--surface2)] rounded-2xl px-3.5 py-2.5">
            <dt className="font-extrabold text-[.95em]">{t.t}</dt>
            <dd className="m-0 mt-0.5 text-[var(--ink2)] text-[.92em] leading-relaxed">{t.d}</dd>
          </div>
        ))}
      </dl>
    )
    case 'code': return <CodeBox cd={p.code} />
    case 'tab': return <Table tb={p.table} />
    case 'trade': return (
      <div className="grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {p.tradeoffs.map((t, i) => (
          <div key={i} className="bg-[var(--surface2)] rounded-[18px] px-4 py-3.5">
            <h4 className="m-0 mb-2 text-[1.02em]">{t.opt}</h4>
            {[['优点', t.pros, 'var(--pist)'], ['代价', t.cons, 'var(--blush)'], ['适用', t.when, 'var(--sky)']].map(([k, v, bg]) => (
              <p key={k} className="m-0 mt-1.5 text-[.92em] leading-relaxed text-[var(--ink2)]">
                <b className="inline-block text-[12px] rounded-lg px-[7px] py-px mr-2 text-[var(--ink)]" style={{ background: bg }}>{k}</b>{v}
              </p>
            ))}
          </div>
        ))}
      </div>
    )
    case 'pit': return (
      <ul className="list-none p-0 m-0 grid gap-2.5">
        {p.pitfalls.map((x, i) => (
          <li key={i} className="rounded-[18px] overflow-hidden bg-[var(--surface2)]">
            <p className="m-0 px-3.5 py-2.5 text-[.93em] leading-relaxed flex gap-2.5 bg-[#FFF0F2] text-[#7A1F2E] dark:bg-[#3A1C24] dark:text-[#FFC2CC]"><b className="flex-none">✗</b>{x.bad}</p>
            <p className="m-0 px-3.5 py-2.5 text-[.93em] leading-relaxed flex gap-2.5 text-[#14532D] dark:text-[#9BE3B4]"><b className="flex-none">✓</b>{x.fix}</p>
          </li>
        ))}
      </ul>
    )
    case 'check': return <Checklist list={p.checklist} />
    case 'int': return <Interview list={p.interview} />
    case 'refs': return (
      <ul className="list-none p-0 m-0 grid gap-2">
        {p.refs.map((r, i) => (
          <li key={i}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 no-underline bg-[var(--surface2)] hover:bg-[var(--surface3)] rounded-2xl px-3.5 py-3 min-h-[52px]">
              <span className="flex-1 min-w-0"><b className="block text-[.93em] leading-snug">{r.title}</b><small className="text-[var(--blue-d)] text-[12px]">{host(r.url)}</small></span>
              <ExternalLink size={17} className="flex-none text-[var(--ink3)]" aria-label="在新标签页打开" />
            </a>
          </li>
        ))}
      </ul>
    )
    default: return null
  }
}
