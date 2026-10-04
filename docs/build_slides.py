"""Builds docs/MRTC_Campus_Navigation_Slides.pdf — one page per slide, ready to turn into a PPT.
Run from the project root:  python docs/build_slides.py   (needs: pip install reportlab; Windows Arial/Consolas fonts)"""
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Body", F + "arial.ttf"))
pdfmetrics.registerFont(TTFont("Bold", F + "arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Mono", F + "consola.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Bold")

W, H = 960, 540
NAVY, INK, ORANGE, MUTED, PAPER, LINE = (HexColor(c) for c in ("#0b1724", "#1d2b3a", "#f2552c", "#6b7785", "#f4f1ea", "#d9d3c7"))
GREEN, AMBER = HexColor("#2e8b57"), HexColor("#c98a12")

bullet = ParagraphStyle("b", fontName="Body", fontSize=15, leading=20, textColor=INK, leftIndent=14, bulletIndent=0, spaceAfter=6)
note = ParagraphStyle("n", fontName="Body", fontSize=10.5, leading=14, textColor=INK)
cell = ParagraphStyle("c", fontName="Body", fontSize=11, leading=14, textColor=INK)
cellb = ParagraphStyle("cb", parent=cell, fontName="Bold")

c = canvas.Canvas("docs/MRTC_Campus_Navigation_Slides.pdf", pagesize=(W, H))
c.setTitle("MRTC 3D Campus Navigation — Slide Content")
c.setAuthor("vidyaasagaar")
n = 0


def para(text, style, x, y_top, w):
    p = Paragraph(text, style)
    _, h = p.wrap(w, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def slide(title, subtitle=None):
    global n
    n += 1
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.rect(0, H - 78, W, 78, stroke=0, fill=1)
    c.setFillColor(ORANGE)
    c.rect(0, H - 82, W, 4, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Bold", 26)
    c.drawString(36, H - 46, title)
    if subtitle:
        c.setFont("Body", 12.5)
        c.setFillColor(HexColor("#b8c4d0"))
        c.drawString(36, H - 66, subtitle)
    c.setFont("Body", 10)
    c.setFillColor(HexColor("#8fa0b2"))
    c.drawRightString(W - 30, H - 46, f"Slide {n}")
    c.setFillColor(MUTED)
    c.setFont("Body", 9)
    c.drawString(36, 14, "MRTC 3D Campus Navigation")
    c.drawRightString(W - 30, 14, "github.com/vidyaasagaar/campus-navigation")


def bullets(items, x=36, y=H - 104, w=470):
    for it in items:
        y -= para(it, bullet, x, y, w) + 2
    return y


def notes(text):
    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.roundRect(36, 30, W - 72, 92, 8, stroke=1, fill=1)
    c.setFillColor(ORANGE)
    c.setFont("Bold", 9.5)
    c.drawString(48, 108, "SPEAKER NOTES")
    para(text, note, 48, 102, W - 96)


def visual_hint(text, x=530, y=H - 104, w=394, h=250):
    c.setStrokeColor(LINE)
    c.setDash(4, 3)
    c.roundRect(x, y - h, w, h, 8, stroke=1, fill=0)
    c.setDash()
    c.setFillColor(MUTED)
    c.setFont("Bold", 10)
    c.drawString(x + 12, y - 20, "SUGGESTED VISUAL")
    para(text, ParagraphStyle("v", parent=note, textColor=MUTED, fontSize=11.5, leading=15), x + 12, y - 30, w - 24)


def box(x, y, w, h, text, fill=NAVY, fg=white, size=11.5):
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 7, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Bold", size)
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        c.drawCentredString(x + w / 2, y + h / 2 + (len(lines) / 2 - i - 0.75) * (size + 2), ln)


def arrow(x1, y1, x2, y2, color=MUTED):
    import math
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.6)
    c.line(x1, y1, x2, y2)
    a = math.atan2(y2 - y1, x2 - x1)
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - 8 * math.cos(a - 0.4), y2 - 8 * math.sin(a - 0.4))
    p.lineTo(x2 - 8 * math.cos(a + 0.4), y2 - 8 * math.sin(a + 0.4))
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def graph(nodes, edges, highlight=(), crossed=()):
    """nodes: {id: (x, y, label)}, edges: [(a, b, label)]"""
    for a, b, lab in edges:
        (x1, y1, _), (x2, y2, _) = nodes[a], nodes[b]
        on = (a, b) in highlight or (b, a) in highlight
        off = (a, b) in crossed or (b, a) in crossed
        c.setStrokeColor(ORANGE if on else (HexColor("#b33") if off else MUTED))
        c.setLineWidth(4 if on else 1.8)
        if off:
            c.setDash(5, 4)
        c.line(x1, y1, x2, y2)
        c.setDash()
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        c.setFillColor(PAPER)
        tw = pdfmetrics.stringWidth(lab, "Bold", 11)
        c.rect(mx - tw / 2 - 3, my - 6, tw + 6, 14, stroke=0, fill=1)
        c.setFillColor(HexColor("#b33") if off else INK)
        c.setFont("Bold", 11)
        c.drawCentredString(mx, my - 2, lab)
    for x, y, lab in nodes.values():
        c.setFillColor(NAVY)
        c.circle(x, y, 22, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Bold", 10 if len(lab) > 2 else 13)
        c.drawCentredString(x, y - 4, lab)


def table(rows, x, y_top, widths, header=True):
    data = [[Paragraph(str(v), cellb if (header and i == 0) else cell) for v in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths)
    st = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("BACKGROUND", (0, 1), (-1, -1), white), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        st.append(("BACKGROUND", (0, 0), (-1, 0), HexColor("#e6e0d4")))
    t.setStyle(TableStyle(st))
    _, h = t.wrap(0, 0)
    t.drawOn(c, x, y_top - h)
    return h


# ---------------------------------------------------------------- 1 Title
c.setFillColor(NAVY)
c.rect(0, 0, W, H, stroke=0, fill=1)
c.setFillColor(ORANGE)
c.rect(60, 300, 6, 120, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Bold", 44)
c.drawString(84, 380, "MRTC 3D Campus Navigation")
c.setFont("Body", 20)
c.setFillColor(HexColor("#c9d4df"))
c.drawString(84, 345, "Shortest walking routes on a measured campus graph — Dijkstra's algorithm")
c.drawString(84, 318, "Malla Reddy Vishwavidyapeeth – Technical Campus, Hyderabad")
c.setFont("Body", 14)
c.setFillColor(HexColor("#8fa0b2"))
c.drawString(84, 200, "Team: ______________________        Hackathon: Algorithmic Problem Solving")
c.drawString(84, 176, "Paradigm: Graph   |   Algorithm: Dijkstra's Shortest Path   |   Stack: React · TypeScript · Three.js")
c.setFont("Body", 10)
c.drawString(84, 60, "This PDF is slide content: each page = one slide (title, bullet points, visual idea, speaker notes).")
c.showPage()
n = 1

# ---------------------------------------------------------------- 2 Problem
slide("The Problem", "Finding your way on a large campus")
bullets([
    "• New students and visitors don't know which way is <b>shortest</b> between blocks, hostels, canteen and sports areas.",
    "• Paths have <b>different lengths</b> — the route with fewer turns is not always the shortest.",
    "• Wheelchair users need routes that <b>avoid stairs</b> — the shortest route may not be usable.",
    "• Existing map apps don't know the <b>internal campus lanes</b> — Google suggests 550 m for a walk that is really 234 m.",
])
visual_hint("Photo 1 (blue A/B/C blocks) and photo 3 (football ground from the blocks).<br/><br/>Caption: <i>\"Where is the canteen from Block A — and what's the shortest way?\"</i>")
notes("Open with a relatable moment: a first-year student at Block A who needs the canteen. Stress three things: distances differ, the "
      "shortest-looking path isn't always shortest, and accessibility matters. End with the Google 550 m vs real 234 m example — it shows "
      "why a campus-specific graph is needed.")
c.showPage()

# ---------------------------------------------------------------- 3 Solution overview
slide("Our Solution", "A navigation system whose route comes from an algorithm — not a drawing")
y = H - 120
steps = ["Campus data\n(measured)", "Weighted\ngraph", "Dijkstra", "Shortest\nroute", "3D map +\ndirections"]
for i, s in enumerate(steps):
    x = 40 + i * 182
    box(x, y - 60, 150, 60, s, fill=ORANGE if s.startswith("Dijkstra") else NAVY)
    if i < len(steps) - 1:
        arrow(x + 152, y - 30, x + 180, y - 30)
bullets([
    "• <b>Data:</b> 18 places, 20 walkways — distances measured on Google Maps.",
    "• <b>Brain:</b> Dijkstra finds the minimum-metres route (with accessibility rules).",
    "• <b>Face:</b> Earth-to-campus 3D view, route animation, voice, live GPS / simulation.",
    "• <b>Key principle:</b> the 3D scene only <i>displays</i> the algorithm's answer.",
], y=H - 210, w=880)
notes("This is the one-slide summary. Walk left to right through the pipeline. Emphasise that nothing about the route is hard-coded: change "
      "a distance in the data file and the route changes. The 3D view is the presentation layer; Dijkstra is the core.")
c.showPage()

# ---------------------------------------------------------------- 4 Data
slide("Real Campus Data", "Measured, labelled honestly")
bullets([
    "• Each walkway traced with Google Maps' <b>Measure distance</b> tool — along the path, not a straight line.",
    "• Cross-checked with Google walking directions where available.",
    "• Every value carries a status: <b>VERIFIED</b> / <b>ESTIMATED (map-measured)</b> / <b>UNKNOWN</b>.",
    "• Missing distance → edge <b>disabled</b>, shown as \"Measurement required\". Never guessed.",
], w=440)
table([
    ["Walkway", "Distance"],
    ["Block A – Block B", "36.67 m"],
    ["Block B – Block C", "53.38 m"],
    ["Block A – Block C (forecourt)", "96.73 m"],
    ["Block C – Canteen", "84.78 m"],
    ["Girls → Boys Hostel (via 4 segments)", "234.23 m"],
    ["Block C – Running Track – Football", "52.88 + 11.33 m"],
    ["Block A – Bike Parking", "31.79 m"],
    ["Block B – Car Parking", "28.44 m"],
], 520, H - 104, [270, 130])
notes("Judges trust honest data. Explain how distances were measured and that all are currently ESTIMATED (map-measured, not walked). "
      "Mention straight-line vs path: Girls to Boys Hostel is 184 m straight but 234 m along real paths. Unknown values are switched off, not invented.")
c.showPage()

# ---------------------------------------------------------------- 5 Graph
slide("The Campus as a Graph", "Places = nodes · walkways = edges · metres = weights")
bullets([
    "• <b>Node</b> (vertex): a place you can stand — entrance, court gate, road junction.",
    "• <b>Edge</b>: a walkway that really exists. <b>Weight</b>: its length in metres.",
    "• <b>Undirected</b> — paths work both ways. <b>Weighted</b> — lengths differ.",
    "• <b>V = 18</b> nodes, <b>E = 20</b> edges. Stored as an <b>adjacency list</b>.",
    "• No fake shortcuts: Girls ↔ Boys Hostel goes through 3 real junctions.",
], w=450)
graph({"A": (580, 380, "A"), "B": (840, 380, "B"), "C": (840, 220, "C"), "K": (620, 200, "Canteen")},
      [("A", "B", "36.67"), ("A", "C", "96.73"), ("B", "C", "53.38"), ("C", "K", "84.78")])
c.setFillColor(MUTED)
c.setFont("Body", 10)
c.drawString(560, 160, "Subset of the real MRTC graph (metres).")
notes("Define node, edge and weight using the diagram. Why adjacency list: 18 nodes and only 20 edges — a matrix would be 324 cells, ~88% empty. "
      "Dijkstra repeatedly asks 'who are my neighbours?', which a list answers directly.")
c.showPage()

# ---------------------------------------------------------------- 6 Dijkstra simple
slide("Dijkstra's Algorithm — in Plain Words", "\"Friends on phones\"")
bullets([
    "• Everyone holds a notepad: distance from the start. Start = 0, others = ∞.",
    "• <b>Repeat:</b> pick the unfinished place with the <b>smallest</b> number — it is now <b>final</b>.",
    "• It \"phones\" each neighbour: <i>\"my distance + path length — is that shorter than yours?\"</i>",
    "• If yes, the neighbour updates its number and remembers <b>who called</b> (prev). This is <b>relaxation</b>.",
    "• Stop when the destination is final. Follow <b>prev</b> backwards to get the route.",
], w=880)
notes("Use the analogy before any code. Two words judges ask about: RELAXATION (a neighbour gets a shorter distance and updates) and FINAL "
      "(once the smallest unfinished number is picked, nothing can beat it because distances are never negative).")
c.showPage()

# ---------------------------------------------------------------- 7 Worked example
slide("Worked Example: Block A → Canteen", "Real MRTC distances, step by step")
table([
    ["Round", "Finalised", "Updates (relaxation)", "Notepads after"],
    ["1", "A (0)", "B = 0 + 36.67;  C = 0 + 96.73", "B 36.67 · C 96.73"],
    ["2", "B (36.67)", "C: 36.67 + 53.38 = 90.05  <b>&lt; 96.73</b>  → update", "C <b>90.05</b> (via B)"],
    ["3", "C (90.05)", "Canteen = 90.05 + 84.78", "Canteen 174.83"],
    ["4", "Canteen", "destination reached — stop", ""],
], 36, H - 104, [60, 110, 400, 300])
c.setFillColor(INK)
c.setFont("Bold", 15)
c.drawString(36, 250, "Route (follow prev backwards):  Canteen ← C ← B ← A,  reversed:  A → B → C → Canteen  =  174.83 m")
c.setFont("Body", 12.5)
c.setFillColor(MUTED)
c.drawString(36, 226, "The direct A → C path (96.73 m) loses to A → B → C (90.05 m): more steps, fewer metres.")
c.drawString(36, 206, "This is the project's milestone route from the specification.")
notes("Walk the table row by row. Round 2 is the key moment: Block C improves from 96.73 to 90.05 — that is relaxation. "
      "Then show route reconstruction with prev pointers. Live demo: Algorithm panel → Play, then open the Debug log.")
c.showPage()

# ---------------------------------------------------------------- 8 Data structures & complexity
slide("Data Structures & Complexity", "Exactly what our implementation uses")
table([
    ["Structure", "Used for"],
    ["Adjacency list (Map → edge list)", "each place's neighbours"],
    ["Binary min-heap (priority queue)", "\"which unfinished place is closest?\""],
    ["Distance map", "best known distance per place"],
    ["Previous-node map", "rebuild the route"],
    ["Visited set", "places already final"],
], 36, H - 104, [270, 230])
bullets([
    "• Heap push/pop = <b>O(log V)</b> (tree height).",
    "• ≤ V pops and ≤ 2E pushes →",
    "<b>Time O((V + E) log V)</b>",
    "<b>Space O(V + E)</b>",
    "• <b>Lazy deletion:</b> outdated heap entries are skipped when popped.",
], x=560, y=H - 104, w=360)
notes("Where does log V come from? Only from the heap: it is a balanced tree about log2(n) levels tall, and push/pop walk one path. "
      "Honest footnote: the step-recording trace used for the visual panel adds O(V) per step; the core algorithm is O((V+E) log V).")
c.showPage()

# ---------------------------------------------------------------- 9 Why not others
slide("Why Dijkstra? Compared on Our Real Campus", "All 210 ordered pairs of places tested")
table([
    ["Method", "Optimises", "Result on MRTC"],
    ["<b>Dijkstra</b>", "total metres", "Always shortest (verified vs Floyd–Warshall)"],
    ["BFS", "number of edges", "Longer in 70 / 210 pairs — A→C: 96.73 m instead of 90.05 m"],
    ["Greedy (shortest next edge)", "next step only", "Wrong or stuck in 173 / 210 — A→Canteen dead-ends at the Football Court"],
    ["DFS", "nothing about length", "finds a path, not the shortest"],
    ["A*", "metres + estimate", "also optimal with a good heuristic; Dijkstra = A* with estimate 0"],
], 36, H - 104, [190, 140, 558])
notes("This slide wins viva questions. BFS counts edges, not metres. Naive greedy commits to the locally shortest edge and can't undo it. "
      "Nuance: Dijkstra is itself a greedy algorithm in textbooks, but its greedy choice is GLOBAL (closest frontier node) and provably safe "
      "with non-negative weights. Demo: Algorithm panel → Compare.")
c.showPage()

# ---------------------------------------------------------------- 10 Accessibility
slide("Accessibility-Aware Routing", "Accessibility changes the graph, not just the icons")
bullets([
    "• Modes: Shortest · Fastest · <b>Wheelchair</b> · Step-free · Avoid stairs.",
    "• Before relaxing an edge, Dijkstra checks it: stairs / not step-free / not accessible → <b>skipped</b>.",
    "• The accessible route may be <b>longer</b> — that is correct.",
    "• Unknown accessibility is <b>never</b> shown as accessible — labelled \"unverified\".",
    "• User-verified: Block A & B fronts accessible; <b>Block C front is not</b> → app says so, no fake route.",
], w=470)
graph({"A": (580, 330, "A"), "B": (860, 330, "B"), "C": (720, 190, "C")},
      [("A", "B", "100 (stairs)"), ("A", "C", "60"), ("C", "B", "80")], highlight=[("A", "C"), ("C", "B")], crossed=[("A", "B")])
c.setFillColor(INK)
c.setFont("Bold", 11.5)
c.drawString(560, 150, "Normal: A → B = 100 m     Wheelchair: A → C → B = 140 m")
notes("Pipeline: all edges → accessibility filter → eligible edges → Dijkstra. Example from our tests: the stairs edge is removed, so the "
      "wheelchair route is 140 m instead of 100 m. Point out the Block C rule: we refuse to substitute a normal route when no verified "
      "accessible entrance exists.")
c.showPage()

# ---------------------------------------------------------------- 11 Live & simulation
slide("Live Navigation & Simulation", "Real location vs a clearly-labelled demo")
y = H - 120
flow = ["GPS fix", "Accuracy\ncheck", "Outlier\nfilter", "Map\nmatching", "Progress /\nreroute"]
for i, s in enumerate(flow):
    x = 40 + i * 182
    box(x, y - 54, 150, 54, s, fill=GREEN if i == 0 else NAVY, size=11)
    if i < len(flow) - 1:
        arrow(x + 152, y - 27, x + 180, y - 27)
bullets([
    "• <b>LIVE</b>: shows accuracy (±m); fixes worse than ±35 m are not used; GPS jumps ignored.",
    "• <b>Map matching</b>: snap the GPS dot to the nearest point on the route.",
    "• <b>Rerouting</b>: > max(20 m, 1.5 × accuracy) off-route twice → re-run Dijkstra from the nearest node.",
    "• <b>Arrival</b>: within 10 m of the destination with good accuracy — by position, not animation.",
    "• <b>SIMULATION</b>: virtual walker on the real route; 1× = real walking time (1.4 m/s); always labelled.",
], y=H - 196, w=880)
notes("Honesty principle: simulation is never presented as GPS, and the raw GPS dot with its accuracy circle is shown separately from the "
      "smoothed marker. ETA = remaining distance / walking speed and is always shown as an estimate (A → Canteen ≈ 125 s ≈ 2 min).")
c.showPage()

# ---------------------------------------------------------------- 12 3D + voice
slide("3D Visualisation & Voice", "Presentation layers on top of the algorithm")
bullets([
    "• <b>Globe → campus</b>: Earth rotates to India, camera dives, crossfades into the 3D campus.",
    "• <b>3D campus</b>: blocks, hostels, canteen, football ground + track, courts, parking.",
    "• <b>Route</b>: follows the real curved walkway shapes; walked part fades, next part stays bright.",
    "• <b>Voice commands</b>: \"Take me to the badminton court\" → intent → Dijkstra. Ambiguous (\"hostel\") → asks.",
    "• <b>Read Aloud</b>: distance, ETA, steps, accessibility warnings — generated from the route.",
], w=470)
visual_hint("Screenshot of the 3D campus with the orange route and the Navigation panel.<br/><br/>Second screenshot: the globe mid-flight over India.")
notes("Stress separation of concerns: delete the 3D layer and Dijkstra returns the same path. Voice never computes routes — it fills in "
      "From/To/Mode. Speech recognition needs Chrome/Edge; a typed command box always works.")
c.showPage()

# ---------------------------------------------------------------- 13 Tech stack
slide("Technology Stack", "What each tool does")
table([
    ["Tool", "Role in our project"],
    ["TypeScript", "JavaScript with types — catches mistakes before running"],
    ["React", "builds the UI from reusable components"],
    ["Vite", "dev server + production build"],
    ["Three.js (WebGL)", "draws the 3D globe and campus on the GPU"],
    ["React Three Fiber + drei", "3D objects as React components; orbit controls; route lines"],
    ["Tailwind CSS · Framer Motion", "styling · UI animations"],
    ["Natural Earth (world-atlas) + d3-geo", "original globe texture from public-domain country shapes"],
    ["Browser APIs", "Geolocation (GPS), Web Speech (voice in/out), localStorage (settings)"],
    ["Vitest", "71 automated tests"],
    ["Our own code", "<b>Graph, MinHeap, Dijkstra, Yen's alternatives, accessibility filter, map matching</b> — no graph library"],
], 36, H - 100, [290, 598])
notes("Key message: the frameworks are the face; the algorithmic core is written from scratch — Graph, MinHeap and Dijkstra are our own code, "
      "not a library call.")
c.showPage()

# ---------------------------------------------------------------- 14 Testing
slide("Testing & Correctness", "71 automated tests · 7 test files")
bullets([
    "• Guide examples: A→B 10, A→C 3, C→B 2 ⇒ <b>A → C → B = 5</b>.",
    "• Unreachable, same start/end, equal-cost ties, invalid node, negative weight rejected.",
    "• <b>30 random graphs</b>: Dijkstra checked against Floyd–Warshall (a different algorithm).",
    "• Accessibility: wheelchair avoids stairs, lift unavailable, ramp closed, no accessible route, accessible entrance.",
    "• Real campus: A → Canteen = 174.83 m; no direct Girls↔Boys Hostel edge; BFS/greedy never beat Dijkstra.",
    "• Navigation: map matching, rerouting, GPS outliers; voice intents and clarification.",
], w=880)
notes("Run `npm test` live if time allows. The Floyd–Warshall cross-check is strong evidence: two independent algorithms agree on every pair "
      "in 30 random graphs. Floyd–Warshall is also our Dynamic Programming example.")
c.showPage()

# ---------------------------------------------------------------- 15 Paradigms
slide("Algorithmic Paradigms — Honest Mapping", "What is in the project, and what is not")
table([
    ["Paradigm", "In project?", "Where"],
    ["Graph", "Yes — core", "campus graph + Dijkstra"],
    ["Greedy", "Yes", "Dijkstra's safe global greedy choice; naive greedy baseline (fails 173/210)"],
    ["Dynamic Programming", "Yes — in tests", "Floyd–Warshall: d[i][j] = min(d[i][j], d[i][k] + d[k][j])"],
    ["Divide & Conquer", "Not used", "possible: split a large campus into zones joined at gateway nodes"],
    ["Backtracking", "Not used", "could enumerate all simple paths — exponential, unsuitable"],
    ["Branch & Bound", "Not used", "could prune paths longer than the best found; A* is related"],
], 36, H - 104, [190, 140, 558])
notes("Never claim Dijkstra is every paradigm. Being precise here impresses judges more than over-claiming.")
c.showPage()

# ---------------------------------------------------------------- 16 Limitations & future
slide("Limitations & Future Work", "What we'd do next")
bullets([
    "• Distances are <b>map-measured</b> → walk them with a measuring wheel and mark VERIFIED.",
    "• Outdoor accessibility (kerbs, ramps, slopes) <b>not yet surveyed</b>.",
    "• <b>Indoor</b> navigation modelled (2 west + 3 east classrooms, HOD/Staff south) but disabled until room numbers, stairs, lifts and distances are collected.",
    "• Court/parking outlines approximate (satellite imagery predates the courts).",
    "• Phone GPS is several metres accurate — indoor positioning would need BLE beacons / QR checkpoints.",
], w=880)
notes("Raising limitations yourself shows understanding. Everything listed can be added by editing data files — no algorithm changes needed.")
c.showPage()

# ---------------------------------------------------------------- 17 Demo script
slide("Live Demo Script", "About 3 minutes")
bullets([
    "<b>1.</b> Search \"MRTC\" → <b>Navigate to MRTC</b> → globe flight → 3D campus.",
    "<b>2.</b> From <b>Block A</b> → To <b>Canteen</b> → Calculate → 174.83 m via B and C.",
    "<b>3.</b> <b>Algorithm</b> panel → Play (watch C relax 96.73 → 90.05) → Compare (BFS / Greedy).",
    "<b>4.</b> Switch to <b>Wheelchair</b> → To <b>Block C</b> → explicit \"no verified accessible entrance\".",
    "<b>5.</b> Voice or typed command: \"take me to the hostel\" → asks which one → \"box cricket\" → route.",
    "<b>6.</b> <b>Simulate</b> at 10× with Follow → arrival detected.",
], w=880)
notes("Rehearse this order. If the network is slow, skip the globe with Reduce motion (♿ settings). Keep the Data panel ready in case judges ask "
      "where distances come from.".replace("♿ ", ""))
c.showPage()

# ---------------------------------------------------------------- 18 Q&A prep
slide("Q&A — Likely Judge Questions", "Short answers to rehearse")
table([
    ["Question", "Answer in one line"],
    ["Why Dijkstra?", "Weighted graph, non-negative metres, need minimum total distance."],
    ["What is relaxation?", "If dist[u] + w < dist[v], update dist[v] and prev[v] = u."],
    ["Why is a popped node final?", "It's the smallest; any other route passes a farther node and only adds metres."],
    ["Why not BFS?", "It minimises edges, not metres — A→C 96.73 m vs 90.05 m."],
    ["Where does log V come from?", "Binary heap push/pop on a tree ~log V tall."],
    ["How do you get the route?", "Follow prev[] from destination back to start, then reverse."],
    ["What if a ramp is closed?", "Mark the edge closed; the filter rejects it; route recalculates."],
    ["Are distances accurate?", "Map-measured, labelled ESTIMATED; missing ones are disabled, never guessed."],
], 36, H - 100, [250, 638])
notes("Practise answering each in under 15 seconds. The full explanations with viva questions are in docs/LEARN.md.")
c.showPage()

# ---------------------------------------------------------------- 19 Thanks
c.setFillColor(NAVY)
c.rect(0, 0, W, H, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Bold", 46)
c.drawCentredString(W / 2, 300, "Thank you")
c.setFont("Body", 18)
c.setFillColor(HexColor("#c9d4df"))
c.drawCentredString(W / 2, 260, "Questions?")
c.setFont("Body", 13)
c.setFillColor(HexColor("#8fa0b2"))
c.drawCentredString(W / 2, 200, "github.com/vidyaasagaar/campus-navigation")
c.showPage()

c.save()
print("pages:", n + 1)
