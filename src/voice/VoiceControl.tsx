import { useEffect, useRef, useState } from 'react'

// Minimal typing for the Web Speech API (not in TS's DOM lib everywhere).
interface RecognitionResultEvent {
  results: { 0: { transcript: string }; isFinal: boolean }[] & { length: number }
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const getRecognition = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface Props {
  feedback: { text: string; options?: { id: string; label: string }[] } | null
  onCommand: (text: string) => void
  onPickOption: (id: string) => void
  onClose: () => void
}

/**
 * Voice-to-action (spec §41). Speech → text → `parseCommand` (in the app) →
 * explicit actions. The typed box gives the same commands without a microphone.
 */
export function VoiceControl({ feedback, onCommand, onPickOption, onClose }: Props) {
  const Ctor = getRecognition()
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const rec = useRef<Recognition | null>(null)

  useEffect(() => () => rec.current?.stop(), [])

  const listen = () => {
    if (!Ctor) return
    if (listening) {
      rec.current?.stop()
      return
    }
    const r = new Ctor()
    r.lang = 'en-IN'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      setHeard(last[0].transcript)
      if (last.isFinal) onCommand(last[0].transcript)
    }
    r.onerror = (e) => setHeard(e.error === 'not-allowed' ? 'Microphone permission was denied.' : `Speech error: ${e.error}`)
    r.onend = () => setListening(false)
    rec.current = r
    setHeard('')
    setListening(true)
    r.start()
  }

  return (
    <div className="glass w-[min(340px,calc(100vw-32px))] rounded-2xl" role="dialog" aria-label="Voice commands">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="font-mono text-[11px] tracking-[0.25em] text-[#f2552c]">VOICE</div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Close voice commands">
          ✕
        </button>
      </div>
      <div className="space-y-3 p-4 text-sm">
        {Ctor ? (
          <button
            onClick={listen}
            aria-pressed={listening}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition ${
              listening ? 'bg-[#f2552c] text-white' : 'bg-white/10 hover:bg-white/15'
            }`}
          >
            <span aria-hidden>🎤</span>
            {listening ? 'Listening… tap to stop' : 'Tap and speak'}
          </button>
        ) : (
          <p className="text-xs text-white/55">Speech recognition is not available in this browser — type a command instead.</p>
        )}
        {heard && (
          <p className="text-xs text-white/70">
            Heard: <span className="italic">“{heard}”</span>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) onCommand(typed)
            setTyped('')
          }}
          className="flex gap-2"
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="e.g. Take me to the canteen"
            aria-label="Type a command"
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm focus:border-[#f2552c] focus:outline-none"
          />
          <button type="submit" className="ctrl h-10">
            Go
          </button>
        </form>
        {feedback && (
          <div role="status" aria-live="polite" className="rounded-lg bg-white/5 p-3 text-xs">
            {feedback.text}
            {feedback.options && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {feedback.options.map((o) => (
                  <button key={o.id} onClick={() => onPickOption(o.id)} className="ctrl h-8">
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] leading-snug text-white/40">
          Try: “Navigate to Block B”, “Take me to the badminton court”, “Use wheelchair mode”, “Pause navigation”, “Repeat”.
        </p>
      </div>
    </div>
  )
}
