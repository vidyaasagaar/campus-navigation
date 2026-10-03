import { campusGraph } from '../data/campusGraph'

interface Props {
  label: string
  value: string | null
  exclude?: string | null
  onChange: (id: string) => void
}

const GROUPS: { label: string; kinds: string[] }[] = [
  { label: 'Academic', kinds: ['academic'] },
  { label: 'Hostels', kinds: ['hostel'] },
  { label: 'Food', kinds: ['facility'] },
  { label: 'Sports', kinds: ['sports'] },
  { label: 'Parking', kinds: ['parking'] },
]
const nodes = campusGraph.allNodes()

export function LocationSelector({ label, value, exclude, onChange }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 text-[15px] text-white focus:border-[#f2552c] focus:outline-none"
      >
        <option value="" disabled>
          Select location
        </option>
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {nodes
              .filter((n) => g.kinds.includes(n.kind))
              .map((n) => (
                <option key={n.id} value={n.id} disabled={n.id === exclude}>
                  {n.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
