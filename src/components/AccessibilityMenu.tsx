import type { ReactNode } from 'react'
import type { A11ySettings, SpeechRate } from '../state/accessibilitySettings'
import { canSpeak } from '../voice/speech'

interface Props {
  settings: A11ySettings
  reducedMotion: boolean
  systemReducedMotion: boolean
  onChange: (patch: Partial<A11ySettings>) => void
  onClose: () => void
}

/** Viewer-side accessibility settings (spec §34.13, §34.14). */
export function AccessibilityMenu({ settings, reducedMotion, systemReducedMotion, onChange, onClose }: Props) {
  return (
    <div className="glass flex max-h-[calc(100vh-90px)] w-[min(340px,calc(100vw-32px))] flex-col rounded-2xl" role="dialog" aria-label="Accessibility and voice settings">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="font-mono text-[11px] tracking-[0.25em] text-[#f2552c]">SETTINGS</div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Close accessibility settings">
          ✕
        </button>
      </div>
      <div className="min-h-0 space-y-1 overflow-y-auto p-2">
        <SectionTitle>Accessibility</SectionTitle>
        <Toggle
          label="Reduce motion"
          hint={
            settings.reduceMotion === null
              ? `Following your device (${systemReducedMotion ? 'on' : 'off'}). Short transitions instead of the globe flight.`
              : 'Short transitions instead of the globe flight and camera moves.'
          }
          checked={reducedMotion}
          onChange={(v) => onChange({ reduceMotion: v })}
        />
        <Toggle
          label="High contrast"
          hint="Solid panels, stronger borders and text."
          checked={settings.highContrast}
          onChange={(v) => onChange({ highContrast: v })}
        />
        <Toggle
          label="Larger text"
          hint="Increases interface text size."
          checked={settings.largeText}
          onChange={(v) => onChange({ largeText: v })}
        />

        <SectionTitle>Voice {canSpeak() ? '' : '(not supported in this browser)'}</SectionTitle>
        <Toggle
          label="Voice guidance"
          hint="Speak turn-by-turn instructions while navigating."
          checked={settings.voiceGuidance}
          onChange={(v) => onChange({ voiceGuidance: v })}
        />
        <Toggle label="Read route" hint="Include the route sequence in Read Aloud." checked={settings.readRoute} onChange={(v) => onChange({ readRoute: v })} />
        <Toggle
          label="Read accessibility"
          hint="Include accessibility status and warnings in Read Aloud."
          checked={settings.readAccessibility}
          onChange={(v) => onChange({ readAccessibility: v })}
        />
        <div className="grid grid-cols-2 gap-2 px-3 py-2 text-xs">
          <label>
            <span className="mb-1 block text-white/60">Speech rate</span>
            <select
              value={settings.speechRate}
              onChange={(e) => onChange({ speechRate: e.target.value as SpeechRate })}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-white/60">Volume {Math.round(settings.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.volume}
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="h-9 w-full accent-[#f2552c]"
            />
          </label>
        </div>

        <SectionTitle>Walking time</SectionTitle>
        <label className="block px-3 pb-3 text-xs">
          <span className="mb-1 block text-white/60">Assumed walking speed (estimates only)</span>
          <select
            value={settings.walkingSpeed}
            onChange={(e) => onChange({ walkingSpeed: Number(e.target.value) })}
            className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2"
          >
            <option value={1.0}>Relaxed — 1.0 m/s (3.6 km/h)</option>
            <option value={1.4}>Normal — 1.4 m/s (5 km/h)</option>
            <option value={1.8}>Brisk — 1.8 m/s (6.5 km/h)</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{children}</div>
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? 'bg-[#f2552c]' : 'bg-white/20'}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold">
          {label} <span className="font-mono text-[11px] font-normal text-white/60">{checked ? 'ON' : 'OFF'}</span>
        </span>
        <span className="block text-xs text-white/55">{hint}</span>
      </span>
    </button>
  )
}
