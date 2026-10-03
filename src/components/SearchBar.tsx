import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { campus } from '../data/campusGraph'

interface Props {
  onNavigate: () => void
}

const KEYWORDS = ['mrtc', 'malla', 'reddy', 'technical', 'vishwavidyapeeth', 'maisammaguda', 'hyderabad', 'campus']

export function SearchBar({ onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const match = q.length > 0 && KEYWORDS.some((k) => k.startsWith(q) || q.includes(k))

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass w-[min(520px,calc(100vw-32px))] rounded-2xl p-2"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (match || q === '') onNavigate()
        }}
        className="flex items-center gap-2"
      >
        <svg viewBox="0 0 24 24" className="ml-3 h-4 w-4 shrink-0 text-white/50" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a campus — try “MRTC”"
          aria-label="Search a campus"
          className="h-11 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="submit"
          className="h-11 rounded-xl bg-[#f2552c] px-4 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          Navigate to MRTC
        </button>
      </form>
      <AnimatePresence>
        {match && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onClick={onNavigate}
            className="mt-1 flex w-full items-start gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#f2552c]" />
            <span>
              <span className="block text-sm font-semibold text-white">{campus.fullName}</span>
              <span className="block text-xs text-white/55">{campus.address}</span>
              <span className="mt-0.5 block font-mono text-[11px] text-white/40">
                {campus.googlePlaceCoordinate.lat.toFixed(5)}° N, {campus.googlePlaceCoordinate.lng.toFixed(5)}° E
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
