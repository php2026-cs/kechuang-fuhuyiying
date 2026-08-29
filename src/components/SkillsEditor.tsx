import { useState } from 'react'

interface SkillsEditorProps {
  skills: string[]
  onChange: (skills: string[]) => void
  suggestions?: string[]
  placeholder?: string
  max?: number
  maxLength?: number
}

/**
 * 轻量技能标签编辑器：
 * Enter 添加、点击 × 删除、去重、trim、空值禁止、数量与长度限制。
 * 视觉延续当前站点 tag（灰底圆角 + 蓝色选中态）。
 */
export default function SkillsEditor({
  skills,
  onChange,
  suggestions = [],
  placeholder = '输入技能...',
  max = 20,
  maxLength = 20,
}: SkillsEditorProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const add = (raw: string) => {
    const v = raw.trim().slice(0, maxLength)
    setError('')
    if (!v) return
    if (skills.length >= max) {
      setError(`最多添加 ${max} 个技能`)
      return
    }
    if (skills.some(s => s.toLowerCase() === v.toLowerCase())) {
      setValue('')
      return
    }
    onChange([...skills, v])
    setValue('')
  }

  const remove = (v: string) => onChange(skills.filter(s => s !== v))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {skills.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs bg-blue-50 text-blue-600"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(s)}
              className="p-0.5 rounded-full hover:bg-blue-100 cursor-pointer"
              aria-label={`删除技能 ${s}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(value)
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength + 10}
          className="flex-1 h-9 px-3 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => add(value)}
          className="h-9 px-3.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
        >
          添加
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(s => {
            const active = skills.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => (active ? remove(s) : add(s))}
                className={`px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
