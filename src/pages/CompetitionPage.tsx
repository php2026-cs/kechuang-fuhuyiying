import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Competition } from '@/types'

function CompetitionCard({ comp }: { comp: Competition }) {
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
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[comp.status] || ''}`}>
          {statusLabels[comp.status] || comp.status}
        </span>
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

export default function CompetitionPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

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
    load()
  }, [])

  const filtered = filter === 'all'
    ? competitions
    : competitions.filter((c) => c.status === filter)

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
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
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
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">重试</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无竞赛信息</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((comp) => (
            <CompetitionCard key={comp.id} comp={comp} />
          ))}
        </div>
      )}

      {/* Points calculator placeholder */}
      <div className="mt-12 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">积分计算器</h2>
        <p className="text-sm text-gray-500 mb-4">
          计算结果仅供参考，以学院当年正式文件为准。
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">竞赛等级</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>国家级</option>
              <option>省级</option>
              <option>校级</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">获奖等级</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>一等奖</option>
              <option>二等奖</option>
              <option>三等奖</option>
              <option>参与奖</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">计算积分</button>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-3xl font-bold text-blue-700">--</p>
          <p className="text-xs text-blue-500 mt-1">预估积分</p>
        </div>
      </div>
    </div>
  )
}
