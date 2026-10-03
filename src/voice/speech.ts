import type { A11ySettings } from '../state/accessibilitySettings'

const RATE = { slow: 0.8, normal: 1, fast: 1.25 } as const

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Speaks text with the viewer's voice settings. Silently does nothing where unsupported (voice is optional, spec §42.2). */
export function speak(text: string, settings: Pick<A11ySettings, 'speechRate' | 'volume'>, interrupt = true) {
  if (!canSpeak() || !text.trim()) return
  if (interrupt) window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = RATE[settings.speechRate]
  u.volume = settings.volume
  u.lang = 'en-IN'
  window.speechSynthesis.speak(u)
}

export const stopSpeaking = () => canSpeak() && window.speechSynthesis.cancel()
