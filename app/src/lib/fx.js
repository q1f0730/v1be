// 小工具：撒花、复制、朗读
import { getPrefs } from './store'

export function burst(chars) {
  if (getPrefs().still) return
  let el = document.getElementById('burst')
  if (!el) { el = document.createElement('div'); el.id = 'burst'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el) }
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span')
    s.textContent = chars[i % chars.length]
    s.style.left = 50 + (Math.random() * 20 - 10) + '%'; s.style.top = '60%'
    s.style.setProperty('--x', (Math.random() * 600 - 300) + 'px')
    s.style.setProperty('--y', (-Math.random() * 500 - 100) + 'px')
    el.appendChild(s); setTimeout(() => s.remove(), 1500)
  }
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
    } catch { return false }
  }
}

// ---- 朗读（speechSynthesis，zh-CN，语速 0.92，同旧站）----
let current = null // { id, onEnd }
const subs = new Set()
export const speechState = () => current?.id || null
export const onSpeech = f => { subs.add(f); return () => subs.delete(f) }
const emit = () => subs.forEach(f => f())
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function stopSpeak() {
  if (canSpeak()) speechSynthesis.cancel()
  current = null; emit()
}
export function speak(id, text) {
  if (!canSpeak()) { alert('这个浏览器不支持朗读，换 Chrome / Edge 试试'); return }
  if (current?.id === id) { stopSpeak(); return }
  speechSynthesis.cancel()
  const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').replace(/\s+/g, ' ')
  const u = new SpeechSynthesisUtterance(clean); u.lang = 'zh-CN'; u.rate = 0.92
  const v = speechSynthesis.getVoices().find(v => /zh[-_]CN/i.test(v.lang)); if (v) u.voice = v
  u.onend = u.onerror = () => { if (current?.u === u) { current = null; emit() } }
  current = { id, u }; emit()
  speechSynthesis.speak(u)
}
