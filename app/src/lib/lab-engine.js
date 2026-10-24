// Deterministic teaching models. Latencies and capacities are illustrative.
export const CACHE_REQUESTS = ['A', 'B', 'A', 'B', 'C', 'A', 'C', 'A']
export const LAB_LINKS = {
  cache: ['cache-hit-ratio', 'cache-aside', 'redis-eviction-policies'],
  queue: ['message-queue', 'dead-letter-queues'],
  race: ['race-conditions', 'concurrency-vs-parallelism', 'pessimistic-locking'],
}
export function labForConcept(slug) {
  return Object.keys(LAB_LINKS).find(id => LAB_LINKS[id].includes(slug))
    || ({ redis: 'cache', 'cache-invalidation': 'cache', 'cache-warming': 'cache',
      'processes-and-threads': 'race', 'distributed-locks': 'race' })[slug]
}

export const cacheStart = (capacity = 2) => ({ capacity, cursor: 0, keys: [], hits: 0, elapsed: 0, last: null, history: [] })
export function cacheStep(s) {
  if (s.cursor >= CACHE_REQUESTS.length) return s
  const key = CACHE_REQUESTS[s.cursor]
  const hit = s.keys.includes(key)
  const keys = s.capacity ? [...s.keys.filter(x => x !== key), key].slice(-s.capacity) : []
  const evicted = s.keys.find(x => !keys.includes(x)) || null
  const last = { key, hit, evicted, duration: hit ? 20 : 200 }
  return { ...s, cursor: s.cursor + 1, keys, hits: s.hits + Number(hit), elapsed: s.elapsed + last.duration,
    last, history: [...s.history, last] }
}

export const queueStart = (arrivals = 6, workers = 1) => ({ arrivals, workers, tick: 0, tasks: [], processed: 0,
  rejected: 0, nextId: 1, last: null, history: [] })
export function queueStep(s, burst = 0) {
  if (s.tick >= 12) return s
  const incoming = Array.from({ length: s.arrivals + burst }, (_, i) => s.nextId + i)
  const available = [...s.tasks, ...incoming]
  const count = Math.min(available.length, s.workers * 2)
  const finished = available.slice(0, count)
  const waiting = available.slice(count)
  const rejected = Math.max(0, waiting.length - 30)
  const last = { incoming, finished, rejected, before: s.tasks.length, tick: s.tick + 1 }
  return { ...s, tick: s.tick + 1, tasks: waiting.slice(0, 30), processed: s.processed + count,
    rejected: s.rejected + rejected, nextId: s.nextId + incoming.length, last,
    history: [...s.history, waiting.slice(0, 30).length] }
}
export function queueClearStreak(s) {
  let count = 0
  for (let i = s.history.length - 1; i >= 0 && s.history[i] === 0; i--) count++
  return count
}

export const raceStart = (locked = false) => ({ locked, value: 0, owner: null, turn: 'A', step: 0,
  actors: { A: { phase: 0, read: null }, B: { phase: 0, read: null } }, last: null, history: [] })
export const raceFinished = s => Object.values(s.actors).every(x => x.phase === 2)
export function raceStep(s, requested) {
  if (raceFinished(s)) return s
  let who = requested || s.turn
  if (s.actors[who].phase === 2) {
    if (requested) return s
    who = who === 'A' ? 'B' : 'A'
  }
  const actor = s.actors[who]
  const next = who === 'A' ? 'B' : 'A'
  if (s.locked && s.owner && s.owner !== who) {
    const last = { who, type: 'wait', text: `${who} 等一等：锁还在 ${s.owner} 手里。` }
    return { ...s, step: s.step + 1, turn: next, last, history: [...s.history, last].slice(-8) }
  }
  if (actor.phase === 0) {
    const last = { who, type: 'read', text: `${who} 读到 ${s.value}，准备写入 ${s.value + 1}。` }
    return { ...s, step: s.step + 1, turn: next, owner: s.locked ? who : null,
      actors: { ...s.actors, [who]: { phase: 1, read: s.value } }, last, history: [...s.history, last].slice(-8) }
  }
  const value = actor.read + 1
  const last = { who, type: 'write', text: `${who} 写入 ${value}${s.locked ? '，然后释放锁' : ''}。` }
  return { ...s, step: s.step + 1, turn: next, owner: null, value,
    actors: { ...s.actors, [who]: { ...actor, phase: 2 } }, last, history: [...s.history, last].slice(-8) }
}

export function challengePassed(id, s) {
  if (id === 'cache') return s.cursor === 8 && s.hits >= 4
  if (id === 'queue') return s.arrivals === 6 && queueClearStreak(s) >= 5 && s.rejected === 0
  if (id === 'race') return s.locked && raceFinished(s) && s.value === 2
  return false
}
