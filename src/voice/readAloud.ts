import { ROUTE_MODES, isConstrained, type RouteAssessment, type RouteMode } from '../algorithms/accessibility'
import type { Graph } from '../graph/Graph'
import type { A11ySettings } from '../state/accessibilitySettings'

const metres = (m: number) => `${Math.round(m)} metres`
const minutes = (s: number) => {
  const m = Math.max(1, Math.round(s / 60))
  return `about ${m} minute${m === 1 ? '' : 's'}`
}

/**
 * Read-aloud text built from the calculated route (spec §42.1): destination,
 * distance, estimated duration, route sequence, accessibility status, warnings.
 */
export function routeSummaryText(o: {
  graph: Graph
  path: string[]
  distance: number
  walkingSpeed: number
  mode: RouteMode
  assessment: RouteAssessment | null
  settings: Pick<A11ySettings, 'readRoute' | 'readAccessibility'>
  room?: string | null
}): string {
  const { graph, path } = o
  const dest = graph.node(path[path.length - 1]).name
  const parts = [
    `Route to ${dest}${o.room ? `, then inside to ${o.room}` : ''}.`,
    `${metres(o.distance)}, ${minutes(o.distance / o.walkingSpeed)} walk. This is an estimate.`,
  ]
  if (o.settings.readRoute) {
    const steps: string[] = []
    for (let i = 1; i < path.length; i++) {
      const e = graph.edge(path[i - 1], path[i])!
      const to = graph.node(path[i])
      if (to.kind === 'junction') continue
      steps.push(`walk ${metres(e.weight)} to ${to.name}`)
    }
    parts.push(`Start at ${graph.node(path[0]).name}, then ${steps.join(', then ')}.`)
  }
  if (o.settings.readAccessibility && o.assessment) {
    const m = ROUTE_MODES.find((x) => x.id === o.mode)!
    if (isConstrained(o.mode))
      parts.push(
        o.assessment.unverifiedSegments
          ? `${m.label} mode. Accessibility of this route is not verified.`
          : `${m.label} route with verified accessibility.`,
      )
    for (const c of o.assessment.checks) parts.push(`${c}.`)
    for (const w of o.assessment.warnings) parts.push(`Warning: ${w.text}.`)
  }
  return parts.join(' ')
}
