import { useEffect, useState } from 'react'

export type SpeechRate = 'slow' | 'normal' | 'fast'

export interface A11ySettings {
  /** null = follow the operating-system setting. */
  reduceMotion: boolean | null
  highContrast: boolean
  largeText: boolean
  /** Spoken turn-by-turn guidance while navigating (spec §42.2). */
  voiceGuidance: boolean
  /** Include the route sequence when reading aloud. */
  readRoute: boolean
  /** Include accessibility status and warnings when reading aloud. */
  readAccessibility: boolean
  speechRate: SpeechRate
  /** 0–1 */
  volume: number
  /** Assumed walking speed in m/s for time estimates (spec §44). */
  walkingSpeed: number
}

const KEY = 'mrtc-a11y'
export const DEFAULT_WALKING_SPEED = 1.4

const DEFAULTS: A11ySettings = {
  reduceMotion: null,
  highContrast: false,
  largeText: false,
  voiceGuidance: false,
  readRoute: true,
  readAccessibility: true,
  speechRate: 'normal',
  volume: 1,
  walkingSpeed: DEFAULT_WALKING_SPEED,
}

function load(): A11ySettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

const systemReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Viewer accessibility preferences (spec §34.13–34.14), remembered per browser. */
export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<A11ySettings>(load)
  const [system, setSystem] = useState(systemReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setSystem(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // Storage unavailable (private mode etc.) — settings still apply for this visit.
    }
    const root = document.documentElement
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    root.dataset.text = settings.largeText ? 'large' : 'normal'
  }, [settings])

  const reducedMotion = settings.reduceMotion ?? system
  const update = (patch: Partial<A11ySettings>) => setSettings((s) => ({ ...s, ...patch }))
  return { settings, reducedMotion, systemReducedMotion: system, update }
}
