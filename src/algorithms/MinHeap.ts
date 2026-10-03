/** Binary min-heap keyed by a numeric priority. push/pop are O(log n). */
export class MinHeap<T> {
  private items: { priority: number; value: T }[] = []

  get size(): number {
    return this.items.length
  }

  push(value: T, priority: number): void {
    this.items.push({ priority, value })
    this.siftUp(this.items.length - 1)
  }

  pop(): { value: T; priority: number } | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      this.siftDown(0)
    }
    return top
  }

  private siftUp(i: number): void {
    const items = this.items
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent].priority <= items[i].priority) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  private siftDown(i: number): void {
    const items = this.items
    const n = items.length
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let smallest = i
      if (l < n && items[l].priority < items[smallest].priority) smallest = l
      if (r < n && items[r].priority < items[smallest].priority) smallest = r
      if (smallest === i) break
      ;[items[smallest], items[i]] = [items[i], items[smallest]]
      i = smallest
    }
  }
}
