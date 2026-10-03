# MRTC 3D Campus Navigation

Shortest-path navigation across **Malla Reddy Vishwavidyapeeth – Technical Campus** (Maisammaguda, Hyderabad), shown as a globe-to-campus 3D experience.

The 3D scene is only the presentation layer. Every route on screen comes from **Dijkstra's algorithm** running on a weighted graph of walking distances measured on Google Maps. No route is hard-coded.

```
Google Maps measurements → campusMeasurements.json → weighted graph → Dijkstra → route → 3D route + directions
```

> 📘 **Learning guide:** [`docs/LEARN.md`](docs/LEARN.md) explains every module (graph, Dijkstra, accessibility, GPS, map matching, rerouting, 3D, voice, simulation) using real MRTC numbers, with viva questions and model answers.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # algorithm + data tests (Vitest)
npm run build
```

## Problem statement

Find the shortest walking route between campus locations whose walkways have different lengths.

| | |
|---|---|
| **Paradigm** | Graph |
| **Algorithm** | Dijkstra's shortest path (from scratch, `src/algorithms/dijkstra.ts`) |
| **Alternatives** | Yen's k-shortest loopless paths on top of Dijkstra (`alternativeRoutes.ts`). It only lists routes that actually exist in the graph. |
| **Graph model** | vertex = building entrance · edge = walkable path · weight = path length in metres |

### Data structures

- Weighted **adjacency list** (`Map<id, Edge[]>`), with each undirected edge stored in both directions
- **Binary min-heap** priority queue with lazy deletion (`MinHeap.ts`)
- **Distance map**, **previous-node map** and **visited set**
- A recorded **step trace** (init / visit / relax / done) that drives the in-app Algorithm panel

### Complexity (this implementation)

- **Time:** O((V + E) log V). Each vertex is settled once, and each edge relaxation does at most one O(log V) heap push.
- **Space:** O(V + E)

**Comparison.** A brute-force search over all simple paths is exponential in the worst case. Floyd–Warshall is O(V³) but gives every pair at once. The tests use it as a correctness oracle on random graphs. For a single source and target on a sparse campus graph (E ≈ V), Dijkstra with a heap is the right fit. For a graph of 6 nodes, any of these is instant. The choice starts to matter as indoor nodes (rooms, corridors, stairs) are added.

## Campus data

All distances are **Google Maps "Measure distance" readings** taken along the walkable path (not straight-line), on 2026-10-03. They are **not yet ground-verified** (`verified: false`). Each edge in `src/data/campusMeasurements.json` records its source, confidence, path polyline, notes and a Google walking-directions cross-check where one was available.

| Edge | Distance | Confidence | Cross-check |
|---|---|---|---|
| Block A ↔ Block B | 36.67 m | high | repeat reading 36.98 m |
| Block B ↔ Block C | 53.38 m | medium | directions 46 m |
| Block A ↔ Block C (front forecourt) | 96.73 m | medium | — |
| Block C ↔ Canteen (Central Kitchen) | 84.78 m | high | — |
| Block A ↔ Basketball Court ↔ hostel-road junction ↔ Girls Hostel | 57.26 + 10.08 + 9.38 m | medium | total 76.72 m (earlier single reading 76.73 m; directions 71 m) |
| Hostel-road junction ↔ lane junction (N) | 64.29 m | medium | — |
| Lane junction (N) ↔ Badminton Court ↔ lane junction (S) | 17.52 + 17.30 m | medium | — |
| Lane junction (S) ↔ Box Cricket ↔ NIAT Boys Hostel | 61.95 + 63.79 m | medium | Girls → Boys Hostel 234.23 m (earlier 234.21 m; directions 550 m — Google's road data detours) |
| Block C ↔ Running Track ↔ Football Court | 52.88 + 11.33 m | medium | — |
| Block A ↔ Bike Parking · Block B ↔ Car Parking | 31.79 m · 28.44 m | medium | — |
| Bike Parking ↔ Car Parking | 35.97 m | medium | — |
| Bike Parking ↔ Volleyball · Car Parking ↔ Kabaddi · Volleyball ↔ Kabaddi | 15.30 · 12.47 · 37.66 m | medium | — |

**Road network (spec §52).** There is no direct Girls Hostel ↔ Boys Hostel edge. The route follows real segments joined at junction nodes (`jn-hostel-road`, `jn-lane-north`, `jn-lane-south`). Junctions are routing-only: they never appear as destinations or labels.

**Sports and parking (spec §52–53).** Every facility is a navigation destination. Their placement follows the user's layout and satellite imagery:
- **Football ground:** in front of Block C, with a running track around it. The outline (~126 × 118 m) is from satellite imagery; photo 3 shows the turf.
- **Bike parking:** in front of Block A.
- **Car parking:** in front of Block B.
- **Volleyball and kabaddi:** south of the parking. *Volleyball is on the west half and kabaddi on the east half. This order is an assumption to confirm.*
- **Box cricket:** the dark-green court in front of NIAT Boys Hostel.
- **Badminton and basketball:** the bare ground east of the box cricket, behind the Girls Hostel. *Badminton is on the west half (nearest the box cricket) and basketball on the east half (nearest volleyball and kabaddi).*

Court markings use standard dimensions. Parked vehicles are decorative.

**Entrance accessibility (spec §40.1).** This comes from the user and is stored as data:
- Block A front: wheelchair accessible.
- Block B front: wheelchair accessible.
- Block C front: **not** wheelchair accessible.

A wheelchair or step-free route to Block C reports that no verified accessible entrance exists, instead of substituting a normal route (§40.6).

Building identities were confirmed by the user. Blocks A and B are the joined twin block, Block C is the separate block east of it, the Canteen is the green-roof Central Kitchen beside Block C, the Girls Hostel is west of Block A, and the Boys Hostel is NIAT Boys Hostel.

Example: **Block A → Canteen = A → B → C → Canteen = 174.83 m**.

### Adding or correcting measurements

Edit `src/data/campusMeasurements.json`. You don't need to touch any algorithm code.

```json
{ "from": "block-b", "to": "canteen", "distanceMeters": null, "source": "user-provided",
  "verified": false, "walkable": true, "path": [[lat, lng], [lat, lng]] }
```

- `distanceMeters: null` means the connection is kept but **disabled** and shown as "Measurement required". It is never used for routing, and no distance is ever invented.
- After a physical check, set `"verified": true` and `"source": "campus-physical-measurement"`.

### Two separate datasets

- **Navigation:** `campusMeasurements.json` → `campusGraph.ts` (nodes, edges, distances)
- **3D visualization:** `campusModels.ts` (footprints, floors, rotation, all **approximate**, read off satellite imagery and the reference photos)

Both are linked by `id` (`block-a`, `canteen`, …).

## Accessibility-first routing (spec §34)

```
Normal routing:         Weighted graph → Dijkstra → shortest route
Accessibility routing:  Weighted graph → accessibility constraints → eligible edges → Dijkstra → shortest accessible route
```

Accessibility is a **graph constraint**, not just a UI layer. Before relaxing an edge, Dijkstra calls an `edgeFilter` (`src/algorithms/accessibility.ts`). Every rejected edge shows up as a `reject` step in the Algorithm panel.

| Route preference | Edge is excluded when… |
|---|---|
| Shortest | it is closed |
| Fastest | it is closed. This currently equals Shortest, because time uses one assumed walking speed for every path. |
| Avoid stairs | it is closed, or `stairs: true` |
| Step-free | it is closed, or `stairs: true`, or `stepFree: false` |
| Wheelchair | it is closed, or `stairs: true`, `stepFree: false`, or `accessible: false` |

- **Unknown is never treated as accessible.** Each edge's accessibility fields are `null` (not surveyed) until someone checks them on campus, because satellite imagery can't show steps, kerbs, ramps or slopes. Unknown edges stay routable, but in a constrained mode the route is labelled **"accessibility unverified"**, with a count of the unverified segments.
- **Checks and warnings come only from recorded data:** ✓ step-free, ✓ ramp, ✓ lift; ⚠ stairs ahead, steep slope, uneven surface, narrow passage, obstacle, and "verify lift availability".
- **Multiple entrances (§34.7).** Add entrance nodes with `kind: "entrance"`, `building`, and `accessibleEntrance`. Wheelchair and step-free modes route only to entrances that aren't recorded as inaccessible, preferring verified accessible ones.
- **Temporary obstacles (§34.10).** Set `"closed": true, "closedReason": "Ramp closed"` on a connection. It is excluded in every mode and the route is recalculated.
- **Viewer settings (♿ button, on every screen):** Reduce motion (shortens the globe flight and camera moves; follows the device setting by default), High contrast, Larger text. All controls work by keyboard, with visible focus, and icons always come with text.

Tests (`accessibility.test.ts`) cover the six §34.12 cases: normal shortest route; wheelchair avoids stairs; lift unavailable; ramp closed; no accessible route; accessible entrance.

## Standard classroom floor (spec §36)

`src/data/floorLayouts.json` encodes what was supplied: each academic floor has **2 classrooms on the west side, 3 on the east, and the HOD Room and Staff Room to the south**. `indoorGraph.ts` generates the nodes with stable ids (`C-F2-R01`…`C-F2-R05`, `C-F2-HOD`, `C-F2-STAFF`, `C-F2-CORRIDOR`, `C-F2-STAIRS`, and `C-G-…` for the ground floor). Vertical movement is a staircase edge between floors.

**Not invented:**
- No room numbers.
- No HOD/Staff left–right order.
- No door, staircase or lift positions.
- No indoor distances.

Every indoor connection is a **disabled** edge (`distanceMeters: null`), so Dijkstra never routes over it. Choosing a room (Floors panel → Set as destination) routes outdoors to the building entrance and lists the indoor steps as "Measurement required". In Wheelchair or Step-free mode it also states that no verified step-free route exists, since the only known way up is a staircase and no lift data has been supplied.

To activate indoor routing, add measured indoor connections and real room numbers (`roomNumbers: { "C-F2-R04": "C-204" }`). Set `lift: true` and add lift edges where lifts exist. The Floors panel lists all 12 items still required (§36.7).

## Navigation: Live vs Simulation (spec §39–47)

| | 🟢 LIVE LOCATION | 🟠 SIMULATION |
|---|---|---|
| Position | Device geolocation (`watchPosition`, high accuracy) | Virtual walker on the **calculated graph route** |
| Speed | Real movement | **1× = real walking time** at the configured speed (default 1.4 m/s); 0.5×, 2×, 5× and 10× are always shown in the banner |
| Labelling | Shows accuracy, e.g. `±8 m` | Always says `SIMULATION — N×` and "not your real location" |

Location pipeline, in order:
1. **Accuracy validation:** fixes worse than ±35 m show a warning and are not used.
2. **Outlier rejection:** implausible jumps (over 7 m/s, after allowing for accuracy) are ignored.
3. **Map matching:** the fix is snapped to the route polyline.
4. **Smoothing:** the marker eases toward the matched point and never teleports.

The raw fix and its accuracy circle are drawn separately from the smoothed marker.

- **Progress:** distance remaining, estimated time and the next instruction ("In 55 metres, turn left at …"). All of them come from the route's graph segments; turn directions are worked out from the path geometry.
- **Rerouting:** if you're off the route (more than 20 m, or 1.5× the GPS accuracy) on two fixes in a row, it says "You have left the planned route. Recalculating." and runs Dijkstra again from the nearest graph node, keeping the same accessibility constraints. More than 400 m away counts as off campus: you get a warning and no reroute.
- **Arrival:** decided by position. Within 10 m of the destination node, with accuracy of ±25 m or better, counts as arrived. When the accuracy is too poor to confirm, it says so. It never declares arrival just because an animation finished.
- **Indoor:** ordinary GPS can't place you in a room. Indoor steps show "Measurement required" and are never treated as tracked.

## Voice (spec §41–42)

- **🎤 Voice commands.** Uses the Web Speech API where available, plus a typed command box that always works. Speech is turned into explicit commands by `parseCommand` (`src/voice/intents.ts`). Examples: "Navigate to Block B", "Take me to the badminton court", "Find the car parking", "Use wheelchair mode", "Avoid stairs", "Find the nearest accessible entrance", "Repeat", "Pause/Resume/Stop navigation".
- **Ambiguity is never guessed.** "Take me to the hostel" asks you to choose Girls or Boys Hostel. Room numbers like "C-204" are recognised but not resolved, because real room numbers haven't been supplied.
- **🔊 Read Aloud** on every route result: destination, distance, estimated time, route sequence, accessibility status and warnings. During navigation it reads the current instruction and what's remaining.
- **Settings** (♿ button): voice guidance, read route, read accessibility, speech rate, volume, and walking speed (1.0, 1.4 or 1.8 m/s). Voice is optional; everything works without a microphone or speaker.

## Project layout

```
src/
├── algorithms/   dijkstra.ts · MinHeap.ts · alternativeRoutes.ts · accessibility.ts · traceState.ts · tests
├── graph/        Graph.ts · types.ts
├── data/         campusMeasurements.json · campusGraph.ts · campusModels.ts · geo.ts
│                 floorLayouts.json · indoorGraph.ts
├── globe/        GlobeScene.tsx · CameraFlight.ts · earthTexture.ts · campusPlanTexture.ts
├── campus/       CampusScene.tsx · Buildings.tsx · Surfaces.tsx (sports + parking) · Walkways.tsx · CampusLabels.tsx · facadeTextures.ts
├── navigation/   NavigationPanel · NavigationProgress · RoutePreference · AccessibilitySummary · IndoorContinuation
│                 session/ (useNavigationSession · routeProgress · locationFilter)
│                 RouteOptions · RouteRenderer · NavigationInstructions · routeGeometry
├── components/   SearchBar · LocationSelector · AlgorithmPanel · DataPanel · FloorPanel
│                 AccessibilityMenu · ScreenProjector (DOM labels over 3D points)
├── voice/        intents.ts (voice → commands) · speech.ts · readAloud.ts · VoiceControl.tsx
└── state/        navigationState.ts (explicit state machine) · accessibilitySettings.ts
```

**State machine:** `GLOBAL → SEARCH → GLOBE_FLIGHT → CAMPUS → ROUTE_SELECTION → ROUTE_CALCULATED → NAVIGATING`

## Notes

- Walking times assume **1.4 m/s**. They are estimates, not measured data.
- The globe is original: Natural Earth country shapes (public domain, via `world-atlas`) are drawn onto a canvas. It uses no Google imagery, branding or UI.
- Reduce motion (from the device setting or the ♿ menu) makes the flight, camera moves and marker animation near-instant.
