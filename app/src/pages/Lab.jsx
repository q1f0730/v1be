import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, Check, ChevronRight, Database, FlaskConical, Gauge, Layers3, LockKeyhole,
  Pause, Play, Plus, RotateCcw, Server, ShieldCheck, SkipForward, Sparkles, Trophy, UnlockKeyhole, Zap } from 'lucide-react'
import { useApp } from '../App'
import { lsGet, lsSet } from '../lib/store'
import { CACHE_REQUESTS, LAB_LINKS, cacheStart, cacheStep, queueStart, queueStep,
  raceStart, raceStep, raceFinished, challengePassed, queueClearStreak } from '../lib/lab-engine'

const EXPERIMENTS = [
  { id: 'cache', number: '01', name: '缓存加速', sub: '同一份数据，能快多少？', Icon: Zap, time: '约 1 分钟', badge: '命中高手' },
  { id: 'queue', number: '02', name: '队列调度', sub: '任务太多，怎样不排长队？', Icon: Layers3, time: '约 2 分钟', badge: '调度达人' },
  { id: 'race', number: '03', name: '并发与锁', sub: '两个人加一，为什么只加了一？', Icon: LockKeyhole, time: '约 2 分钟', badge: '并发守护者' },
]
const spring = { type: 'spring', stiffness: 370, damping: 29 }
const cacheFinished = s => s.cursor >= CACHE_REQUESTS.length
const queueFinished = s => s.tick >= 12

export default function Lab() {
  const { prefs } = useApp()
  const reduce = !!(useReducedMotion() || prefs.still)
  const [sp, setSp] = useSearchParams()
  const id = EXPERIMENTS.some(x => x.id === sp.get('experiment')) ? sp.get('experiment') : 'cache'
  const [speed, setSpeed] = useState(1)
  const [records, setRecords] = useState(() => {
    const r = lsGet('labs', {})
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {}
  })
  const [celebration, setCelebration] = useState(null)
  const tabRefs = useRef([])
  const earned = !!records[id]
  const count = EXPERIMENTS.filter(x => records[x.id]).length
  const award = useCallback(key => {
    if (records[key]) return
    setRecords(r => ({ ...r, [key]: { completedAt: new Date().toISOString() } }))
    setCelebration(key)
  }, [records])
  useEffect(() => { document.title = '动手实验室 · AI 造物指南' }, [])
  useEffect(() => { lsSet('labs', records) }, [records])
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(() => setCelebration(null), 3200)
    return () => clearTimeout(timer)
  }, [celebration])
  const moveTab = (e, i) => {
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!direction && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + direction + 3) % 3
    setSp({ experiment: EXPERIMENTS[next].id }, { replace: true })
    tabRefs.current[next]?.focus()
  }

  return <MotionConfig reducedMotion={reduce ? 'always' : 'never'} transition={reduce ? { duration: 0 } : spring}>
    <div className={`lab-page lab-${id} ${reduce ? 'lab-still' : ''}`}>
      <nav aria-label="位置" className="lab-crumb"><Link to="/">首页</Link><ChevronRight size={14} /><span>动手实验室</span></nav>
      <header className="lab-header">
        <div>
          <span className="lab-eyebrow"><FlaskConical size={16} />LEARN BY DOING <span>动手才懂</span></span>
          <h1>把概念，<span>玩明白。</span></h1>
          <p>调一调，猜一猜，看结果怎么变。每次只做一个小实验。</p>
        </div>
        <div className="lab-passport" aria-label={`已解锁 ${count} 枚徽章，共 3 枚`}>
          <div className="lab-stamps" aria-hidden="true">{EXPERIMENTS.map(({ id: key, Icon }) =>
            <span key={key} className={`lab-stamp ${records[key] ? 'is-earned' : ''}`}><Icon size={19} />{records[key] && <i><Check size={10} /></i>}</span>)}</div>
          <span><b>{count} / 3</b> 实验徽章</span>
        </div>
      </header>

      <div className="lab-tabs" role="tablist" aria-label="选择实验">
        {EXPERIMENTS.map((x, i) => <button key={x.id} ref={el => { tabRefs.current[i] = el }}
          id={`lab-tab-${x.id}`} type="button" role="tab" aria-selected={id === x.id} aria-controls="lab-panel"
          tabIndex={id === x.id ? 0 : -1} onKeyDown={e => moveTab(e, i)}
          onClick={() => setSp({ experiment: x.id }, { replace: true })} className={`lab-tab ${id === x.id ? 'is-active' : ''}`}>
          {id === x.id && <motion.span className="lab-tab-fill" layoutId="lab-tab-selection" />}
          <span className={`lab-tab-icon lab-${x.id}`}><x.Icon size={22} strokeWidth={1.9} /></span>
          <span className="lab-tab-copy"><small>实验 {x.number}</small><b>{x.name}</b><span>{x.sub}</span></span>
          <span className="lab-tab-check">{records[x.id] ? <Check size={17} /> : <ChevronRight size={17} />}</span>
        </button>)}
      </div>

      <div className="lab-toolbar"><span><span className="lab-live-dot" />模拟数据 · 放心试错</span>
        <button type="button" className="lab-param-jump" onClick={e => jumpTo(e, '.lab-control-card', reduce)}><Gauge size={13} />调参数</button>
        <label><span>播放速度</span><select aria-label="播放速度" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
          <option value={0.65}>慢一点</option><option value={1}>正常</option><option value={1.6}>快一点</option>
        </select></label>
      </div>
      <motion.section key={id} id="lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${id}`}
        initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}>
        {id === 'cache' && <CacheLab reduce={reduce} speed={speed} earned={earned} award={award} />}
        {id === 'queue' && <QueueLab reduce={reduce} speed={speed} earned={earned} award={award} />}
        {id === 'race' && <RaceLab reduce={reduce} speed={speed} earned={earned} award={award} />}
      </motion.section>

      <Related id={id} />
      <p className="lab-footnote">参数用于说明原理，实际系统会更复杂。徽章保存在当前浏览器；切换实验会重置本轮操作。</p>
      <AnimatePresence>{celebration && <motion.div role="status" className="lab-celebration" style={{ x: '-50%' }}
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 8 }}>
        {!reduce && <span className="lab-confetti" aria-hidden="true">{Array.from({ length: 10 }, (_, i) =>
          <i key={i} style={{ '--x': `${Math.cos(i * Math.PI / 5) * 125}px`, '--y': `${Math.sin(i * Math.PI / 5) * 85 - 25}px`, '--r': `${i * 67}deg`, '--c': ['#9f8aff', '#ffc76d', '#73ccac'][i % 3] }} />)}</span>}
        <span className="lab-celebration-icon"><Trophy size={23} /></span>
        <span><b>解锁「{EXPERIMENTS.find(x => x.id === celebration)?.badge}」</b><small>这一次，你把原理跑通了。</small></span>
      </motion.div>}</AnimatePresence>
    </div>
  </MotionConfig>
}

function useExperiment(id, start, step, isFinished, { reduce, speed, earned, award }) {
  const [state, setState] = useState(start)
  const [playing, setPlaying] = useState(false)
  const finished = isFinished(state)
  const advance = useCallback(() => setState(s => step(s)), [step])
  useEffect(() => {
    if (!playing || finished || reduce) return
    const timer = setInterval(advance, 1100 / speed)
    return () => clearInterval(timer)
  }, [playing, finished, reduce, speed, advance])
  useEffect(() => { if (finished || reduce) setPlaying(false) }, [finished, reduce])
  useEffect(() => {
    if (!earned && challengePassed(id, state)) award(id)
  }, [id, state, earned, award])
  const reset = next => { setPlaying(false); setState(next) }
  return { state, setState, playing, setPlaying, finished, advance, reset }
}

function Playback({ run, reduce, onReset, children, stepLabel = '下一步' }) {
  return <div className="lab-playback">
    <motion.button type="button" className="lab-btn lab-btn-primary" whileTap={reduce ? undefined : { scale: 0.96 }}
      disabled={run.finished || reduce} aria-pressed={run.playing} onClick={() => run.setPlaying(v => !v)}>
      {run.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      {run.playing ? '暂停播放' : run.finished ? '本轮结束' : '自动播放'}</motion.button>
    <button type="button" className="lab-btn lab-btn-secondary" disabled={run.finished} onClick={() => { run.setPlaying(false); run.advance() }}>
      <SkipForward size={17} />{stepLabel}</button>
    <button type="button" className="lab-btn lab-btn-reset" aria-label="重置实验" onClick={onReset} title="重置本轮，保留徽章"><RotateCcw size={18} /></button>
    {children}
    {reduce && <small className="lab-motion-note">已减少动画，请用「{stepLabel}」观察变化。</small>}
  </div>
}

function Range({ label, value, min, max, onChange, suffix = '', hint }) {
  const id = useId()
  return <div className="lab-range"><label htmlFor={id}><b>{label}</b><output htmlFor={id}>{value}{suffix}</output></label>
    <input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ '--range-fill': `${(value - min) / (max - min) * 100}%` }} />
    <div className="lab-range-ends"><span>{min}{suffix}</span><span>{max}{suffix}</span></div>
    {hint && <p>{hint}</p>}
  </div>
}
function jumpTo(e, selector, reduce) {
  e.currentTarget.closest('.lab-page')?.querySelector(selector)?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' })
}
function BackToExperiment({ reduce }) {
  return <button type="button" className="lab-back-to-experiment" onClick={e => jumpTo(e, '.lab-main-card', reduce)}>回到实验看结果<ArrowRight size={14} /></button>
}

function Metric({ label, value, unit, good, sub }) {
  return <div className={`lab-metric ${good ? 'is-good' : ''}`}><small>{label}</small><b>{value}<em>{unit}</em></b>{sub && <span>{sub}</span>}</div>
}
function Challenge({ earned, title, hint, progress, total, children }) {
  return <section className={`lab-challenge ${earned ? 'is-earned' : ''}`} aria-label="小挑战">
    <div className="lab-challenge-heading"><span><Trophy size={17} />{earned ? '徽章已解锁' : '一个小挑战'}</span><span>{Math.min(progress, total)} / {total}</span></div>
    <h3>{title}</h3><p>{hint}</p>
    <div className="lab-challenge-track" role="progressbar" aria-label="挑战进度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(progress, total)}><i style={{ width: `${Math.min(100, progress / total * 100)}%` }} /></div>
    {children}
    {earned && <span className="lab-earned-note"><ShieldCheck size={15} />通关记录已保存在此浏览器</span>}
  </section>
}
function Status({ children, tone = '', step = 0, reduce }) {
  return <div className={`lab-status ${tone}`} aria-live="polite" aria-atomic="true">
    <motion.span key={step} initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>{children}</motion.span>
  </div>
}
function PanelHeading({ num, title, subtitle, tag }) {
  return <div className="lab-panel-heading"><div><span className="lab-small-label">EXPERIMENT {num}</span><h2>{title}</h2><p>{subtitle}</p></div><span className="lab-tag">{tag}</span></div>
}

function CacheLab(props) {
  const { reduce, earned } = props
  const run = useExperiment('cache', cacheStart, cacheStep, cacheFinished, props)
  const s = run.state
  const [prediction, setPrediction] = useState(null)
  const reset = (capacity = s.capacity) => { run.reset(cacheStart(capacity)); setPrediction(null) }
  const current = CACHE_REQUESTS[s.cursor]
  const result = prediction && s.history[prediction.at]
  const saved = s.cursor * 200 - s.elapsed
  const predict = hit => { run.setPlaying(false); setPrediction({ at: s.cursor, hit }) }
  return <div className="lab-layout">
    <div className="lab-main-card">
      <PanelHeading num="01" title="给数据走一条近路" subtitle="先找缓存；没有，再去数据源拿。" tag="LRU 缓存" />
      <Playback run={run} reduce={reduce} onReset={() => reset()} stepLabel="下一次请求" />
      <div className="lab-cache-requests"><span>请求顺序</span><div>{CACHE_REQUESTS.map((key, i) =>
        <span key={i} className={`lab-request ${i === s.cursor ? 'is-next' : i < s.cursor ? 'is-done' : ''}`} aria-label={`第 ${i + 1} 次请求 ${key}${i < s.cursor ? '，已完成' : i === s.cursor ? '，下一次' : ''}`}>
          {key}{i < s.cursor && <i className={s.history[i].hit ? 'hit' : 'miss'} />}</span>)}</div><small>{s.cursor} / 8</small></div>
      <div className="lab-cache-stage">
        <div className="lab-machine lab-client"><span className="lab-machine-icon"><Server size={27} /></span><b>发起请求</b><small>{current ? `接下来：${current}` : '8 次请求完成'}</small></div>
        <div className="lab-connector"><ArrowRight size={20} />{s.last && <motion.i key={s.cursor} className="lab-packet" initial={reduce ? false : { x: -17, opacity: 0 }} animate={reduce ? { opacity: 1 } : { x: [-17, 20, 20], opacity: [0, 1, 0] }} transition={{ duration: 0.6 }}>{s.last.key}</motion.i>}</div>
        <div className={`lab-machine lab-cache-box ${s.last?.hit ? 'is-hit' : ''}`}>
          <span className="lab-machine-icon"><Zap size={26} /></span><b>高速缓存</b><small>{s.capacity ? `${s.keys.length} / ${s.capacity} 个位置` : '缓存已关闭'}</small>
          <div className="lab-cache-slots" aria-label={`缓存内容：${s.keys.join('、') || '空'}`}>
            {s.capacity === 0 ? <span className="lab-cache-off">直达数据源</span> : <AnimatePresence initial={false} mode="popLayout">{Array.from({ length: s.capacity }, (_, i) => {
              const key = s.keys[i]
              return key ? <motion.span key={key} layout={!reduce} className={`lab-data-block ${key === s.last?.key ? 'is-recent' : ''}`}
                initial={reduce ? false : { scale: 0.6, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.65, y: -12, opacity: 0 }}>{key}</motion.span>
                : <span key={`empty-${i}`} className="lab-empty-slot">·</span>
            })}</AnimatePresence>}
          </div><span className="lab-cache-order">{s.capacity ? '最久未用 ← → 最近使用' : '每次读取都花 200 ms'}</span>
        </div>
        <div className={`lab-connector ${s.last?.hit ? 'is-muted' : ''}`}><ArrowRight size={20} />{s.last && !s.last.hit && !reduce && <motion.i key={s.cursor} className="lab-packet" initial={{ x: -17, opacity: 0 }} animate={{ x: [-17, 20, 20], opacity: [0, 1, 0] }} transition={{ duration: 0.5, delay: 0.25 }}>{s.last.key}</motion.i>}</div>
        <div className={`lab-machine lab-origin ${s.last && !s.last.hit ? 'is-reading' : ''}`}><span className="lab-machine-icon"><Database size={27} /></span><b>数据源</b><small>读取 200 ms</small></div>
      </div>
      <Status step={s.cursor} reduce={reduce} tone={s.last?.hit ? 'success' : ''}>
        {!s.last ? <>先点「下一次请求」，观察 A 从哪里来。</> : <><b>{s.last.key}：{s.last.hit ? '缓存命中，只花 20 ms' : '缓存未命中，读取数据源花 200 ms'}</b>
          <span>{s.last.evicted ? `腾出位置：移走最久未用的 ${s.last.evicted}。` : s.last.hit ? '最近用过的数据，挪到缓存最右边。' : s.capacity ? '数据已经放进缓存，下次可以直接取。' : '容量为 0，这次不保留数据。'}</span></>}
      </Status>
      <div className="lab-metrics"><Metric label="命中率" value={s.cursor ? Math.round(s.hits / s.cursor * 100) : 0} unit="%" good sub={`${s.hits} 次命中 / ${s.cursor} 次请求`} />
        <Metric label="累计耗时" value={s.elapsed} unit="ms" sub="示意值：命中 20 / 未命中 200" />
        <Metric label="比无缓存节省" value={saved} unit="ms" good sub={s.cursor ? `用时减少 ${Math.round(saved / (s.cursor * 200) * 100)}%` : '运行后看看差多少'} /></div>
    </div>
    <aside className="lab-side">
      <section className="lab-control-card"><h3><Gauge size={18} />你来调参数</h3>
        <Range label="缓存容量" value={s.capacity} min={0} max={3} suffix=" 格" onChange={reset} hint="修改容量会重新开始。0 格可以对比没有缓存的情况。" />
        <div className="lab-prediction"><span className="lab-small-label"><Sparkles size={14} />先猜，再验证</span>
          <h4>{run.finished ? '这轮跑完了，试试不同容量？' : `下一次请求 ${current}，会命中吗？`}</h4>
          {!run.finished && <div className="lab-choice-row"><button type="button" aria-pressed={prediction?.at === s.cursor && prediction.hit} className={prediction?.at === s.cursor && prediction.hit ? 'is-picked' : ''} onClick={() => predict(true)}>会命中</button>
            <button type="button" aria-pressed={prediction?.at === s.cursor && !prediction.hit} className={prediction?.at === s.cursor && !prediction.hit ? 'is-picked' : ''} onClick={() => predict(false)}>要读数据源</button></div>}
          <p aria-live="polite">{result ? <><b>{prediction.hit === result.hit ? '猜对了！' : '再想一步：'}</b>请求 {result.key} 时{result.hit ? '缓存里已经有它' : '缓存里没有它'}。</> : prediction ? '已选好，点「下一次请求」揭晓。' : '选一个答案，再执行一次请求。'}</p>
        </div>
        <BackToExperiment reduce={reduce} />
      </section>
      <Challenge earned={earned} title="8 次请求，至少命中 4 次" hint="给缓存留多少位置，才能减少重复读取？" progress={s.hits} total={4}>
        {run.finished && s.hits < 4 && <p className="lab-challenge-tip">还差一点：增加缓存容量，再跑一次。</p>}
      </Challenge>
      <div className="lab-takeaway"><b>记住这一点</b><p>缓存拿空间换时间。位置有限时，LRU 会先移走最久没用的数据。</p></div>
    </aside>
  </div>
}

function QueueLab(props) {
  const { reduce, earned } = props
  const run = useExperiment('queue', queueStart, queueStep, queueFinished, props)
  const s = run.state
  const reset = (arrivals = s.arrivals, workers = s.workers) => run.reset(queueStart(arrivals, workers))
  const capacity = s.workers * 2
  const balanced = s.arrivals <= capacity
  const workerTasks = i => s.last?.finished.slice(i * 2, i * 2 + 2) || []
  return <div className="lab-layout">
    <div className="lab-main-card">
      <PanelHeading num="02" title="接住每一波任务" subtitle="生产者发任务，队列缓冲，消费者来处理。" tag={`模拟 ${s.tick} / 12 秒`} />
      <Playback run={run} reduce={reduce} onReset={() => reset()} stepLabel="下一秒">
        <button type="button" className="lab-btn lab-btn-burst" disabled={run.finished} onClick={() => { run.setPlaying(false); run.setState(v => queueStep(v, 10)) }}><Plus size={15} />突发 10 个</button>
      </Playback>
      <div className="lab-queue-stage">
        <div className="lab-producer"><span className="lab-machine-icon"><Plus size={25} /></span><div><b>任务入口</b><small>每秒 {s.arrivals} 个</small></div>
          <div className="lab-arrival-dots" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={`${s.tick}-${i}`} className={s.tick ? 'is-flowing' : ''} style={{ '--i': i }} />)}</div><ArrowDown size={19} /></div>
        <div className="lab-queue-container"><div className="lab-queue-title"><span><Layers3 size={16} />等待队列</span><b>{s.tasks.length}<small> / 30</small></b></div>
          <div className="lab-task-grid" aria-label={`${s.tasks.length} 个任务等待处理`}>
            <AnimatePresence initial={false} mode="popLayout">{s.tasks.map(task => <motion.span key={task} layout={!reduce} className="lab-task"
              initial={reduce ? false : { opacity: 0, scale: 0.55, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 14 }} transition={{ duration: 0.3 }}>T{task}</motion.span>)}</AnimatePresence>
            {s.tasks.length === 0 && <span className="lab-queue-empty"><Check size={23} /><b>{s.tick ? '来得及处理，没有积压' : '队列准备好了'}</b><small>{s.tick ? '这一秒的新任务已全部处理' : '点「下一秒」，让任务进来'}</small></span>}
          </div>
          {s.tasks.length > 20 && <small className="lab-queue-warning">队列快满了，试试增加消费者。</small>}
        </div>
        <div className="lab-worker-bridge"><ArrowDown size={20} /><span>按先来后到的顺序处理</span></div>
        <div className="lab-workers" style={{ '--workers': s.workers }}>{Array.from({ length: s.workers }, (_, i) => <motion.div key={i} layout={!reduce}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`lab-worker ${workerTasks(i).length ? 'is-working' : ''}`}>
          <span className="lab-worker-number">{String(i + 1).padStart(2, '0')}</span><Server size={23} /><b>消费者 {i + 1}</b><small>2 个 / 秒</small>
          <div className="lab-worker-tokens">{workerTasks(i).map(task => <motion.span key={task} initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>T{task}<Check size={10} /></motion.span>)}</div>
        </motion.div>)}</div>
      </div>
      <Status step={s.tick} reduce={reduce} tone={s.tick && !s.tasks.length ? 'success' : ''}>
        {!s.last ? <>每个消费者每秒处理 2 个任务。先跑一步，再试着加人。</> : <><b>第 {s.tick} 秒：来了 {s.last.incoming.length} 个，处理了 {s.last.finished.length} 个，等待 {s.tasks.length} 个。</b>
          <span>{s.last.rejected ? `队列已满，这一秒有 ${s.last.rejected} 个任务被拒绝。` : balanced ? '处理能力足够，普通流量不会持续积压。' : '新任务比处理能力多，队列会越来越长。'}</span></>}
      </Status>
      <div className="lab-metrics"><Metric label="正在等待" value={s.tasks.length} unit="个" sub="超出 30 个位置会拒绝新任务" />
        <Metric label="累计处理" value={s.processed} unit="个" good sub={`处理能力 ${capacity} 个 / 秒`} />
        <Metric label="累计拒绝" value={s.rejected} unit="个" sub={s.rejected ? '试试更多消费者' : '目前没有丢弃任务'} /></div>
      <div className="lab-queue-trend" aria-label={`近 ${s.history.length} 秒的队列长度：${s.history.join('、') || '尚未运行'}`}>
        <span>排队趋势</span><div>{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < s.tick ? 'has-value' : ''}
          style={{ '--bar-h': `${s.history[i] ? Math.max(8, s.history[i] / 30 * 100) : 5}%` }} />)}</div><small>12 秒</small>
      </div>
    </div>
    <aside className="lab-side">
      <section className="lab-control-card"><h3><Gauge size={18} />你来调参数</h3>
        <Range label="每秒新任务" value={s.arrivals} min={1} max={8} suffix=" 个" onChange={n => reset(n, s.workers)} />
        <Range label="消费者数量" value={s.workers} min={1} max={4} suffix=" 人" onChange={n => reset(s.arrivals, n)} />
        <div className={`lab-capacity-note ${balanced ? 'is-balanced' : ''}`}><b>{s.arrivals} 个进入 <ArrowRight size={14} />{capacity} 个能处理</b>
          <span>{balanced ? '处理能力跟得上' : `每秒多出 ${s.arrivals - capacity} 个等待`}</span></div>
        <p className="lab-param-note">修改参数会重新开始。「突发 10 个」会把额外任务和下一秒的正常流量一起送进来。</p>
        <BackToExperiment reduce={reduce} />
      </section>
      <Challenge earned={earned} title="每秒来 6 个，连续 5 秒不积压" hint="把新任务设为 6，再找到合适的消费者数量。" progress={s.arrivals === 6 && !s.rejected ? queueClearStreak(s) : 0} total={5}>
        <p className="lab-challenge-tip">小提示：一个人每秒可以处理 2 个。</p>
      </Challenge>
      <div className="lab-takeaway"><b>记住这一点</b><p>队列能缓冲突发流量。如果任务一直来得更快，仍然需要提升处理能力。</p></div>
    </aside>
  </div>
}

function RaceLab(props) {
  const { reduce, earned } = props
  const run = useExperiment('race', raceStart, raceStep, raceFinished, props)
  const s = run.state
  const reset = (locked = s.locked) => run.reset(raceStart(locked))
  const manual = who => { run.setPlaying(false); run.setState(v => raceStep(v, who)) }
  const lost = run.finished && s.value !== 2
  const [guess, setGuess] = useState(null)
  const resetAll = (locked = s.locked) => { reset(locked); setGuess(null) }
  return <div className="lab-layout">
    <div className="lab-main-card">
      <PanelHeading num="03" title="一起加一，结果一定是二？" subtitle="每个任务都要先读取，再写回。你来安排执行顺序。" tag={s.locked ? '已启用互斥锁' : '未加锁'} />
      <Playback run={run} reduce={reduce} onReset={() => resetAll()} stepLabel="交替下一步" />
      <div className="lab-race-stage">
        <div className="lab-shared-counter"><small>共享计数器</small><motion.b key={s.value} initial={reduce ? false : { scale: 0.72, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{s.value}</motion.b>
          <span>两个任务各加 1 · 目标值 <b>2</b></span>
          <span className={`lab-lock-status ${s.locked ? 'is-locked' : ''}`}>{s.locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}{s.owner ? `${s.owner} 持有锁` : s.locked ? '锁空闲' : '任何任务都能读写'}</span>
        </div>
        <div className="lab-race-branches" aria-hidden="true"><i /><i /></div>
        <div className="lab-actors">{['A', 'B'].map(who => {
          const a = s.actors[who]
          const blocked = s.locked && s.owner && s.owner !== who && a.phase !== 2
          return <div key={who} className={`lab-actor lab-actor-${who.toLowerCase()} ${s.last?.who === who ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`}>
            <div className="lab-actor-heading"><span>{who}</span><b>任务 {who}</b>{a.phase === 2 ? <Check size={17} /> : blocked ? <LockKeyhole size={16} /> : <span className="lab-actor-light" />}</div>
            <ol className="lab-actor-steps"><li className={a.phase >= 1 ? 'is-done' : ''}><span>{a.phase >= 1 ? <Check size={12} /> : '1'}</span>读取 <b>{a.read ?? '—'}</b></li>
              <li className={a.phase === 2 ? 'is-done' : ''}><span>{a.phase === 2 ? <Check size={12} /> : '2'}</span>写入 <b>{a.phase === 2 ? a.read + 1 : a.phase === 1 ? `${a.read + 1}（待写）` : '—'}</b></li></ol>
            <button type="button" className="lab-actor-action" disabled={a.phase === 2} onClick={() => manual(who)}>
              {a.phase === 2 ? <><Check size={14} />已完成</> : <>{blocked ? <LockKeyhole size={14} /> : <Play size={13} fill="currentColor" />}执行 {who} · {a.phase === 0 ? '读取' : '写入'}</>}</button>
          </div>
        })}</div>
      </div>
      <Status step={s.step} reduce={reduce} tone={run.finished && !lost ? 'success' : lost ? 'warning' : ''}>
        {run.finished ? <><b>{lost ? '两次加一，结果却是 1：发生了丢失更新。' : '最终值是 2，两次更新都保住了。'}</b><span>{lost ? 'A 和 B 都基于旧值 0 计算，后写入的 1 覆盖了前面的 1。' : s.locked ? '锁让「读取 → 写回」完整执行，再交给另一个任务。' : '这次的执行顺序没有重叠；其他交错顺序仍可能出错。'}</span></>
          : s.last ? <><b>{s.last.text}</b><span>{s.last.type === 'wait' ? '等待不会改变计数器，继续执行持有锁的任务。' : '观察两个任务各自读到的数，再安排下一步。'}</span></>
            : <>点「交替下一步」观察 A、B 交错执行，也可以分别点两个任务。</>}
      </Status>
      <div className="lab-event-log" aria-label="执行记录"><div><span>执行记录</span><small>最近 8 步</small></div>
        {s.history.length ? <ol>{s.history.map((event, i) => <motion.li key={`${s.step - s.history.length + i}`}
          initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
          <i className={`lab-log-dot ${event.type}`} /><span>{event.text}</span></motion.li>)}</ol> : <p>还没有操作。先试不加锁，再打开锁对比。</p>}
      </div>
    </div>
    <aside className="lab-side">
      <section className="lab-control-card"><h3><Gauge size={18} />你来调参数</h3>
        <button type="button" role="switch" aria-checked={s.locked} className="lab-lock-toggle" onClick={() => resetAll(!s.locked)}>
          <span><b>给读写加一把锁</b><small>{s.locked ? '一个任务完整执行后再交棒' : '两个任务可能读到同一个旧值'}</small></span><i className={s.locked ? 'is-on' : ''}><span /></i>
        </button><p className="lab-param-note">切换锁会重置本轮，方便用相同起点比较。</p>
        <div className="lab-prediction"><span className="lab-small-label"><Sparkles size={14} />先猜，再验证</span><h4>按 A、B 交替执行，最终是？</h4>
          <div className="lab-choice-row">{[1, 2].map(n => <button key={n} type="button" disabled={s.step > 0} aria-pressed={guess === n} className={guess === n ? 'is-picked' : ''} onClick={() => setGuess(n)}>{n}</button>)}</div>
          <p aria-live="polite">{run.finished ? <>本轮结果：<b>{s.value}</b>。{guess == null ? '重置后可以先猜一次。' : guess === s.value ? '猜对了！' : '看看执行记录里，两个人各自读到了多少。'}</> : s.step ? '观察记录，看看读和写怎样交错。' : '先选答案，再用「交替下一步」验证。'}</p>
        </div>
        <BackToExperiment reduce={reduce} />
      </section>
      <Challenge earned={earned} title="保住两次更新，让最终值等于 2" hint="打开锁，执行完 A 和 B 的读取与写入。" progress={s.locked ? Object.values(s.actors).filter(x => x.phase === 2).length : 0} total={2} />
      <div className="lab-takeaway"><b>记住这一点</b><p>锁要保护整个「读取 → 修改 → 写回」。不加锁时，结果取决于执行顺序。</p></div>
    </aside>
  </div>
}

function Related({ id }) {
  const { idx } = useApp()
  return <section className="lab-related"><div><span className="lab-small-label">CONNECT THE DOTS</span><h2>玩懂了，再连上知识点</h2></div>
    <div>{LAB_LINKS[id].map(slug => { const x = idx.bySlug[slug]; return x && <Link key={slug} to={`/c/${slug}`}><span className="emo">{x.emoji}</span><b>{x.zh}</b><ArrowRight size={16} /></Link> })}</div>
  </section>
}
