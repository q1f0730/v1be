// localStorage —— 与旧站完全兼容：aig:done（已学会 slug 数组）、aig:prefs（阅读设置）、aig:last（上次看到的 slug）
// 新增 aig:theme（'light' | 'dark'），不影响旧键。所有值都用 JSON 存（和旧站 store.get/set 一样）。
import { useSyncExternalStore, useCallback } from 'react'

const KEY = k => 'aig:' + k
export function lsGet(k, d) {
  try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v == null ? d : v } catch { return d }
}
export function lsSet(k, v) { try { localStorage.setItem(KEY(k), JSON.stringify(v)) } catch { /* 隐私模式等 */ } }

// 一个极小的可订阅 store
function createStore(read) {
  let value = read()
  const subs = new Set()
  return {
    get: () => value,
    set(next) { value = typeof next === 'function' ? next(value) : next; subs.forEach(f => f()) },
    sub(f) { subs.add(f); return () => subs.delete(f) },
    reload() { value = read(); subs.forEach(f => f()) },
  }
}

// ---- 已学会 ----
const doneStore = createStore(() => new Set(lsGet('done', [])))
export function useDone() {
  const done = useSyncExternalStore(doneStore.sub, doneStore.get)
  const toggle = useCallback(slug => {
    doneStore.set(prev => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); lsSet('done', [...n]); return n })
  }, [])
  return [done, toggle]
}

// ---- 阅读设置 ----
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const DEFAULT_PREFS = { fs: 18, calm: false, focus: false, still: false }
const prefsStore = createStore(() => {
  const had = (() => { try { return localStorage.getItem('aig:prefs') != null } catch { return false } })()
  const p = { ...DEFAULT_PREFS, ...lsGet('prefs', {}) }
  if (!had && reduceMotion) p.still = true // 系统要求少动画 → 默认定格（同旧站）
  return p
})
export function usePrefs() {
  const prefs = useSyncExternalStore(prefsStore.sub, prefsStore.get)
  const setPrefs = useCallback(patch => {
    prefsStore.set(prev => { const n = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }; lsSet('prefs', n); return n })
  }, [])
  return [prefs, setPrefs]
}
export const getPrefs = () => prefsStore.get()

// ---- 主题 ----
const sysDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
const themeStore = createStore(() => lsGet('theme', null) || (sysDark() ? 'dark' : 'light'))
export function useTheme() {
  const theme = useSyncExternalStore(themeStore.sub, themeStore.get)
  const setTheme = useCallback(t => { lsSet('theme', t); themeStore.set(t) }, [])
  return [theme, setTheme]
}

// ---- 上次看到 ----
export const getLast = () => lsGet('last', null)
export const setLast = slug => lsSet('last', slug)

// 其他标签页改了进度 → 同步
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === 'aig:done') doneStore.reload()
    if (e.key === 'aig:prefs') prefsStore.reload()
    if (e.key === 'aig:theme') themeStore.reload()
  })
}
