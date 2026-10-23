// 知识图谱画布：Canvas 2D + d3-force（只在拖动时加热模拟，平时按需重绘，不常驻动画循环）。
// 画布循环的写法参考了 Rewamp UI 的 PlexusEngineShowcase（canvas + DPR 缩放 + 按需 rAF），但内容完全不同：
// 这里是 500 个概念节点 + 1459 条关系边，坐标在构建时预计算（scripts/prep-derived.mjs），打开即是排好的布局。
// 交互：鼠标拖动平移 / 滚轮缩放 / 拖节点；触摸单指平移或拖节点、双指缩放；点节点选中；键盘 + − 0 方向键 Esc。
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force'

import { LV_COLORS, CAT_COLORS, DONE_COLOR, shortName } from './colors'
export { LV_COLORS, CAT_COLORS, DONE_COLOR, shortName }

const K_MIN = 0.12, K_MAX = 4
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const GraphCanvas = forwardRef(function GraphCanvas(
  { graph, catIndex, done, colorMode, visible, selected, onSelect, dark, reduce, rightInset = 0, bottomInset = 0, topInset = 0, label },
  ref,
) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const S = useRef({ t: { k: 1, x: 0, y: 0 }, w: 0, h: 0, dpr: 1, hover: null, raf: 0, fitted: false, anim: 0, touched: false })
  // 最新的 props 放进 ref，事件回调里读
  const P = useRef({})
  P.current = { graph, catIndex, done, colorMode, visible, selected, onSelect, dark, reduce, rightInset, bottomInset, topInset }

  const nodes = graph.nodes
  for (const n of nodes) n.r = 3.4 + Math.sqrt(n.deg) * 1.35

  // ---------- 力导向模拟（只在拖动节点时加热） ----------
  const simRef = useRef(null)
  useEffect(() => {
    const sim = forceSimulation(nodes)
      .force('link', forceLink(graph.edges.map(([s, t]) => ({ source: s, target: t }))).distance(58).strength(0.18))
      .force('charge', forceManyBody().strength(-80).distanceMax(420).theta(0.95))
      .force('collide', forceCollide(n => n.r + 3.5))
      .force('x', forceX(n => n.x0).strength(0.045))
      .force('y', forceY(n => n.y0).strength(0.045))
      .velocityDecay(0.5)
      .alpha(0)
      .on('tick', () => draw())
    sim.stop()
    simRef.current = sim
    return () => sim.stop()
  }, [graph]) // eslint-disable-line

  // ---------- 坐标换算 ----------
  const toWorld = (sx, sy) => { const t = S.current.t; return [(sx - t.x) / t.k, (sy - t.y) / t.k] }
  const toScreen = n => { const t = S.current.t; return [n.x * t.k + t.x, n.y * t.k + t.y] }
  const hit = (sx, sy) => {
    const [wx, wy] = toWorld(sx, sy)
    const k = S.current.t.k
    let best = null, bd = Infinity
    const vis = P.current.visible
    for (const n of nodes) {
      if (vis && !vis(n)) continue
      const rr = Math.max(n.r, 3 / k) + 10 / k // 手指友好：额外 10px 命中范围
      const d = (n.x - wx) ** 2 + (n.y - wy) ** 2
      if (d < rr * rr && d < bd) { bd = d; best = n }
    }
    return best
  }

  // ---------- 绘制 ----------
  function draw() {
    const s = S.current
    if (s.raf) return
    s.raf = requestAnimationFrame(() => { s.raf = 0; paint() })
  }
  function paint() {
    const c = cv.current; if (!c) return
    const s = S.current, t = s.t
    const { done, colorMode, visible, selected, dark, catIndex } = P.current
    const ctx = c.getContext('2d')
    const theme = dark ? 'dark' : 'light'
    const colorOf = n => colorMode === 'cat' ? CAT_COLORS[theme][(catIndex[n.cat] ?? 0) % 15] : LV_COLORS[theme][n.l]
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
    ctx.clearRect(0, 0, s.w, s.h)
    ctx.translate(t.x, t.y); ctx.scale(t.k, t.k)
    const sel = selected
    const nb = sel != null ? new Set(graph.adj[sel]) : null
    const vis = n => !visible || visible(n)
    const lit = n => vis(n) && (sel == null || n.i === sel || nb.has(n.i))

    // 边
    ctx.lineCap = 'round'
    ctx.lineWidth = 1 / t.k
    ctx.strokeStyle = dark ? (sel != null ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.13)') : (sel != null ? 'rgba(0,0,0,.05)' : 'rgba(30,40,60,.14)')
    ctx.beginPath()
    for (const [a, b] of graph.edges) {
      const A = nodes[a], B = nodes[b]
      if (!vis(A) || !vis(B)) continue
      if (sel != null && (a === sel || b === sel)) continue
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y)
    }
    ctx.stroke()
    if (sel != null) {
      const me = nodes[sel]
      ctx.lineWidth = 2.2 / t.k
      for (const j of graph.adj[sel]) {
        const B = nodes[j]
        if (!vis(B)) continue
        ctx.strokeStyle = colorOf(B.l < me.l ? B : me) + 'CC'
        ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(B.x, B.y); ctx.stroke()
      }
    }

    // 节点：先画暗的，再画亮的
    const doneC = DONE_COLOR[theme]
    const drawNode = (n, alpha) => {
      const rr = Math.max(n.r, 2.6 / t.k)
      ctx.globalAlpha = alpha
      ctx.fillStyle = colorOf(n)
      ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, Math.PI * 2); ctx.fill()
      if (done.has(n.slug)) {
        // 已学会：外圈绿环 + 中心白点
        ctx.lineWidth = 2.4 / t.k; ctx.strokeStyle = doneC
        ctx.beginPath(); ctx.arc(n.x, n.y, rr + 2.4 / t.k, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = dark ? '#0E0E11' : '#fff'
        ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(rr * 0.38, 1 / t.k), 0, Math.PI * 2); ctx.fill()
      }
    }
    const order = []
    for (const n of nodes) {
      const v = vis(n)
      const a = !v ? 0.06 : lit(n) ? 1 : 0.16
      if (a < 1) drawNode(n, a); else order.push(n)
    }
    for (const n of order) drawNode(n, 1)
    ctx.globalAlpha = 1
    if (sel != null) {
      const me = nodes[sel]
      const rr = Math.max(me.r, 2.6 / t.k)
      ctx.lineWidth = 3 / t.k; ctx.strokeStyle = dark ? '#fff' : '#1D1D1F'
      ctx.beginPath(); ctx.arc(me.x, me.y, rr + 6 / t.k, 0, Math.PI * 2); ctx.stroke()
    }
    if (s.hover != null && s.hover !== sel) {
      const h = nodes[s.hover]; const rr = Math.max(h.r, 2.6 / t.k)
      ctx.lineWidth = 2 / t.k; ctx.strokeStyle = dark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.6)'
      ctx.beginPath(); ctx.arc(h.x, h.y, rr + 4 / t.k, 0, Math.PI * 2); ctx.stroke()
    }

    // 标签（屏幕坐标里画，避免缩放后字发虚；用格子做简单的防重叠）
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
    const cand = []
    const push = (n, pri) => cand.push([pri, n])
    if (sel != null) { push(nodes[sel], 1e6); for (const j of graph.adj[sel]) if (vis(nodes[j])) push(nodes[j], 1e5 + nodes[j].deg) }
    if (s.hover != null) push(nodes[s.hover], 2e6)
    if (sel == null || t.k >= 1.3) {
      const minDeg = t.k >= 1.25 ? 0 : t.k >= 0.8 ? 6 : t.k >= 0.5 ? 10 : 14
      for (const n of nodes) if (vis(n) && n.deg >= minDeg && (sel == null || lit(n))) push(n, n.deg)
    }
    cand.sort((a, b) => b[0] - a[0])
    const fs = 12.5
    ctx.font = `600 ${fs}px "PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const cell = 40, grid = new Map(), seen = new Set()
    const free = (x0, y0, x1, y1) => {
      for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const arr = grid.get(gx + ',' + gy); if (arr) for (const r of arr) if (r[0] < x1 && r[2] > x0 && r[1] < y1 && r[3] > y0) return false
      }
      return true
    }
    const occupy = r => {
      for (let gx = Math.floor(r[0] / cell); gx <= Math.floor(r[2] / cell); gx++) for (let gy = Math.floor(r[1] / cell); gy <= Math.floor(r[3] / cell); gy++) {
        const key = gx + ',' + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(r)
      }
    }
    let drawn = 0
    for (const [pri, n] of cand) {
      if (seen.has(n.i)) continue; seen.add(n.i)
      const [sx, sy] = toScreen(n)
      if (sx < -80 || sy < -30 || sx > s.w + 80 || sy > s.h + 30) continue
      const txt = shortName(n.item.zh)
      const tw = ctx.measureText(txt).width
      const rr = Math.max(n.r * t.k, 2.6) + 5
      // 依次试：下、上、右、左；都挤就跳过（选中的节点除外——它一定显示）
      const opts = [[sx, sy + rr], [sx, sy - rr - fs - 1], [sx + rr + tw / 2 + 1, sy - fs / 2], [sx - rr - tw / 2 - 1, sy - fs / 2]]
      let at = null
      for (const [lx, ly] of opts) { const b = [lx - tw / 2 - 3, ly - 2, lx + tw / 2 + 3, ly + fs + 3]; if (free(...b)) { at = [lx, ly, b]; break } }
      if (!at) { if (pri < 1e6) continue; const [lx, ly] = opts[0]; at = [lx, ly, [lx - tw / 2 - 3, ly - 2, lx + tw / 2 + 3, ly + fs + 3]] }
      const [lx, ry, box] = at
      occupy(box)
      ctx.lineWidth = 3.5; ctx.strokeStyle = dark ? 'rgba(14,14,17,.92)' : 'rgba(255,255,255,.94)'; ctx.lineJoin = 'round'
      ctx.strokeText(txt, lx, ry)
      ctx.fillStyle = dark ? '#F2F2F5' : '#1D1D1F'
      if (pri >= 1e6) ctx.font = `800 ${fs + 1}px "PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif`
      ctx.fillText(txt, lx, ry)
      if (pri >= 1e6) ctx.font = `600 ${fs}px "PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif`
      if (++drawn > 260) break
    }
  }

  // ---------- 视图变换 ----------
  const setT = (k, x, y) => { S.current.t = { k: clamp(k, K_MIN, K_MAX), x, y }; draw() }
  const zoomAt = (f, sx, sy) => {
    const t = S.current.t
    const k = clamp(t.k * f, K_MIN, K_MAX); const r = k / t.k
    setT(k, sx - (sx - t.x) * r, sy - (sy - t.y) * r)
  }
  const animateTo = (k, x, y) => {
    const s = S.current
    cancelAnimationFrame(s.anim)
    if (P.current.reduce) { setT(k, x, y); return }
    const a = { ...s.t }, t0 = performance.now(), D = 420
    const step = now => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3)
      // 缩放用对数插值，看起来更匀
      const kk = Math.exp(Math.log(a.k) + (Math.log(k) - Math.log(a.k)) * e)
      setT(kk, a.x + (x - a.x) * e, a.y + (y - a.y) * e)
      if (p < 1) s.anim = requestAnimationFrame(step)
    }
    s.anim = requestAnimationFrame(step)
  }
  const viewW = () => S.current.w - (P.current.rightInset || 0)
  const top0 = () => P.current.topInset || 0
  const viewH = () => S.current.h - (P.current.bottomInset || 0) - top0()
  const fit = (animate = true, only) => {
    const s = S.current
    const vis = only || P.current.visible
    const ns = nodes.filter(n => !vis || vis(n))
    const list = ns.length ? ns : nodes
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const n of list) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y) }
    const W = viewW(), H = viewH(), pad = Math.min(40, W * 0.05)
    const k = clamp(Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0)), K_MIN, 2)
    const x = W / 2 - ((x0 + x1) / 2) * k, y = top0() + H / 2 - ((y0 + y1) / 2) * k
    animate ? animateTo(k, x, y) : setT(k, x, y)
    s.fitted = true
  }
  const focus = (i, minK = 1.5) => {
    const n = nodes[i]; if (!n) return
    const k = clamp(Math.max(S.current.t.k, minK), K_MIN, 2.4)
    animateTo(k, viewW() / 2 - n.x * k, top0() + viewH() / 2 - n.y * k)
  }
  // 节点被侧卡 / 抽屉 / 工具条挡住时，只平移不缩放
  const ensureVisible = i => {
    const n = nodes[i]; if (!n) return
    const [x, y] = toScreen(n), m = 50
    if (x < m || x > viewW() - m || y < top0() + m || y > top0() + viewH() - m) {
      const k = S.current.t.k
      animateTo(k, viewW() / 2 - n.x * k, top0() + viewH() / 2 - n.y * k)
    }
  }
  useImperativeHandle(ref, () => ({
    fit, focus, ensureVisible,
    zoom: f => zoomAt(f, viewW() / 2, viewH() / 2),
    redraw: draw,
  }))

  // props 变化 → 重绘
  useEffect(() => { draw() }, [done, colorMode, visible, selected, dark]) // eslint-disable-line

  // ---------- 尺寸 ----------
  useEffect(() => {
    const el = wrap.current
    const ro = new ResizeObserver(() => {
      if (!cv.current || !el.isConnected) return
      const r = el.getBoundingClientRect()
      const s = S.current
      s.w = r.width; s.h = r.height; s.dpr = Math.min(2.5, window.devicePixelRatio || 1)
      const c = cv.current
      c.width = Math.round(r.width * s.dpr); c.height = Math.round(r.height * s.dpr)
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px'
      // 用户还没动过视图：尺寸变了就重新适应（手机地址栏收起、筛选条展开等）
      if (r.width > 0 && (!s.fitted || !s.touched)) fit(false, P.current.visible ? null : () => true)
      paint()
    })
    ro.observe(el)
    // 给 e2e 测试用：拿到节点在页面上的坐标
    window.__aigGraph = {
      ready: true,
      screenOf(slug) {
        const i = graph.at[slug]; if (i == null) return null
        const r = cv.current.getBoundingClientRect(); const [x, y] = toScreen(nodes[i])
        return { x: r.left + x, y: r.top + y }
      },
      k: () => S.current.t.k,
      // 性能自检：连续重绘 n 次的平均耗时（ms）
      bench(n = 30) { const t0 = performance.now(); for (let j = 0; j < n; j++) paint(); return (performance.now() - t0) / n },
      // 力导向一次 tick 的平均耗时（ms）
      benchSim(n = 30) { const sim = simRef.current; const t0 = performance.now(); for (let j = 0; j < n; j++) sim.tick(); return (performance.now() - t0) / n },
    }
    return () => { ro.disconnect(); cancelAnimationFrame(S.current.raf); cancelAnimationFrame(S.current.anim); delete window.__aigGraph }
  }, []) // eslint-disable-line

  // ---------- 指针：平移 / 拖节点 / 双指缩放 / 点选 ----------
  useEffect(() => {
    const c = cv.current
    const pts = new Map()
    let mode = null // 'pan' | 'node' | 'pinch'
    let dragN = null, start = null, moved = false, pinch0 = null
    const local = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
    const down = e => {
      c.setPointerCapture?.(e.pointerId)
      const p = local(e)
      pts.set(e.pointerId, p)
      cancelAnimationFrame(S.current.anim)
      S.current.touched = true
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t: { ...S.current.t } }
        if (dragN) { dragN.fx = dragN.fy = null; dragN = null }
        mode = 'pinch'; moved = true
        return
      }
      start = { p, time: performance.now(), t: { ...S.current.t } }
      moved = false
      const n = hit(...p)
      if (n) { mode = 'node'; dragN = n } else mode = 'pan'
    }
    const move = e => {
      const p = local(e)
      if (!pts.has(e.pointerId)) {
        // 鼠标悬停
        if (e.pointerType === 'mouse') {
          const n = hit(...p); const h = n ? n.i : null
          if (h !== S.current.hover) { S.current.hover = h; c.style.cursor = n ? 'pointer' : 'grab'; draw() }
        }
        return
      }
      pts.set(e.pointerId, p)
      if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const t0 = pinch0.t
        const k = clamp(t0.k * d / Math.max(1, pinch0.d), K_MIN, K_MAX)
        // 以起始中点为锚缩放，再跟随中点平移
        const wx = (pinch0.m[0] - t0.x) / t0.k, wy = (pinch0.m[1] - t0.y) / t0.k
        setT(k, m[0] - wx * k, m[1] - wy * k)
        return
      }
      if (!start) return
      const dx = p[0] - start.p[0], dy = p[1] - start.p[1]
      if (!moved && Math.hypot(dx, dy) > 5) {
        moved = true
        if (mode === 'node' && dragN) {
          dragN.fx = dragN.x; dragN.fy = dragN.y
          if (!P.current.reduce) simRef.current.alphaTarget(0.22).restart()
          c.style.cursor = 'grabbing'
        }
      }
      if (!moved) return
      if (mode === 'pan') setT(start.t.k, start.t.x + dx, start.t.y + dy)
      else if (mode === 'node' && dragN) {
        const [wx, wy] = toWorld(...p)
        dragN.fx = wx; dragN.fy = wy
        if (P.current.reduce) { dragN.x = wx; dragN.y = wy; draw() }
      }
    }
    const up = e => {
      if (!pts.has(e.pointerId)) return
      pts.delete(e.pointerId)
      if (mode === 'pinch') { if (pts.size === 0) { mode = null; pinch0 = null } else { const [p] = [...pts.values()]; start = { p, time: performance.now(), t: { ...S.current.t } }; mode = 'pan' } return }
      if (!moved && start) {
        const n = hit(...start.p)
        P.current.onSelect(n ? n.i : null, 'canvas')
      }
      if (dragN) {
        if (P.current.reduce) { dragN.x0 = dragN.x; dragN.y0 = dragN.y }
        dragN.fx = dragN.fy = null
        simRef.current.alphaTarget(0)
      }
      dragN = null; start = null; mode = null
      c.style.cursor = 'grab'
    }
    const leave = () => { if (S.current.hover != null) { S.current.hover = null; draw() } }
    const wheel = e => {
      e.preventDefault()
      S.current.touched = true
      const [x, y] = local(e)
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018))
      zoomAt(f, x, y)
    }
    c.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    c.addEventListener('pointerleave', leave)
    c.addEventListener('wheel', wheel, { passive: false })
    return () => {
      c.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      c.removeEventListener('pointerleave', leave)
      c.removeEventListener('wheel', wheel)
    }
  }, []) // eslint-disable-line

  const onKey = e => {
    const W = viewW() / 2, H = viewH() / 2, t = S.current.t
    if (e.key === '+' || e.key === '=') zoomAt(1.25, W, H)
    else if (e.key === '-' || e.key === '_') zoomAt(0.8, W, H)
    else if (e.key === '0') fit()
    else if (e.key === 'ArrowLeft') setT(t.k, t.x + 60, t.y)
    else if (e.key === 'ArrowRight') setT(t.k, t.x - 60, t.y)
    else if (e.key === 'ArrowUp') setT(t.k, t.x, t.y + 60)
    else if (e.key === 'ArrowDown') setT(t.k, t.x, t.y - 60)
    else if (e.key === 'Escape' && P.current.selected != null) P.current.onSelect(null, 'key')
    else return
    e.preventDefault(); e.stopPropagation()
  }

  return (
    <div ref={wrap} className="absolute inset-0">
      <canvas ref={cv} data-testid="graph-canvas" tabIndex={0} onKeyDown={onKey} role="img" aria-label={label}
        className="graph-canvas block cursor-grab focus-visible:outline-none" />
    </div>
  )
})
export default GraphCanvas
