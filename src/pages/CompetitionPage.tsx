import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { fetchMyFollows, toggleFollow } from '@/lib/competitionService'
import { calculatePoints, SCORE_TABLE, type EntryType, type Grade, type PointEntry, type Rank } from '@/lib/points'
import type { Competition, CompetitionFollow } from '@/types'

function CompetitionCard({ comp, followed, onToggleFollow }: {
  comp: Competition
  followed: boolean
  onToggleFollow: () => void
}) {
  const statusColors: Record<string, string> = {
    normal: 'bg-green-100 text-green-700',
    closing_soon: 'bg-amber-100 text-amber-700',
    due_today: 'bg-red-100 text-red-700',
    closed: 'bg-gray-100 text-gray-500',
  }
  const statusLabels: Record<string, string> = {
    normal: '正常',
    closing_soon: '临近截止',
    due_today: '今天截止',
    closed: '已截止',
  }
  const levelLabels: Record<string, string> = {
    national: '国家级',
    provincial: '省级',
    school: '校级',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{comp.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{levelLabels[comp.level] || comp.level}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[comp.status] || ''}`}>
            {statusLabels[comp.status] || comp.status}
          </span>
          <button
            onClick={onToggleFollow}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
              followed ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {followed ? '已关注' : '关注'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{comp.description}</p>
      <div className="text-xs text-gray-400 space-y-1 mb-3">
        <p>校内截止：{comp.school_deadline ? new Date(comp.school_deadline).toLocaleDateString('zh-CN') : '未设置'}</p>
        <p>官方截止：{comp.official_deadline ? new Date(comp.official_deadline).toLocaleDateString('zh-CN') : '未设置'}</p>
        {comp.suitable_majors && comp.suitable_majors.length > 0 && (
          <p>适合专业：{comp.suitable_majors.join('、')}</p>
        )}
      </div>
      {comp.official_source && (
        <a href={comp.official_source} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          官方信息来源
        </a>
      )}
      <p className="text-xs text-gray-300 mt-2">更新于 {new Date(comp.updated_at).toLocaleDateString('zh-CN')}</p>
    </div>
  )
}

function PointsCalculator() {
  const [entries, setEntries] = useState<PointEntry[]>([
    { grade: 'B', rank: '一等奖', type: 'sci', isFirst: false, teamSize: 1, myRank: 1 },
  ])
  const [result, setResult] = useState<{ K: number; J: number; H: number } | null>(null)

  const update = (idx: number, key: keyof PointEntry, value: unknown) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [key]: value } as PointEntry : e))
  }

  return (
    <div className="mt-12 bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">积分计算器</h2>
      <p className="text-sm text-gray-500 mb-4">计算结果仅供参考，以学院当年正式文件为准。</p>
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={idx} className="grid md:grid-cols-5 gap-3 border border-gray-100 rounded-lg p-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">类型</label>
              <select value={entry.type} onChange={e => update(idx, 'type', e.target.value as EntryType)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="sci">科技创新 (K)</option>
                <option value="pro">专业素养 (J)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">等级</label>
              <select value={entry.grade} onChange={e => update(idx, 'grade', e.target.value as Grade)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                {(['A', 'B', 'C', 'D', 'E'] as Grade[]).map(g => <option key={g} value={g}>{g} 类</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">奖次</label>
              <select value={entry.rank} onChange={e => update(idx, 'rank', e.target.value as Rank)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                {(Object.keys(SCORE_TABLE[entry.grade]) as Rank[]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">队伍人数</label>
                <input type="number" min={1} value={entry.teamSize}
                  onChange={e => update(idx, 'teamSize', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">我的名次</label>
                <input type="number" min={1} value={entry.myRank}
                  onChange={e => update(idx, 'myRank', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={entry.isFirst} onChange={e => update(idx, 'isFirst', e.target.checked)} />
                第一名
              </label>
              <button onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
                className="text-xs text-red-500 hover:underline cursor-pointer">删除</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={() => setEntries(prev => [...prev, { grade: 'C', rank: '一等奖', type: 'sci', isFirst: false, teamSize: 1, myRank: 1 }])}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          + 添加竞赛
        </button>
        <button onClick={() => setResult(calculatePoints(entries))}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
          计算积分
        </button>
      </div>
      {result && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-700">{result.K.toFixed(1)}</p>
            <p className="text-xs text-blue-500 mt-1">K（科技创新，取前3项）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{result.J.toFixed(1)}</p>
            <p className="text-xs text-blue-500 mt-1">J（专业素养，取前2项）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{result.H.toFixed(1)}</p>
            <p className="text-xs text-blue-500 mt-1">总分（上限 50）</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompetitionPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [follows, setFollows] = useState<CompetitionFollow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const loadFollows = useCallback(async () => {
    if (!user) {
      setFollows([])
      return
    }
    try {
      setFollows(await fetchMyFollows())
    } catch {
      // 忽略
    }
  }, [user])

  useEffect(() => {
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from('competitions')
          .select('*')
          .order('official_deadline', { ascending: true })
        if (queryError) throw queryError
        setCompetitions((data || []) as Competition[])
      } catch {
        setError('加载竞赛信息失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
    void loadFollows()
  }, [loadFollows])

  const handleToggleFollow = async (comp: Competition) => {
    if (!user) {
      navigate('/login')
      return
    }
    const followed = follows.some(f => f.competition_id === comp.id)
    const ok = await toggleFollow(comp.id, followed, user.id)
    if (ok) await loadFollows()
  }

  const filtered = filter === 'all'
    ? competitions
    : competitions.filter(c => c.status === filter)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">竞赛日历</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: '全部' },
          { key: 'normal', label: '进行中' },
          { key: 'closing_soon', label: '临近截止' },
          { key: 'due_today', label: '今天截止' },
          { key: 'closed', label: '已截止' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-full border cursor-pointer ${
              filter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">重试</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无竞赛信息</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(comp => (
            <CompetitionCard
              key={comp.id}
              comp={comp}
              followed={follows.some(f => f.competition_id === comp.id)}
              onToggleFollow={() => void handleToggleFollow(comp)}
            />
          ))}
        </div>
      )}

      <PointsCalculator />
    </div>
  )
}
