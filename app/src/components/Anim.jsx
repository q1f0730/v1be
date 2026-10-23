// 15 种概念动画 —— 逐行对照 guide/src/build.py 的 anim_html() 移植，输出相同的 DOM 结构与 class，
// 样式在 src/styles/anim.css（原样复制自 guide/src/assets/style.css）。
// 唯一改名：loop 的 .ring → .lring（避免和 Tailwind 的 ring 工具类冲突）。

function Node({ e, l, cls = '' }) {
  return <div className={`nd ${cls}`}><span className="ne emo">{e}</span><span className="nl">{l}</span></div>
}

function pick(a, n) {
  const L = [...(a.labels || [])]
  const M = [...(a.emojis || [])]
  while (L.length < n) L.push('')
  while (M.length < n) M.push('🔹')
  return [L, M]
}

export default function Anim({ a }) {
  const t = a?.type || 'flow'
  if (t === 'flow') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-flow">
        <Node e={M[0]} l={L[0]} />
        <div className="trk"><i className="dot" /></div>
        <Node e={M[1]} l={L[1]} cls="pulse" />
        <div className="trk"><i className="dot d2" /></div>
        <Node e={M[2]} l={L[2]} />
      </div>
    )
  }
  if (t === 'guard') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-guard"><div className="lane">
        <div className="run good"><span className="emo">{M[0]}</span><b>{L[0]}</b></div>
        <div className="run bad"><span className="emo">{M[2]}</span><b>{L[2]}</b></div>
        <div className="wall"><Node e={M[1]} l={L[1]} cls="big" /></div>
        <div className="ok emo">✅</div><div className="no emo">🚫</div>
      </div></div>
    )
  }
  if (t === 'queue') {
    const [L, M] = pick(a, 2)
    return (
      <div className="sc sc-queue">
        <div className="belt">
          <div className="items">{[0, 1, 2, 3, 4].map(i => <span key={i} className="qi emo" style={{ '--i': i }}>{M[0]}</span>)}</div>
          <div className="qlab">{L[0]}</div>
        </div>
        <Node e={M[1]} l={L[1]} cls="pulse big" />
      </div>
    )
  }
  if (t === 'layers') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-layers"><div className="stack">
        {[2, 1, 0].map(i => <div key={i} className={`ly ly${i}`} style={{ '--i': i }}><span className="emo">{M[i]}</span>{L[i]}</div>)}
      </div></div>
    )
  }
  if (t === 'split' || t === 'merge' || t === 'copy') {
    const n = t === 'copy' ? 3 : 4
    const [L, M] = pick(a, n)
    let src, outs
    if (t === 'merge') { src = <Node e={M[3]} l={L[3]} cls="big pulse" />; outs = [0, 1, 2].map(i => [M[i], L[i]]) }
    else { src = <Node e={M[0]} l={L[0]} cls="big pulse" />; outs = M.slice(1).map((m, i) => [m, L[i + 1]]) }
    const ys = outs.length === 3 ? ['18%', '50%', '82%'] : ['25%', '75%']
    return (
      <div className={`sc sc-fan sc-${t}`}>
        <div className="src">{src}</div>
        {ys.map((y, i) => <i key={'f' + i} className="fly" style={{ '--y': y, '--d': `${i * 0.45}s` }} />)}
        {outs.map(([m, l], i) => <div key={'t' + i} className="tg" style={{ top: ys[i] }}><Node e={m} l={l} /></div>)}
      </div>
    )
  }
  if (t === 'loop') {
    let L = (a.labels || []).filter(Boolean).slice(0, 4)
    if (!L.length) L = ['1', '2', '3']
    const M = [...(a.emojis || [])]
    while (M.length < L.length) M.push('🔹')
    const n = L.length
    const POS = { 3: [[50, 0], [93, 75], [7, 75]], 4: [[50, 0], [100, 50], [50, 100], [0, 50]] }
    const pos = POS[n] || POS[3]
    return (
      <div className="sc sc-loop"><div className="lbox">
        <div className="lring"><i /></div>
        {pos.slice(0, n).map(([x, y], i) => (
          <div key={i} className="lp" style={{ left: `${x}%`, top: `${y}%`, '--d': `${(i * (4 / n)).toFixed(2)}s`, '--n': n }}>
            <Node e={M[i]} l={L[i]} />
          </div>
        ))}
      </div></div>
    )
  }
  if (t === 'lock') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-lock">
        <div className="fr f1"><Node e={M[0]} l={L[0]} /></div><div className="arw">➜</div>
        <div className="fr f2"><Node e={M[1]} l={L[1]} cls="big" /></div><div className="arw a2">➜</div>
        <div className="fr f3"><Node e={M[2]} l={L[2]} /></div>
      </div>
    )
  }
  if (t === 'filter') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-filter"><div className="lane">
        <div className="run good"><span><span className="emo">{M[0]}</span>✔</span></div>
        <div className="run bad drop"><span><span className="emo">{M[0]}</span>✖</span></div>
        <div className="wall"><Node e={M[1]} l={L[1]} cls="big" /></div>
        <div className="inl">{L[0]}</div><div className="outl"><span className="emo">{M[2]}</span> {L[2]}</div>
      </div></div>
    )
  }
  if (t === 'timer') {
    const [L, M] = pick(a, 2)
    return (
      <div className="sc sc-timer">
        <div className="clock">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" className="bg" /><circle cx="60" cy="60" r="52" className="fg" /></svg>
          <span className="ti emo">{M[0]}</span>
        </div>
        <div className="tl"><b>{L[0]}</b><span><span className="emo">{M[1]}</span> {L[1]}</span><em>⌛ 时间到 → 失效</em></div>
      </div>
    )
  }
  if (t === 'chat') {
    const [L, M] = pick(a, 2)
    return (
      <div className="sc sc-chat">
        <div className="bub me"><span className="emo">{M[0] !== '🔹' ? M[0] : '🙋'}</span><p>{L[0]}</p></div>
        <div className="bub bot typing"><span className="emo">🤖</span><p><i /><i /><i /></p></div>
        <div className="bub bot ans"><span className="emo">{M[1] !== '🔹' ? M[1] : '🤖'}</span><p>{L[1]}</p></div>
      </div>
    )
  }
  if (t === 'balance') {
    const [L, M] = pick(a, 2)
    return (
      <div className="sc sc-balance">
        <div className="beam">
          <div className="pan l"><Node e={M[0]} l={L[0]} /></div><div className="pan r"><Node e={M[1]} l={L[1]} /></div>
        </div>
        <div className="pivot">▲</div>
      </div>
    )
  }
  if (t === 'toggle') {
    const [L, M] = pick(a, 2)
    return (
      <div className="sc sc-toggle">
        <div className="st sa"><Node e={M[0]} l={L[0]} cls="big" /></div>
        <div className="sw"><i /></div>
        <div className="st sb"><Node e={M[1]} l={L[1]} cls="big" /></div>
      </div>
    )
  }
  if (t === 'grow') {
    const [L, M] = pick(a, 3)
    return (
      <div className="sc sc-grow">
        {[40, 70, 95].map((h, i) => (
          <div key={i} className="bar" style={{ '--h': `${h}%`, '--d': `${i * 0.3}s` }}>
            <div className="fill"><span className="emo">{M[i]}</span></div><b>{L[i]}</b>
          </div>
        ))}
      </div>
    )
  }
  return <Anim a={{ ...a, type: 'flow' }} />
}
