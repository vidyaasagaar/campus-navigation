import type { Graph } from '../graph/Graph'
import type { DijkstraResult } from './dijkstra'

const m = (d: number) => (Number.isFinite(d) ? `${d.toFixed(2)} m` : '∞')

/**
 * Human-readable log of one Dijkstra run (learning guide §45).
 * Built from the step trace the algorithm already records — it shows what
 * the algorithm actually did, not a re-enactment.
 */
export function formatDijkstraLog(graph: Graph, r: DijkstraResult): string {
  const name = (id: string) => graph.node(id).name
  const lines = ['[DIJKSTRA]', '', `Start: ${name(r.source)}`, `Destination: ${name(r.target)}`, '']
  for (const s of r.steps) {
    switch (s.type) {
      case 'visit':
        lines.push(`Current node: ${name(s.node)}  (finalised at ${m(s.distance)})`)
        break
      case 'relax':
        lines.push(
          s.improved
            ? `  Relax ${name(s.from)} → ${name(s.to)}: ${m(s.oldDistance)} → ${m(s.newDistance)}  ✓ shorter, update`
            : `  Relax ${name(s.from)} → ${name(s.to)}: ${m(s.oldDistance)} kept (via ${name(s.from)} is not shorter)`,
        )
        break
      case 'reject':
        lines.push(`  Skip ${name(s.from)} → ${name(s.to)}: ${s.reason}`)
        break
      case 'skip-stale':
        lines.push(`  (stale heap entry for ${name(s.node)} ignored)`)
        break
      case 'done':
        lines.push('')
        if (s.path.length) {
          lines.push('Destination reached.', '', 'Route:', ...s.path.map((id, i) => `${i ? '→ ' : ''}${name(id)}`), '', 'Total distance:', m(s.distance))
        } else lines.push('Destination unreachable with the allowed edges.')
        break
    }
  }
  lines.push('', `Nodes finalised: ${r.visitedOrder.length} of ${graph.vertexCount}`)
  return lines.join('\n')
}
