import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import type { ButtonHTMLAttributes } from 'react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { destinationNodes, edgeFilterFor, entranceBlocker, evaluateRoute } from './algorithms/accessibility'
import { kShortestRoutes } from './algorithms/alternativeRoutes'
import { dijkstra } from './algorithms/dijkstra'
import { traceAt } from './algorithms/traceState'
import type { NodeState } from './campus/CampusLabels'
import { AccessibilityMenu } from './components/AccessibilityMenu'
import { AlgorithmPanel } from './components/AlgorithmPanel'
import { DataPanel } from './components/DataPanel'
import { FloorPanel } from './components/FloorPanel'
import { SearchBar } from './components/SearchBar'
import { campus, campusGraph } from './data/campusGraph'
import { NavigationPanel } from './navigation/NavigationPanel'
import { buildRouteGeometry } from './navigation/routeGeometry'
import { useNavigationSession } from './navigation/session/useNavigationSession'
import { useAccessibilitySettings } from './state/accessibilitySettings'
import { parseCommand, type Intent } from './voice/intents'
import { routeSummaryText } from './voice/readAloud'
import { speak } from './voice/speech'
import { VoiceControl } from './voice/VoiceControl'
import type { RouteMode } from './algorithms/accessibility'
import { useNavigationState } from './state/navigationState'

const GlobeScene = lazy(() => import('./globe/GlobeScene'))
const CampusScene = lazy(() => import('./campus/CampusScene'))

const FADE_START = 0.8

const places = campusGraph.allNodes().filter((n) => n.kind !== 'junction')

/** Dijkstra (+ Yen alternatives) under the route mode's constraints. */
function computeRoutes(from: string, to: string, mode: RouteMode) {
  // Accessibility constraints prune edges before relaxation (spec section 34.4); the
  // destination resolves to the entrance(s) allowed in this mode (section 34.7).
  const edgeFilter = edgeFilterFor(mode)
  const targets = destinationNodes(campusGraph, to, mode)
  if (targets.length === 0) {
    // Never substitute a standard route when no usable entrance exists (spec section 40.6).
    return { routes: [], result: null, blocker: entranceBlocker(campusGraph, to, mode) }
  }
  const result = dijkstra(campusGraph, from, targets, { edgeFilter })
  const routes = result.path.length ? kShortestRoutes(campusGraph, from, targets, 3, edgeFilter) : []
  // Route 1 is always Dijkstra's answer; alternatives come from Yen's algorithm.
  if (routes.length) routes[0] = { path: result.path, distance: result.distance }
  return { routes, result, blocker: null }
}

export default function App() {
  const [state, dispatch] = useNavigationState()
  const a11y = useAccessibilitySettings()
  const { reducedMotion } = a11y
  const [a11yOpen, setA11yOpen] = useState(false)
  const [flight, setFlight] = useState(0)
  const [showTitle, setShowTitle] = useState(false)
  const [globeGone, setGlobeGone] = useState(false)
  const [panel, setPanel] = useState<'algorithm' | 'data' | 'floors' | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)

  const { phase } = state
  const onGlobe = phase === 'GLOBAL' || phase === 'SEARCH'
  const inCampus = !onGlobe && phase !== 'GLOBE_FLIGHT'
  const campusOpacity = inCampus ? 1 : phase === 'GLOBE_FLIGHT' ? Math.max(0, (flight - FADE_START) / (1 - FADE_START)) : 0

  const handleArrive = useCallback(() => {
    dispatch({ type: 'ARRIVED' })
    setShowTitle(true)
  }, [dispatch])

  useEffect(() => {
    if (phase !== 'CAMPUS') return
    const t1 = setTimeout(() => setGlobeGone(true), 600)
    const t2 = setTimeout(() => {
      setShowTitle(false)
      dispatch({ type: 'OPEN_ROUTE_SELECTION' })
    }, reducedMotion ? 600 : 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase, dispatch, reducedMotion])

  const calculate = (from = state.from, to = state.to, mode = state.mode) => {
    if (!from || !to) return
    const { routes, result, blocker } = computeRoutes(from, to, mode)
    dispatch({ type: 'ROUTES_CALCULATED', routes, dijkstra: result, blocker })
    if (result) {
      setStep(panel === 'algorithm' ? 0 : result.steps.length - 1)
      setPlaying(panel === 'algorithm' && !reducedMotion)
    }
  }

  // Changing the route preference recalculates an existing route.
  useEffect(() => {
    if (phase === 'ROUTE_CALCULATED') calculate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode])

  // Voice commands set endpoints and ask for a route; calculate once the state has them.
  const [pendingCalc, setPendingCalc] = useState(false)
  useEffect(() => {
    if (!pendingCalc) return
    setPendingCalc(false)
    if (state.from && state.to) calculate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCalc, state.from, state.to])

  const selected = state.routes[state.selectedRoute]
  const assessment = useMemo(() => (selected ? evaluateRoute(campusGraph, selected.path, state.mode) : null), [selected, state.mode])
  const routeGeometry = useMemo(() => (selected ? buildRouteGeometry(campusGraph, selected.path) : null), [selected])
  const alternatives = useMemo(
    () => state.routes.filter((_, i) => i !== state.selectedRoute).map((r) => buildRouteGeometry(campusGraph, r.path, 0.4)),
    [state.routes, state.selectedRoute],
  )

  // Live / simulated navigation session (spec sections 39, 43, 45-47).
  const destinationName = selected ? campusGraph.node(selected.path[selected.path.length - 1]).name : ''
  const session = useNavigationSession({
    graph: campusGraph,
    active: phase === 'NAVIGATING',
    paused: state.paused,
    source: state.source,
    simSpeed: state.simSpeed,
    walkingSpeed: a11y.settings.walkingSpeed,
    route: phase === 'NAVIGATING' ? routeGeometry : null,
    destinationName,
    onArrive: () => {

      if (a11y.settings.voiceGuidance) speak(`You have reached ${destinationName}.`, a11y.settings)
    },
    onReroute: (fromNode) => {
      if (!state.to) return
      if (a11y.settings.voiceGuidance) speak('You have left the planned route. Recalculating.', a11y.settings)
      // Recalculate from the nearest graph node, keeping the accessibility constraints (spec 40.5, 46).
      const { routes, result } = computeRoutes(fromNode, state.to, state.mode)
      if (result && routes.length) dispatch({ type: 'REROUTED', from: fromNode, routes, dijkstra: result })
    },
  })

  // Spoken turn-by-turn guidance whenever the instruction changes.
  const instructionText = session.view.instruction?.text
  useEffect(() => {
    if (phase === 'NAVIGATING' && a11y.settings.voiceGuidance && instructionText && !session.view.arrived) speak(instructionText, a11y.settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructionText, phase])

  const readAloud = () => {
    if (phase === 'NAVIGATING' && session.view.instruction) {
      speak(
        `${session.view.instruction.text} ${Math.round(session.view.remaining)} metres remaining to ${destinationName}, about ${Math.max(1, Math.round(session.view.etaSeconds / 60))} minutes.`,
        a11y.settings,
      )
    } else if (selected) {
      speak(
        routeSummaryText({
          graph: campusGraph,
          path: selected.path,
          distance: selected.distance,
          walkingSpeed: a11y.settings.walkingSpeed,
          mode: state.mode,
          assessment,
          settings: a11y.settings,
          room: state.room,
        }),
        a11y.settings,
      )
    }
  }

  // ---- Voice-to-action (spec section 41) ----
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceFeedback, setVoiceFeedback] = useState<{ text: string; options?: { id: string; label: string }[] } | null>(null)
  const say = (text: string, options?: { id: string; label: string }[]) => {
    setVoiceFeedback({ text, options })
    if (a11y.settings.voiceGuidance) speak(text, a11y.settings)
  }
  const goTo = (id: string) => {
    const name = campusGraph.node(id).name
    if (phase === 'NAVIGATING') dispatch({ type: 'EXIT_NAVIGATION' })
    dispatch({ type: 'SET_ENDPOINTS', from: state.from === id ? null : state.from, to: id })
    if (state.from && state.from !== id) {
      setPendingCalc(true)
      say(`Routing to ${name}.`)
    } else say(`Destination set to ${name}. Choose where you are starting from.`)
  }
  const runIntents = (intents: Intent[]) => {
    for (const i of intents) {
      switch (i.type) {
        case 'navigate':
          goTo(i.to)
          break
        case 'clarify':
          say('Which one did you mean?', i.options.map((id) => ({ id, label: campusGraph.node(id).name })))
          break
        case 'mode':
          dispatch({ type: 'SET_MODE', mode: i.mode })
          say(`Route preference: ${i.mode.replace('-', ' ')}.`)
          break
        case 'room':
          say(`Room numbers have not been supplied yet, so I can't locate ${i.query}. Open Floors to choose a room by position.`)
          break
        case 'nearest-accessible-entrance': {
          const entrances = campusGraph.allNodes().filter((n) => n.accessibleEntrance === true)
          if (!state.from) {
            say(`Verified accessible entrances: ${entrances.map((n) => n.name).join(', ')}. Choose a starting point to find the nearest.`)
            break
          }
          const r = dijkstra(campusGraph, state.from, entrances.map((n) => n.id), { edgeFilter: edgeFilterFor('wheelchair'), trace: false })
          if (!r.path.length) say('No verified accessible entrance is reachable from here.')
          else {
            dispatch({ type: 'SET_MODE', mode: 'wheelchair' })
            goTo(r.target)
          }
          break
        }
        case 'repeat':
          readAloud()
          break
        case 'pause':
          if (phase === 'NAVIGATING' && !state.paused) dispatch({ type: 'TOGGLE_PAUSE' })
          break
        case 'resume':
          if (phase === 'NAVIGATING' && state.paused) dispatch({ type: 'TOGGLE_PAUSE' })
          break
        case 'stop':
          dispatch({ type: 'EXIT_NAVIGATION' })
          say('Navigation stopped.')
          break
        case 'unknown':
          say(`Sorry, I didn't recognise a campus place or command in "${i.text}".`)
          break
      }
    }
  }

  const trace = panel === 'algorithm' && state.dijkstra ? traceAt(state.dijkstra, step) : null
  const nodeStates: Record<string, NodeState> = useMemo(() => {
    if (trace) return trace.nodeStates
    const s: Record<string, NodeState> = {}
    selected?.path.forEach((id) => (s[id] = 'path'))
    return s
  }, [trace, selected])

  const pick = (id: string) => {
    // Clicking labels fills From, then To, then starts over.
    if (phase === 'NAVIGATING') return
    if (state.from && !state.to && id !== state.from) dispatch({ type: 'SET_ENDPOINTS', from: state.from, to: id })
    else dispatch({ type: 'SET_ENDPOINTS', from: id, to: null })
  }

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
    <div className="relative h-full w-full select-none">
      {/* 3D layers */}
      {!globeGone && (
        <div className="absolute inset-0" style={{ opacity: 1 - campusOpacity * 0.999 }}>
          <Suspense fallback={null}>
            <GlobeScene
              flying={phase === 'GLOBE_FLIGHT' || !onGlobe}
              reducedMotion={reducedMotion}
              onProgress={setFlight}
              onArrive={handleArrive}
              showLabel={onGlobe || phase === 'GLOBE_FLIGHT'}
            />
          </Suspense>
        </div>
      )}
      {!onGlobe && (
        <div className="absolute inset-0" style={{ opacity: campusOpacity, pointerEvents: inCampus ? 'auto' : 'none' }}>
          <Suspense fallback={null}>
            <CampusScene
              intro={phase !== 'GLOBE_FLIGHT'}
              reducedMotion={reducedMotion}
              from={state.from}
              to={state.to}
              nodeStates={nodeStates}
              distances={trace?.distances}
              route={phase === 'ROUTE_CALCULATED' || phase === 'NAVIGATING' ? routeGeometry : null}
              alternatives={phase === 'ROUTE_CALCULATED' ? alternatives : []}
              navigating={phase === 'NAVIGATING'}
              following={state.following}
              navTarget={session.target}
              resetSignal={resetSignal}
              onPick={pick}
            />
          </Suspense>
        </div>
      )}

      {/* Brand */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0b1724]/80 ring-1 ring-white/10">
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path d="M12 3l5 15-5-3.4L7 18z" fill="#f2552c" />
          </svg>
        </div>
        <div className={inCampus ? 'text-[#0b1724]' : 'text-white'}>
          <div className="text-[13px] font-semibold leading-tight tracking-wide">MRTC Navigator</div>
          <div className="font-mono text-[10px] opacity-60">Dijkstra on a measured campus graph</div>
        </div>
      </div>

      {/* Accessibility settings — available on every screen */}
      <div className="absolute right-4 top-4 z-40 flex max-w-[calc(100vw-32px)] flex-wrap items-start justify-end gap-2">
        {inCampus && (
          <ToolbarButton
            active={voiceOpen}
            aria-expanded={voiceOpen}
            aria-label="Voice commands"
            title="Voice commands"
            onClick={() => {
              setVoiceOpen((o) => !o)
              setA11yOpen(false)
            }}
          >
            🎤
          </ToolbarButton>
        )}
        {voiceOpen && (
          <VoiceControl
            feedback={voiceFeedback}
            onCommand={(text) => runIntents(parseCommand(text, places))}
            onPickOption={(id) => runIntents([{ type: 'navigate', to: id }])}
            onClose={() => setVoiceOpen(false)}
          />
        )}
        <ToolbarButton
          active={a11yOpen}
          aria-expanded={a11yOpen}
          aria-label="Accessibility settings"
          title="Accessibility settings"
          onClick={() => {
            setA11yOpen((o) => !o)
            setVoiceOpen(false)
          }}
        >
          ♿
        </ToolbarButton>
        {a11yOpen && (
          <AccessibilityMenu
            settings={a11y.settings}
            reducedMotion={reducedMotion}
            systemReducedMotion={a11y.systemReducedMotion}
            onChange={a11y.update}
            onClose={() => setA11yOpen(false)}
          />
        )}
      </div>

      {/* Globe UI */}
      <AnimatePresence>
        {onGlobe && (
          <motion.div
            key="globe-ui"
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-[12vh] z-20 flex flex-col items-center gap-5 px-4"
          >
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-center text-[clamp(28px,5vw,52px)] font-semibold leading-[1.05] tracking-tight"
            >
              Find your way
              <br />
              <span className="text-white/45">across campus.</span>
            </motion.h1>
            <SearchBar onNavigate={() => dispatch({ type: 'START_FLIGHT' })} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flight status */}
      <AnimatePresence>
        {phase === 'GLOBE_FLIGHT' && (
          <motion.div
            key="flight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-10 z-20 flex justify-center"
          >
            <div className="glass rounded-full px-4 py-2 font-mono text-xs tracking-wider text-white/80">
              {flight < 0.45 ? 'Turning toward India' : flight < 0.8 ? 'Descending over Hyderabad' : 'Arriving at MRTC'} ·{' '}
              {campus.googlePlaceCoordinate.lat.toFixed(4)}° N {campus.googlePlaceCoordinate.lng.toFixed(4)}° E
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arrival title */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            initial={{ opacity: 0, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, letterSpacing: '0.32em' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          >
            <div className="text-center text-[#0b1724]">
              <div className="text-[clamp(28px,6vw,64px)] font-semibold">MRTC CAMPUS</div>
              <div className="mt-2 text-[12px] tracking-[0.2em] opacity-70">{campus.fullName.toUpperCase()}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campus UI */}
      {inCampus && !showTitle && (
        <>
          <div className="absolute bottom-4 left-4 top-[68px] z-20 flex flex-col">
            <NavigationPanel
              state={state}
              session={session.view}
              walkingSpeed={a11y.settings.walkingSpeed}
              onSpeed={(speed) => dispatch({ type: 'SET_SIM_SPEED', speed })}
              onReadAloud={readAloud}
              assessment={assessment}
              rejectedCount={state.dijkstra?.rejected.length ?? 0}
              onMode={(mode) => dispatch({ type: 'SET_MODE', mode })}
              onEndpoints={(from, to) => dispatch({ type: 'SET_ENDPOINTS', from, to })}
              onCalculate={() => calculate()}
              onSelectRoute={(i) => dispatch({ type: 'SELECT_ROUTE', index: i })}
              onStart={(follow, source) => {
                dispatch({ type: 'START_NAVIGATION', follow, source })
              }}
              onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              onExit={() => dispatch({ type: 'EXIT_NAVIGATION' })}
            />
          </div>

          <div className="absolute right-[68px] top-4 z-30 flex flex-wrap justify-end gap-2" role="toolbar" aria-label="Campus tools">
            <ToolbarButton active={panel === 'algorithm'} aria-pressed={panel === 'algorithm'} onClick={() => setPanel(panel === 'algorithm' ? null : 'algorithm')}>
              Algorithm
            </ToolbarButton>
            <ToolbarButton active={panel === 'floors'} aria-pressed={panel === 'floors'} onClick={() => setPanel(panel === 'floors' ? null : 'floors')}>
              Floors
            </ToolbarButton>
            <ToolbarButton active={panel === 'data'} aria-pressed={panel === 'data'} onClick={() => setPanel(panel === 'data' ? null : 'data')}>
              Data
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setResetSignal((n) => n + 1)}
              disabled={state.following && phase === 'NAVIGATING'}
              aria-label="Reset view"
              title="Reset view"
            >
              ⟲
            </ToolbarButton>
          </div>

          <div className="absolute bottom-4 right-4 top-[68px] z-20 flex flex-col items-end">
            {panel === 'algorithm' && (
              <AlgorithmPanel
                result={state.dijkstra}
                stepIndex={step}
                playing={playing}
                onStep={(i) => {
                  setStep(i)
                }}
                onTogglePlay={() => {
                  if (!playing && state.dijkstra && step >= state.dijkstra.steps.length - 1) setStep(0)
                  setPlaying((p) => !p)
                }}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === 'data' && <DataPanel onClose={() => setPanel(null)} />}
            {panel === 'floors' && (
              <FloorPanel
                initialBlock={state.room && state.to ? state.to : undefined}
                selectedRoom={state.room}
                onRouteToRoom={(blockId, room) => {
                  dispatch({ type: 'SET_ENDPOINTS', from: state.from, to: blockId, room })
                  setPanel(null)
                }}
                onClose={() => setPanel(null)}
              />
            )}
          </div>
        </>
      )}
    </div>
    </MotionConfig>
  )
}

function ToolbarButton({
  active,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`glass h-9 rounded-xl px-3 text-[13px] font-semibold transition disabled:opacity-40 ${
        active ? '!bg-[#f2552c] text-white' : 'text-white hover:!bg-[#13243a]'
      }`}
    >
      {children}
    </button>
  )
}
