import type { RouteMode } from '../algorithms/accessibility'

export type Intent =
  | { type: 'navigate'; to: string }
  | { type: 'clarify'; query: string; options: string[] }
  | { type: 'room'; query: string }
  | { type: 'mode'; mode: RouteMode }
  | { type: 'nearest-accessible-entrance' }
  | { type: 'repeat' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'unknown'; text: string }

export interface Place {
  id: string
  name: string
}

/** Extra spoken names. Place names themselves are always aliases too. */
const ALIASES: Record<string, string[]> = {
  'block-a': ['a block', 'block a'],
  'block-b': ['b block', 'block b'],
  'block-c': ['c block', 'block c'],
  canteen: ['canteen', 'central kitchen', 'mess', 'food'],
  'girls-hostel': ['girls hostel', 'ladies hostel', 'hostel'],
  'boys-hostel': ['boys hostel', 'niat hostel', 'niat boys hostel', 'hostel'],
  'football-court': ['football', 'football ground', 'football court', 'turf'],
  'running-track': ['running track', 'track'],
  'box-cricket': ['box cricket', 'cricket'],
  'badminton-court': ['badminton', 'badminton court', 'court'],
  'basketball-court': ['basketball', 'basketball court', 'court'],
  'volleyball-court': ['volleyball', 'volleyball court', 'court'],
  'kabaddi-court': ['kabaddi', 'kabbadi', 'kabaddi court', 'court'],
  'bike-parking': ['bike parking', 'two wheeler parking', 'bike park', 'parking'],
  'car-parking': ['car parking', 'car park', 'parking'],
}

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `

/**
 * Resolves the place named in an utterance. The longest matching alias wins;
 * if several places tie, the result is a clarification request, never a guess (spec §41).
 */
export function resolvePlace(text: string, places: Place[]): { id: string } | { options: string[] } | null {
  const t = norm(text)
  let bestLen = 0
  let best: string[] = []
  for (const p of places) {
    const aliases = [p.name, ...(ALIASES[p.id] ?? [])].map((a) => norm(a).trim())
    for (const a of aliases) {
      if (!a || !t.includes(` ${a} `)) continue
      const len = a.split(' ').length + a.length / 1000
      if (len > bestLen + 1e-9) {
        bestLen = len
        best = [p.id]
      } else if (Math.abs(len - bestLen) < 1e-9 && !best.includes(p.id)) best.push(p.id)
    }
  }
  if (best.length === 0) return null
  return best.length === 1 ? { id: best[0] } : { options: best }
}

const MODES: [RegExp, RouteMode][] = [
  [/\bwheel ?chair\b/, 'wheelchair'],
  [/\bstep ?free\b/, 'step-free'],
  [/\b(avoid|no|without) stairs\b/, 'avoid-stairs'],
  [/\bfastest\b/, 'fastest'],
  [/\bshortest\b/, 'shortest'],
]

/** Turns one utterance into explicit commands (several are allowed, e.g. a place plus a mode). */
export function parseCommand(text: string, places: Place[]): Intent[] {
  const t = norm(text)
  const out: Intent[] = []
  if (/\b(repeat|say (that|it) again)\b/.test(t)) out.push({ type: 'repeat' })
  if (/\b(pause|hold on|wait)\b/.test(t)) out.push({ type: 'pause' })
  if (/\b(resume|continue|carry on)\b/.test(t)) out.push({ type: 'resume' })
  if (/\b(stop|cancel|end|exit) (the )?navigation\b|^ (stop|cancel) $/.test(t)) out.push({ type: 'stop' })
  for (const [re, mode] of MODES) {
    if (re.test(t)) {
      out.push({ type: 'mode', mode })
      break
    }
  }
  if (/\bnearest accessible entrance\b/.test(t)) out.push({ type: 'nearest-accessible-entrance' })

  const room = t.match(/\b([abc]) ?(\d{3})\b/)
  if (room) out.push({ type: 'room', query: `${room[1].toUpperCase()}-${room[2]}` })
  else if (/\b(navigate|take me|go|find|where is|directions|route)\b/.test(t) || out.length === 0) {
    const r = resolvePlace(text, places)
    if (r && 'id' in r) out.push({ type: 'navigate', to: r.id })
    else if (r) out.push({ type: 'clarify', query: text, options: r.options })
  }
  return out.length ? out : [{ type: 'unknown', text }]
}
