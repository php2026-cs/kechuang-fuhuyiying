interface CompletenessBarProps {
  percent: number
}

export default function CompletenessBar({ percent }: CompletenessBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const color = clamped >= 80 ? 'bg-green-500' : clamped >= 40 ? 'bg-blue-600' : 'bg-amber-500'
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 shrink-0">{clamped}%</span>
    </div>
  )
}
