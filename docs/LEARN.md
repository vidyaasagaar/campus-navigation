# MRTC Campus Navigation — Learn It, Explain It

Goal: you should be able to answer **"How does this work?"** about any part of the system without opening the code or asking anyone.

Every section follows the same order:
1. What and why
2. Simple explanation
3. Technical explanation
4. Data flow
5. Files
6. MRTC example (real numbers from our data)
7. Failure cases
8. Viva questions

The model answers are folded away. **Answer out loud first, then open them.**

> Every number in this guide comes from the real campus graph and the test suite (`npm test`). If the data changes, re-run the tests and update the numbers.

---

## 0. The whole system on one page

```text
Google Maps measurements + your campus facts
        ↓
campusMeasurements.json                 (DATA: nodes, edges, metres, accessibility)
        ↓
buildCampusGraph()  →  Graph            (DATA STRUCTURE: weighted adjacency list)
        ↓
edgeFilterFor(mode)                     (ACCESSIBILITY: which edges are allowed)
        ↓
dijkstra()  +  MinHeap                  (ALGORITHM: shortest path)
        ↓
path [block-a, block-b, block-c, canteen], 174.83 m
        ↓
├── 3D renderer      (draws it — knows nothing about Dijkstra)
├── instructions     ("In 55 metres, turn left at …")
├── voice            (reads it aloud)
└── navigation session (LIVE GPS or SIMULATION moving along it)
```

**The one sentence to remember:** *the algorithm decides the route; everything else only displays it or feeds it input.*

Campus graph today: **V = 18 nodes** (6 core places, 9 sports/parking places, 3 road junctions) and **E = 20 measured connections**.

---

## 1. Graph fundamentals

### Simple explanation

A graph is just **places + connections**.

| Graph word | In our project | Example |
|---|---|---|
| Node (vertex) | a place you can stand | Block A's entrance |
| Edge | a path you can actually walk | the forecourt between A and B |
| Weight | how long that path is | 36.67 m |

### Directed vs undirected

On a one-way street, A→B doesn't mean B→A, so the graph is **directed**. Campus footpaths work both ways, so ours is **undirected**: `Graph.addEdge` stores each connection twice, once in each direction.

### Weighted vs unweighted

If every connection had the same cost we could just count hops. Ours range from **9.38 m** (junction → Girls Hostel door) to **96.73 m** (A → C along the forecourt), so the weights matter.

### Adjacency matrix vs adjacency list

- **Matrix:** an 18 × 18 table with 324 cells. We have 20 connections (40 directed entries), so about 88% of the cells would be empty. Checking "is A connected to B" is O(1), but listing A's neighbours means scanning a whole row.
- **List (what we use):** each node keeps only its real neighbours.

```text
block-a → block-b (36.67), block-c (96.73), basketball-court (57.26), bike-parking (31.79)
```

Dijkstra constantly asks "who are this node's neighbours?". A list answers that in O(degree), and it stores only O(V + E) data.

### Why a campus is naturally a graph

People can't walk through buildings. They move along paths that meet at entrances and junctions, and a graph models exactly that.

<details><summary>Viva — 5 questions</summary>

1. **What is a vertex and an edge in your project?**
   A vertex is a place you can stand: a building entrance, a facility gate or a road junction. An edge is a path you can actually walk between two of them, and its weight is the measured walking distance in metres.
2. **Directed or undirected? Why?**
   Undirected, because campus footpaths can be walked both ways. `addEdge` stores both directions. A one-way rule, such as an exit-only gate, would need a directed edge.
3. **Why an adjacency list and not a matrix?**
   The graph is sparse: 20 edges among 18 nodes. A list stores O(V + E) instead of O(V²), and gives each node's neighbours in O(degree), which is the operation Dijkstra repeats.
4. **Why add junction nodes like `jn-lane-north`?**
   Paths join at intersections. Without junctions we'd need fake direct edges such as Girls Hostel ↔ Boys Hostel, which doesn't exist as a single path.
5. **What is a weight here, and can it be negative?**
   Metres walked. It can never be negative, and the code rejects weights ≤ 0. Dijkstra relies on non-negative weights.
</details>

---

## 2. The graph data structure

```text
FILE:      src/graph/Graph.ts
PURPOSE:   Undirected weighted graph as an adjacency list.
INPUT:     addNode(node), addEdge(edge), addDisabledEdge(edge)
PROCESS:   nodes: Map<id, node>; adjacency: Map<id, Edge[]> — every edge stored in both directions.
OUTPUT:    neighbours(id), edge(a, b), allNodes(), allEdges(), disabled[]
STRUCTURES: Map (hash map), arrays
WHY:       O(1) node lookup by id; O(degree) neighbour listing.
FAILURE CASES (all throw immediately, never silently):
  • unknown node id
  • weight ≤ 0
  • duplicate edge between the same pair (a route is a list of nodes,
    so two parallel edges would be ambiguous — model stairs vs lift as separate nodes)
```

```text
FILE:      src/data/campusGraph.ts
PURPOSE:   Turns campusMeasurements.json into a Graph.
PROCESS:   locations → nodes (with the user-verified accessibleEntrance);
           connections with a distance → edges;
           connections with distanceMeters: null → graph.disabled ("Measurement required").
WHY:       Data lives in JSON so measurements can change without touching algorithm code.
```

**Two separate datasets** (spec §4):
- **Navigation:** `campusMeasurements.json` holds where things are, how they connect, and how far apart they are.
- **3D:** `campusModels.ts` holds what things look like (sizes, floors, colours).

Both use the same id (`block-a`), so changing a building's colour can never change a route.

---

## 3. Real distances, and being honest about them

Each distance was measured with **Google Maps' "Measure distance" tool**, clicking along the visible walkway rather than in a straight line. Where possible we cross-checked with Google's walking directions.

| Status | Meaning | Where you see it |
|---|---|---|
| **VERIFIED** | Checked on the ground | none yet |
| **ESTIMATED · map-measured** | Measured on satellite imagery, not walked | all 20 edges (Data panel) |
| **UNKNOWN** | Not measured → edge disabled | indoor connections, all accessibility fields |
| **SIMULATED** | Virtual position, not GPS | the 🟠 SIMULATION banner |

**Why straight-line distance is wrong:** Girls Hostel → Boys Hostel is 184 m in a straight line, but **234.23 m** along the real paths (road → lane → past the badminton court → box cricket). The straight line goes through buildings.

**Why Google's walking directions weren't used directly:** for that same trip Google says **550 m**, because its road map doesn't include the lane beside the courts. We measured the path that's actually visible.

<details><summary>Viva</summary>

1. **Where do your distances come from?**
   Google Maps' Measure tool, traced along visible walkways. We cross-checked against Google walking directions where they existed. They're labelled "map-measured, not ground-verified".
2. **What happens if a distance is missing?**
   The connection becomes a *disabled* edge with `distanceMeters: null`. Dijkstra never sees it and the UI says "Measurement required". We never put a guessed number in its place.
3. **How accurate are they?**
   They're limited by the imagery resolution (about 0.15–0.6 m per screen pixel at the zoom levels we used) and by how precisely the path was traced. Each edge has a confidence label. A repeat reading of A↔B gave 36.67 m vs 36.98 m.
4. **Why not use straight-line (haversine) distance?**
   You can't walk through buildings. Girls → Boys Hostel is 184 m straight but 234 m along the paths.
5. **How would you improve the data?**
   Walk each edge with a measuring wheel or GPS logger, then set `verified: true` and `source: campus-physical-measurement`. No code changes are needed.
</details>

---

## 4. Dijkstra

### What problem it solves

Given a start node, find the **minimum total weight** path to the destination. It works on any graph whose weights are **non-negative**.

### Layman's version (standing at Block A)

> Write "0 m" next to Block A and "∞" next to everything else.
> Repeatedly: **pick the place with the smallest number that you haven't finished yet**. That number is now final: no other route can beat it, because every other route has already used up more metres.
> From there, look at each neighbour. If going *through here* is shorter than the neighbour's current number, **cross it out and write the smaller one**. That step is called *relaxation*.
> Stop when the destination gets finalised.

### Pseudocode → our code (`src/algorithms/dijkstra.ts`)

```text
dist[all] = ∞ ; dist[source] = 0           ← `for (const n of graph.allNodes()) dist.set(n.id, Infinity)`
heap.push(source, 0)
while heap not empty:
    (u, d) = heap.pop()                     ← smallest tentative distance
    if u already visited or d is stale: skip    ← lazy deletion (see below)
    mark u visited                          ← dist[u] is now FINAL
    if u is a target: stop                  ← early exit
    for each edge u→v:
        if edgeFilter rejects it: skip      ← accessibility (section 6)
        if dist[u] + w < dist[v]:            ← RELAXATION
            dist[v] = dist[u] + w
            prev[v] = u                     ← remember where we came from
            heap.push(v, dist[v])
rebuild path by following prev[] back from the target
```

### Key terms

- **Tentative distance:** the best route known *so far*, which may still improve.
- **Finalised distance:** the node has been popped from the heap, so its distance can't improve any more.
- **Relaxation:** "is going through `u` shorter?" If yes, update the distance and the parent.
- **`prev` (parent) map:** for each node, where its best route came from. This is what makes route reconstruction possible (section 5).

### The priority queue and min-heap (`src/algorithms/MinHeap.ts`)

Dijkstra keeps asking: *which unfinished node is closest?*
- With a plain list you'd scan every node each time, which is O(V) per pop.
- A **binary min-heap** is a tree stored in an array, where every parent is ≤ its children, so the smallest item is always at index 0.
  - `push` adds the item at the end and **sifts it up**, swapping with its parent while it's smaller. That's O(log n) steps because the tree is about log₂ n levels tall.
  - `pop` takes index 0, moves the last item to the top and **sifts it down**, swapping with its smaller child. Also O(log n).

### Lazy deletion

When a node gets a shorter distance we don't search the heap to update its old entry. We just push a new entry. The old one is popped later and ignored (`d > dist.get(u)`). In the MRTC log you can see `(stale heap entry for Car Parking ignored)`.

### Complexity of *this* implementation

- **Pushes:** at most one per successful relaxation. That's ≤ 2E + 1, because each undirected edge appears twice in the adjacency list.
- **Pops:** at most the number of pushes.
- **Cost of each heap operation:** O(log(heap size)) = O(log E) = O(log V), since E ≤ V².
- **Each node's neighbour list is scanned once,** when the node is finalised, which is O(V + E) in total.

That gives **time O((V + E) log V)** and **space O(V + E)**. The logarithm comes entirely from the heap.

> **Honest footnote:** with `trace: true` (used for the Algorithm panel) every step also copies the distance table, which costs O(V) per step. The core algorithm (`trace: false`, used by Yen's alternatives and the baselines) is the O((V + E) log V) version. On 18 nodes either is instant.

### MRTC example: Block A → Canteen (real debug log, abridged)

```text
Current node: Block A  (finalised at 0.00 m)
  Relax Block A → Block B: ∞ → 36.67 m  ✓
  Relax Block A → Block C: ∞ → 96.73 m  ✓
  Relax Block A → Basketball Court: ∞ → 57.26 m  ✓
  Relax Block A → Bike Parking: ∞ → 31.79 m  ✓
Current node: Bike Parking  (finalised at 31.79 m)     ← closest, even though it's the "wrong way"
Current node: Block B  (finalised at 36.67 m)
  Relax Block B → Block C: 96.73 m → 90.05 m  ✓       ← a better route to C was found
  …
Current node: Block C  (finalised at 90.05 m)
  Relax Block C → Canteen: ∞ → 174.83 m  ✓
  …
Current node: Canteen  (finalised at 174.83 m)
Route: Block A → Block B → Block C → Canteen   Total 174.83 m   (16 of 18 nodes finalised)
```

Two things to point out to a judge:
1. **Block C first got 96.73 m** (the direct forecourt path) and was later **relaxed to 90.05 m** via Block B. That's relaxation working.
2. **Bike Parking was explored first** because it was closest. Dijkstra explores in order of distance, not direction. A* (section 7) is the variant that adds a sense of direction.

See it live: **Algorithm panel → Play**, then **Debug log**.

### Failure cases

| Situation | What happens |
|---|---|
| Destination unreachable | `path: []`, `distance: Infinity`, and the UI says no route exists |
| Unknown node id | Throws `Unknown source/target`, so it can never return a wrong answer silently |
| Negative weight | Rejected when the graph is built (Dijkstra would be wrong) |
| Equal-cost routes | Returns one of them, with the correct distance (tested) |
| Start = destination | `[start]`, 0 m |

<details><summary>Viva — 5 questions</summary>

1. **Why Dijkstra?**
   The campus is a weighted graph with non-negative weights (metres), and we need the minimum total distance between two places. That is exactly the problem Dijkstra solves, and it's efficient on sparse graphs with a heap.
2. **What is relaxation?**
   For an edge u→v of weight w: if `dist[u] + w < dist[v]`, set `dist[v] = dist[u] + w` and `prev[v] = u`. It's the "is going through u shorter?" check. Example: Block C went from 96.73 m to 90.05 m via Block B.
3. **Why is a popped node's distance final?**
   It had the smallest tentative distance in the queue. Any other route to it would have to pass through some unfinished node that is already at least that far away, and since weights can't be negative the route can only get longer. This is why negative weights break Dijkstra.
4. **Where does the log V come from?**
   Every push and pop on the binary heap costs O(log n), because the heap is a balanced tree about log₂ n levels tall and sift-up/sift-down walk one path through it. There are O(V + E) such operations.
5. **What is lazy deletion and why use it?**
   Instead of finding and updating a node's old heap entry when its distance improves, we push a new entry and skip the old one when it's popped. It keeps the heap simple, and the extra entries are bounded by E, so the complexity stays the same.
</details>

---

## 5. Route reconstruction

Dijkstra itself only fills in `dist` and `prev`. The route comes from walking `prev` backwards from the destination:

```text
prev[canteen] = block-c
prev[block-c] = block-b
prev[block-b] = block-a
→ canteen ← block-c ← block-b ← block-a
→ reverse →  block-a → block-b → block-c → canteen
```

Code: the last few lines of `dijkstra()` (`for (let at = reached; at !== undefined; at = prev.get(at)) path.unshift(at)`).

**Then the 3D route is drawn.** `buildRouteGeometry` (`src/navigation/routeGeometry.ts`) replaces each pair of consecutive nodes with that edge's stored **walkway polyline**, the shape we clicked on the map. So the line on screen follows the real path, not a straight segment.

<details><summary>Viva</summary>

1. **Dijkstra gives a distance; how do you get the actual route?**
   From the `prev` (parent) map: start at the destination, follow `prev` back to the start, then reverse.
2. **Why store `prev` instead of whole paths?**
   One pointer per node is O(V) memory. Storing full paths would copy lists on every relaxation.
3. **How does the drawn route follow the curve of the road?**
   Each edge stores the polyline it was measured along, and the renderer concatenates those polylines.
4. **What if `prev` is missing for the destination?**
   Then it was never reached: the path is empty and the distance is infinite.
5. **How do you show alternative routes?**
   Yen's algorithm (`alternativeRoutes.ts`). It runs Dijkstra again with parts of the previous best routes temporarily removed, and only lists routes that really exist.
</details>

---

## 6. Accessibility as a graph constraint

```text
Normal:        Graph → Dijkstra → shortest route
Accessible:    Graph → edgeFilter(mode) → eligible edges → Dijkstra → shortest ACCESSIBLE route
```

```text
FILE:      src/algorithms/accessibility.ts
IMPORTANT FUNCTIONS:
  edgeFilterFor(mode)       → function(edge) ⇒ null (allowed) | reason ("stairs", "closed", …)
  destinationNodes(g, place, mode) → which entrance(s) a route may end at
  entranceBlocker(...)      → explanation when no allowed entrance exists
  evaluateRoute(...)        → ✓ checks / ⚠ warnings built ONLY from recorded data
```

The filter runs **inside Dijkstra**, before relaxation. A rejected edge is never relaxed, so for routing purposes it doesn't exist. Every rejection is recorded as a `reject` step that the Algorithm panel can show.

### Worked example (guide §23, a real test)

The edges are A–B = 100 m (stairs), A–C = 60 m and C–B = 80 m.
- **Normal mode:** the route is A → B, 100 m.
- **Wheelchair mode:** A → B is rejected for `stairs`, so the route is A → C → B, 140 m.

**The accessible route can be longer, and that's the point.**

### Unknown ≠ accessible

Every outdoor edge's accessibility is **UNKNOWN**, because satellite imagery can't show kerbs or steps. So:
- Unknown edges are still *allowed*: rejecting them would leave no routes at all.
- The route is always labelled **"accessibility unverified (N of N segments)"**.
- It is never presented as "accessible".

### Entrances (user-verified facts)

- **Block A and Block B fronts:** wheelchair accessible. A wheelchair route to B shows "✓ Accessible entrance at destination (user-verified)".
- **Block C front:** *not* accessible, and no other entrance is known. A wheelchair route to Block C therefore says so explicitly and **does not quietly substitute a normal route** (spec §40.6).

<details><summary>Viva</summary>

1. **Is accessibility just a UI icon?**
   No. It changes which edges Dijkstra may relax, so it changes the actual route.
2. **Why can the wheelchair route be longer?**
   The shortest path may include stairs. Removing those edges leaves a smaller graph, whose shortest path can only be the same length or longer.
3. **What do you do with unknown accessibility?**
   Allow it, but label the route "unverified" and count the unknown segments. We never convert unknown into accessible.
4. **What happens for a wheelchair route to Block C?**
   Its front entrance is recorded as not accessible and no other entrance is known, so the app reports that no verified accessible route exists instead of showing a standard route.
5. **How would a closed ramp be handled?**
   Set `"closed": true` on that edge. The filter rejects closed edges in every mode and the route is recalculated. This is tested ("ramp closed", "lift unavailable").
</details>

---

## 7. Why not BFS, DFS, Greedy or A*? (with real campus numbers)

These baselines are implemented in `src/algorithms/baselines.ts` purely so we can **show** the difference. Open the Algorithm panel's **Compare** box for any route.

| Approach | What it optimises | MRTC result (tested) |
|---|---|---|
| **Dijkstra** | total metres | always optimal |
| **BFS** | number of edges | **A → C:** BFS takes the 1-edge forecourt path (**96.73 m**); Dijkstra goes A → B → C (**90.05 m**, 2 edges). BFS is longer for **70 of 210** place pairs. |
| **Greedy** (take the shortest next edge) | the next step only | **A → Canteen:** first step Bike Parking (31.79 m, the shortest), then it wanders to the Football Court and gets **stuck at a dead end**. Wrong or stuck for **173 of 210** pairs. |
| **DFS** | nothing about distance | finds *a* path, not the shortest. Not implemented: it isn't a shortest-path method. |
| **A\*** | metres travelled + an estimate of metres left | would also be optimal with an admissible heuristic (e.g. straight-line distance), exploring fewer nodes. Dijkstra is A* with the estimate set to 0. We use Dijkstra because it's the required algorithm and the graph is tiny. |

**The subtle point judges like:** textbooks *do* classify Dijkstra as a **greedy algorithm**, because it greedily finalises the closest unfinished node. The difference from the naive greedy walker:
- **Dijkstra's greedy choice is global:** the closest of *all* frontier nodes. It is provably safe with non-negative weights.
- **The naive walker's choice is local:** the shortest edge *from where I stand*. It can't undo a bad step.

<details><summary>Viva</summary>

1. **Why not BFS?**
   BFS minimises the number of edges, which is only right when all edges cost the same. Ours don't: A → C directly is 96.73 m, but via B it's 90.05 m.
2. **Why not just always take the shortest road at each junction?**
   That's local greedy, and it can lead into a dead end. On our campus, A → Canteen gets stuck at the Football Court.
3. **Is Dijkstra greedy?**
   Yes, in the textbook sense: it greedily finalises the globally closest frontier node, and that choice is proven safe for non-negative weights. That's different from a naive local greedy walk.
4. **Why not A*?**
   A* is also optimal with an admissible heuristic and can explore fewer nodes. But Dijkstra is the required algorithm, A* is just Dijkstra with a heuristic added, and on 18 nodes the speed difference is negligible.
5. **Why not DFS?**
   DFS explores one branch deeply and returns the first path found, with no guarantee about length.
</details>

---

## 8. Live GPS (Browser Geolocation API)

### What the browser actually does

`navigator.geolocation.watchPosition(onFix, onError, options)` asks the operating system for location. The OS combines GPS satellites, Wi-Fi and cell towers. The browser **calls `onFix` whenever a new position is available**: there's no fixed rate, often about once a second while moving.
- **Permission:** it only works on HTTPS or localhost, and the user must click Allow.
- **Denied:** `onError` is called with code 1 (`PERMISSION_DENIED`).
- **Other errors:** code 2 is position unavailable and code 3 is timeout.
- **Options we pass:** `enableHighAccuracy: true` (prefer GPS), `maximumAge: 1000` (accept a reading up to 1 s old) and `timeout: 20000`.

### What each fix contains

| Field | Meaning | Note |
|---|---|---|
| `latitude`, `longitude` | position | |
| `accuracy` | radius in metres around that point | The spec doesn't fix a confidence level (MDN says 95%, Android reports 68%). Treat it as approximate. |
| `heading` | direction of travel in degrees from north | null when standing still |
| `speed` | metres per second | can be null |
| `timestamp` | when the fix was taken | |

### Our pipeline (`src/navigation/session/locationFilter.ts`)

1. **Accuracy check:** a fix worse than **±35 m** is shown as a warning ("Move to an open area…") and *not* used.
2. **Outlier check:** a jump implying more than **7 m/s**, after subtracting both fixes' accuracy, is ignored as a GPS glitch.
3. **Off campus:** more than **400 m** from the route gets a warning and no rerouting. Desktop testing usually hits this.

**Never claimed:** room-level or centimetre accuracy. GPS drifts near buildings and trees and is poor indoors.

---

## 9. Map matching

**Simple:** GPS says you're 4 m off the walkway. You're obviously *on* the walkway, so snap the dot to it.

**Technical** (`matchToRoute` in `routeProgress.ts`): for every segment AB of the route polyline, project the point P onto it:

```text
t = clamp( ((P − A) · (B − A)) / |B − A|² , 0, 1 )
closest point = A + t (B − A)
offset = |P − closest|
```

We keep the segment with the smallest offset. That gives **how far along the route you are**, and **how far off it you are**. Progress is converted to *measured* metres segment by segment (`measuredAlong`), so "remaining distance" agrees with the Google Maps numbers.

The **raw fix** (blue hollow dot with an accuracy circle) is drawn separately from the **smoothed marker**, so the display never hides the real GPS uncertainty.

---

## 10. Off-route detection and rerouting

```text
offset > max(20 m, 1.5 × accuracy)   on 2 fixes in a row      (isOffRoute)
        ↓
"You have left the planned route. Recalculating."
        ↓
nearestNode(position)  → e.g. canteen
        ↓
Dijkstra(canteen → destination, SAME accessibility mode)
        ↓
new route; the marker eases onto it (no teleport)
```

Why both thresholds?
- **The 1.5 × accuracy band:** with ±25 m GPS, being 30 m off is just noise.
- **Two fixes in a row:** a single bad reading shouldn't trigger a reroute.

The test: a user heading A → Box Cricket wanders to the Central Kitchen, gets matched to `canteen`, and is rerouted from there.

<details><summary>Viva (sections 8–10)</summary>

1. **What does GPS `accuracy` mean?**
   An estimated radius in metres around the reported point. It's approximate, and the confidence level depends on the platform.
2. **What is map matching?**
   Snapping a noisy GPS point to the most likely place on our walkway network: the nearest point on the route polyline, found by projecting onto each segment.
3. **How do you decide the user left the route?**
   The offset is more than max(20 m, 1.5 × accuracy) for two consecutive accepted fixes.
4. **What does rerouting do algorithmically?**
   It finds the nearest graph node to the user and runs Dijkstra again from there, keeping the same accessibility filter.
5. **How do you decide the user arrived?**
   By position, not animation: within 10 m of the destination node with accuracy of ±25 m or better. If the accuracy is too poor, the app says arrival can't be confirmed.
</details>

---

## 11. Simulation and ETA

```text
ETA ≈ remaining distance ÷ walking speed            (default 1.4 m/s ≈ 5 km/h, changeable in ♿ settings)
A → Canteen: 174.83 m ÷ 1.4 m/s ≈ 125 s ≈ 2 min
```

- **🟠 SIMULATION** moves a virtual walker along the *calculated route*. Each frame it does `travelled += walkingSpeed × simSpeed × Δt`. At **1×** that takes real walking time; 2×, 5× and 10× are demo speeds, and the banner always shows the multiplier and "not your real location".
- Arrival in simulation is also checked against the destination node's position, not "the animation ended".
- **The ETA is an estimate.** Crowds, stops, slopes and individual walking speed all change it, which is why the UI writes "~2 min est.".

---

## 12. 3D visualisation (separate from the algorithm)

| Library | What it actually does |
|---|---|
| **three.js** | Draws 3D with WebGL on the GPU. A *mesh* is geometry (the shape) plus a material (its colour or texture). A *camera* decides what's visible. |
| **React Three Fiber (R3F)** | Lets us write three.js objects as React components (`<mesh>`). `useFrame` runs code every animation frame, about 60 times a second. |
| **drei** | Helpers for three.js: `OrbitControls` (drag to orbit, zoom and pan) and `Line` (thick lines). |

- **Globe:** a sphere textured with Natural Earth country shapes (public domain) drawn onto a canvas. The camera turns toward India, then dives using a *logarithmic* altitude curve, so each second covers the same zoom ratio and the dive looks like constant speed. The globe flight ends straight down at 2.6 km, exactly where the 3D campus camera starts, which is why the crossfade has no jump.
- **Campus:** building boxes with drawn facades and courts from `campusModels.ts`. The labels are normal HTML, placed each frame by projecting 3D points to the screen (`ScreenProjector`).
- **Route:** the walkway polylines from section 5. During navigation the walked part fades and the remaining part stays bright.

**Key point:** delete the whole 3D layer and Dijkstra still returns the same path. The renderer only draws `path`.

---

## 13. Voice

```text
microphone → SpeechRecognition (browser) → text → parseCommand() → intent → navigation engine → route
route/instruction → SpeechSynthesis (browser) → audio
```

- **SpeechRecognition (Web Speech API):** turns audio into text. In Chrome the audio is typically sent to a server for recognition, so it usually needs internet. That's a privacy point worth knowing. Firefox doesn't support it, so we always offer a **typed command box** too.
- **`parseCommand`** (`src/voice/intents.ts`) is ours: text → explicit intents.
  - It matches place aliases, and **the longest match wins**.
  - **Ties become a question:** "take me to the hostel" → "Which one did you mean? Girls Hostel / Boys Hostel".
  - **Room numbers like "C-204" are recognised but not resolved,** because no real room numbers have been supplied.
- **SpeechSynthesis:** reads text aloud using voices on the device. Read Aloud is generated from the route (destination, distance, ETA, sequence, accessibility warnings). Nothing is hard-coded.

**Voice never computes routes.** It's just another way to fill in From, To and Mode.

<details><summary>Viva</summary>

1. **Does the voice system find the shortest path?**
   No. It turns speech into an intent (navigate / mode / pause …). Dijkstra still computes the route.
2. **How do you avoid going to the wrong place?**
   The longest alias match wins, and ties produce a clarification question. Unknown speech returns "didn't recognise", never a guess.
3. **What if the browser has no speech recognition?**
   The typed command box uses the same parser. Voice is optional everywhere.
4. **Where does Read Aloud's text come from?**
   It's built from the selected route's nodes and edges plus the accessibility assessment (`routeSummaryText`).
5. **Privacy concern?**
   Chrome's recognition typically sends audio to a server. Speech synthesis usually runs with voices installed on the device.
</details>

---

## 14. The other paradigms (honest mapping)

Don't claim Dijkstra is all of these. Here's what's actually in the project:

| Paradigm | In this project? | Where / how to explain it |
|---|---|---|
| **Graph** | ✅ core | the campus graph and Dijkstra |
| **Greedy** | ✅ two ways | Dijkstra's safe greedy choice (global minimum), and the naive greedy baseline (`greedyRoute`) that fails 173 of 210 times |
| **Dynamic Programming** | ✅ in tests | `dijkstra.test.ts` checks Dijkstra against **Floyd–Warshall**, a textbook DP algorithm: `d[i][j] = min(d[i][j], d[i][k] + d[k][j])` stores and reuses solutions to subproblems ("shortest path using only intermediate nodes 0..k") |
| **Divide & Conquer** | ❌ not used | A possible use: split a large campus into zones, route within zones and connect them through gateway nodes. Not needed for 18 nodes. |
| **Backtracking** | ❌ not used | Could enumerate every simple path (try a step, recurse, undo), which is exponential. Useful for constraint puzzles, not for shortest paths. |
| **Branch & Bound** | ❌ not used | Could explore paths and prune any branch whose length already exceeds the best complete route. A* is related in spirit. Yen's alternatives are *not* branch & bound: they repeat Dijkstra on modified graphs. |

---

## 15. Tests (what each one proves)

Run `npm test`: 71 tests in 7 files.

| File | Proves |
|---|---|
| `dijkstra.test.ts` | heap order; spec example; unreachable; start = end; symmetry; **30 random graphs vs Floyd–Warshall**; campus routes; disabled edges never used; no Girls↔Boys Hostel shortcut |
| `learningGuide.test.ts` | the guide's §44, §12 and §23 examples; invalid node; equal-cost tie; negative weight rejected; BFS and greedy vs Dijkstra on all 210 campus pairs; debug log content |
| `accessibility.test.ts` | the six §34.12 cases (shortest, wheelchair, lift down, ramp closed, no route, accessible entrance); Block C blocked; A/B verified |
| `indoorGraph.test.ts` | 2 west + 3 east rooms + HOD/Staff; no invented room numbers; indoor unreachable until measured; stairs are vertical edges |
| `routeProgress.test.ts` | measured progress matches Dijkstra's total; map matching; instructions; nearest node |
| `locationFilter.test.ts` | low accuracy rejected; outlier rejected; off-route thresholds; reroute from the canteen |
| `intents.test.ts` | voice phrases → intents; ambiguity → clarify; rooms not guessed |

---

## 16. Debug mode

**Algorithm panel → Debug log** prints the real run: every node finalised, every relaxation (✓ shorter / kept), every rejected edge with its reason, the stale heap entries, the route and the total. **Copy** puts it on the clipboard for your report.

---

## 17. Limitations (say these before a judge finds them)

1. Distances are **map-measured**, not walked. Confidence ranges from high to low per edge.
2. All **accessibility** data is unsurveyed, except the three entrance facts you supplied.
3. **Indoor** routing is modelled but disabled: no room numbers, door or stair positions, lifts or distances yet.
4. **Court/parking outlines** and **building sizes** are approximate (the Google imagery predates the courts).
5. **Live GPS** is phone-grade (several metres), so it can't do room-level positioning.
6. **"Fastest" = "Shortest"** until per-path speed data exists.

---

## Practise

Pick a section, have a teammate read its five viva questions to you, and answer out loud. Then compare with the model answer and mark yourself CORRECT / PARTIALLY CORRECT / INCORRECT, noting what was missing.
