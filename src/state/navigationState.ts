import { useReducer } from 'react'
import type { DijkstraResult } from '../algorithms/dijkstra'
import type { RouteMode } from '../algorithms/accessibility'
import type { Route } from '../algorithms/alternativeRoutes'
import type { NavSource } from '../navigation/session/useNavigationSession'

export type Phase = 'GLOBAL' | 'SEARCH' | 'GLOBE_FLIGHT' | 'CAMPUS' | 'ROUTE_SELECTION' | 'ROUTE_CALCULATED' | 'NAVIGATING'

export interface NavState {
  phase: Phase
  from: string | null
  to: string | null
  routes: Route[]
  selectedRoute: number
  dijkstra: DijkstraResult | null
  following: boolean
  paused: boolean
  /** Route preference (spec §34.1). */
  mode: RouteMode
  /** Indoor destination (room node id) inside the `to` building, if any. */
  room: string | null
  /** Why no route could be offered (e.g. no accessible entrance), when known. */
  blocker: string | null
  /** LIVE device location or clearly-labelled SIMULATION (spec §43, §45). */
  source: NavSource
  /** Simulation multiplier; 1 = real walking time. */
  simSpeed: number
}

export type NavAction =
  | { type: 'OPEN_SEARCH' }
  | { type: 'CLOSE_SEARCH' }
  | { type: 'START_FLIGHT' }
  | { type: 'ARRIVED' }
  | { type: 'OPEN_ROUTE_SELECTION' }
  | { type: 'SET_ENDPOINTS'; from: string | null; to: string | null; room?: string | null }
  | { type: 'SET_MODE'; mode: RouteMode }
  | { type: 'ROUTES_CALCULATED'; routes: Route[]; dijkstra: DijkstraResult | null; blocker?: string | null }
  | { type: 'SELECT_ROUTE'; index: number }
  | { type: 'START_NAVIGATION'; follow: boolean; source?: NavSource }
  | { type: 'SET_SIM_SPEED'; speed: number }
  | { type: 'REROUTED'; from: string; routes: Route[]; dijkstra: DijkstraResult }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'EXIT_NAVIGATION' }
  | { type: 'RESET' }

const initial: NavState = {
  phase: 'GLOBAL',
  from: null,
  to: null,
  routes: [],
  selectedRoute: 0,
  dijkstra: null,
  following: false,
  paused: false,
  mode: 'shortest',
  room: null,
  blocker: null,
  source: 'simulation',
  simSpeed: 1,
}

/** Explicit transitions — anything not listed here is ignored. */
function reducer(s: NavState, a: NavAction): NavState {
  switch (a.type) {
    case 'OPEN_SEARCH':
      return s.phase === 'GLOBAL' ? { ...s, phase: 'SEARCH' } : s
    case 'CLOSE_SEARCH':
      return s.phase === 'SEARCH' ? { ...s, phase: 'GLOBAL' } : s
    case 'START_FLIGHT':
      return s.phase === 'GLOBAL' || s.phase === 'SEARCH' ? { ...s, phase: 'GLOBE_FLIGHT' } : s
    case 'ARRIVED':
      return s.phase === 'GLOBE_FLIGHT' ? { ...s, phase: 'CAMPUS' } : s
    case 'OPEN_ROUTE_SELECTION':
      return s.phase === 'CAMPUS' ? { ...s, phase: 'ROUTE_SELECTION' } : s
    case 'SET_ENDPOINTS':
      return {
        ...s,
        from: a.from,
        to: a.to,
        room: a.room ?? null,
        phase: 'ROUTE_SELECTION',
        routes: [],
        dijkstra: null,
        following: false,
      }
    case 'SET_MODE':
      // Changing the preference invalidates the current route; the app recalculates.
      return s.phase === 'NAVIGATING' ? s : { ...s, mode: a.mode }
    case 'ROUTES_CALCULATED':
      return { ...s, phase: 'ROUTE_CALCULATED', routes: a.routes, dijkstra: a.dijkstra, blocker: a.blocker ?? null, selectedRoute: 0 }
    case 'SELECT_ROUTE':
      return s.phase === 'ROUTE_CALCULATED' ? { ...s, selectedRoute: a.index } : s
    case 'START_NAVIGATION':
      return s.phase === 'ROUTE_CALCULATED' || s.phase === 'NAVIGATING'
        ? { ...s, phase: 'NAVIGATING', following: a.follow, paused: false, source: a.source ?? s.source }
        : s
    case 'SET_SIM_SPEED':
      return { ...s, simSpeed: a.speed }
    case 'REROUTED':
      // Live navigation continues from the user's new position with the same constraints (spec §46).
      return s.phase === 'NAVIGATING' ? { ...s, from: a.from, routes: a.routes, dijkstra: a.dijkstra, selectedRoute: 0 } : s
    case 'TOGGLE_PAUSE':
      return s.phase === 'NAVIGATING' ? { ...s, paused: !s.paused } : s
    case 'EXIT_NAVIGATION':
      return s.phase === 'NAVIGATING' ? { ...s, phase: 'ROUTE_CALCULATED', following: false, paused: false } : s
    case 'RESET':
      return { ...initial, mode: s.mode, simSpeed: s.simSpeed }
  }
}

export const useNavigationState = () => useReducer(reducer, initial)
