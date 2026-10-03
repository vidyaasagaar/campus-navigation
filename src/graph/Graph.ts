import type { DisabledEdge, GraphEdge, GraphNode } from './types'

/**
 * Undirected weighted graph stored as an adjacency list.
 * Each undirected connection is stored once per direction so that
 * neighbour lookup is O(deg(v)).
 */
export class Graph {
  private nodes = new Map<string, GraphNode>()
  private adjacency = new Map<string, GraphEdge[]>()
  readonly disabled: DisabledEdge[] = []

  addNode(node: GraphNode): void {
    if (this.nodes.has(node.id)) throw new Error(`Duplicate node: ${node.id}`)
    this.nodes.set(node.id, node)
    this.adjacency.set(node.id, [])
  }

  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.from)) throw new Error(`Unknown node: ${edge.from}`)
    if (!this.nodes.has(edge.to)) throw new Error(`Unknown node: ${edge.to}`)
    if (!(edge.weight > 0)) throw new Error(`Edge ${edge.from}–${edge.to} needs a positive distance`)
    // Routes are node sequences, so two edges between the same pair would be ambiguous.
    // Model alternatives (stairs vs lift) as separate nodes instead.
    if (this.edge(edge.from, edge.to)) throw new Error(`Duplicate edge ${edge.from}–${edge.to}`)
    this.adjacency.get(edge.from)!.push(edge)
    this.adjacency.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from, path: [...edge.path].reverse() })
  }

  addDisabledEdge(edge: DisabledEdge): void {
    this.disabled.push(edge)
  }

  node(id: string): GraphNode {
    const n = this.nodes.get(id)
    if (!n) throw new Error(`Unknown node: ${id}`)
    return n
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  neighbours(id: string): readonly GraphEdge[] {
    return this.adjacency.get(id) ?? []
  }

  edge(from: string, to: string): GraphEdge | undefined {
    return this.neighbours(from).find((e) => e.to === to)
  }

  allNodes(): GraphNode[] {
    return [...this.nodes.values()]
  }

  /** Each undirected edge once. */
  allEdges(): GraphEdge[] {
    const seen = new Set<string>()
    const out: GraphEdge[] = []
    for (const edges of this.adjacency.values()) {
      for (const e of edges) {
        const key = [e.from, e.to].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(e)
      }
    }
    return out
  }

  get vertexCount(): number {
    return this.nodes.size
  }

  get edgeCount(): number {
    return this.allEdges().length
  }
}
