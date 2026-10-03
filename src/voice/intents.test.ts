import { describe, expect, it } from 'vitest'
import { campusGraph } from '../data/campusGraph'
import { parseCommand } from './intents'

const places = campusGraph.allNodes().filter((n) => n.kind !== 'junction')
const parse = (s: string) => parseCommand(s, places)

describe('voice intents (spec §41)', () => {
  it.each([
    ['Navigate to Block B', 'block-b'],
    ['Take me to the canteen', 'canteen'],
    ['Navigate to Box Cricket', 'box-cricket'],
    ['Take me to the badminton court', 'badminton-court'],
    ['Find the car parking', 'car-parking'],
    ['Navigate to the football ground', 'football-court'],
    ['go to the girls hostel', 'girls-hostel'],
  ])('%s', (text, id) => {
    expect(parse(text)).toContainEqual({ type: 'navigate', to: id })
  })

  it('asks for clarification instead of guessing', () => {
    const [i] = parse('Take me to the hostel')
    expect(i.type).toBe('clarify')
    expect(i.type === 'clarify' && i.options.sort()).toEqual(['boys-hostel', 'girls-hostel'])
    expect(parse('find the parking')[0]).toMatchObject({ type: 'clarify' })
  })

  it('mode commands', () => {
    expect(parse('Use wheelchair mode')).toContainEqual({ type: 'mode', mode: 'wheelchair' })
    expect(parse('Avoid stairs')).toContainEqual({ type: 'mode', mode: 'avoid-stairs' })
  })

  it('combined place + mode', () => {
    const r = parse('navigate to block a using wheelchair mode')
    expect(r).toContainEqual({ type: 'mode', mode: 'wheelchair' })
    expect(r).toContainEqual({ type: 'navigate', to: 'block-a' })
  })

  it('control commands', () => {
    expect(parse('Repeat')).toEqual([{ type: 'repeat' }])
    expect(parse('Pause navigation')[0]).toEqual({ type: 'pause' })
    expect(parse('Resume navigation')[0]).toEqual({ type: 'resume' })
    expect(parse('Stop navigation')).toContainEqual({ type: 'stop' })
    expect(parse('Find the nearest accessible entrance')).toContainEqual({ type: 'nearest-accessible-entrance' })
  })

  it('room numbers are recognised but not resolved to a guessed room', () => {
    expect(parse('Find C-204')).toEqual([{ type: 'room', query: 'C-204' }])
  })

  it('unknown speech is reported, not mapped to a place', () => {
    expect(parse('play some music')).toEqual([{ type: 'unknown', text: 'play some music' }])
  })
})
