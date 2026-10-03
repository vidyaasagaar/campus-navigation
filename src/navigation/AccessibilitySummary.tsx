import { ROUTE_MODES, isConstrained, type RouteAssessment, type RouteMode } from '../algorithms/accessibility'

interface Props {
  mode: RouteMode
  assessment: RouteAssessment
  rejectedCount: number
}

/** What is known — and not known — about the accessibility of the chosen route (spec §34.8–34.9). */
export function AccessibilitySummary({ mode, assessment, rejectedCount }: Props) {
  const m = ROUTE_MODES.find((x) => x.id === mode)!
  const constrained = isConstrained(mode)
  if (!constrained && assessment.warnings.length === 0) return null
  const fullyVerified = constrained && assessment.unverifiedSegments === 0
  return (
    <section aria-label="Route accessibility" className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider">
        <span aria-hidden className="text-base">
          {m.icon}
        </span>
        {constrained ? (fullyVerified ? `${m.label} route` : `${m.label} mode — accessibility unverified`) : 'Route notes'}
      </div>
      {constrained && (
        <p className="mb-2 text-white/65">
          {rejectedCount > 0
            ? `${rejectedCount} path${rejectedCount === 1 ? '' : 's'} with recorded barriers were excluded.`
            : 'No path on campus has recorded barriers, so nothing was excluded.'}{' '}
          {!fullyVerified && 'This route avoids known barriers only — it has not been confirmed as accessible.'}
        </p>
      )}
      <ul className="space-y-1">
        {assessment.checks.map((c) => (
          <li key={c} className="flex gap-2 text-emerald-300">
            <span aria-hidden>✓</span>
            {c}
          </li>
        ))}
        {assessment.warnings.map((w) => (
          <li key={w.text} className="flex gap-2 text-amber-200">
            <span aria-hidden>{w.icon}</span>
            <span>
              <span className="sr-only">Warning: </span>
              {w.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Shown when the constraints leave no path at all. */
export function NoAccessibleRoute({ mode, blocker }: { mode: RouteMode; blocker?: string | null }) {
  const m = ROUTE_MODES.find((x) => x.id === mode)!
  return (
    <p role="alert" className="p-4 text-sm text-rose-200">
      <span aria-hidden>⚠ </span>
      {blocker
        ? `No verified ${m.label.toLowerCase()} route is currently available. ${blocker}`
        : isConstrained(mode)
        ? `No route is available in ${m.label} mode: every connection between these places has a recorded barrier or is unmeasured.`
        : 'No measured walkway connects these places yet. Measurement required.'}
    </p>
  )
}
