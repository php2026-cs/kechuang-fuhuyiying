import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'
import { calculateMatch, rankMatches } from '@/lib/matching'
import type { Recruitment, MatchResult, MatchFilters } from '@/types'

const COMPETITIONS = ['挑战杯', '互联网+', '大学生创新创业', '数学建模', 'ACM', '电子设计', '机械创新', '节能减排']

function MatchCard({ result }: { result: MatchResult }) {
  const r = result.recruitment

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{r.team_name || '未命名团队'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {r.competition_target} · {r.current_members}/{r.planned_members}人
          </p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
          result.score >= 80 ? 'bg-green-100 text-green-700' :
          result.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          匹配 {result.score}%
        </span>
      </div>

      {result.reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">推荐原因</p>
          <p className="text-sm text-gray-700">{result.reasons.join('；')}</p>
        </div>
      )}

      <div className="text-sm text-gray-600 mb-3">
        <p>
          招募技能：
          {r.required_skills.map((s: string, i: number) => (
            <span key={i} className="inline-block bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs mr-1 mb-1">{s}</span>
          ))}
        </p>
        {result.unmetConditions.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">未满足：{result.unmetConditions.join('、')}</p>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{r.description}</p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {r.status === 'open' ? '招募中' : r.status === 'paused' ? '暂停' : r.status === 'completed' ? '已完成' : '已过期'}
          · 活跃于 {new Date(result.lastActive).toLocaleDateString('zh-CN')}
        </span>
        <span className="text-blue-600">联系方式已隐藏，请通过站内私信联系</span>
      </div>
    </div>
  )
}

export default function RecruitPage() {
  const user = useAuthStore((s) => s.user)
  const { enabled: demoMode, matches: demoMatches } = useDemoStore()
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state
  const [filters] = useState<MatchFilters>({
    competition: { value: '', requirement: 'prefer' },
    required_skills: { value: [], requirement: 'prefer' },
    my_skills: [],
    major_complement: 'prefer',
  })
  const [showFilters, setShowFilters] = useState(false)

  // Create recruitment form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    competition_target: '',
    team_name: '',
    description: '',
    required_skills: [] as string[],
    planned_members: 4,
    deadline: '',
    availability: '',
  })
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  const loadRecruitments = async () => {
    setLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('recruitments')
        .select('*, profiles(*)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setRecruitments((data || []) as unknown as Recruitment[])
    } catch {
      setError('加载招募信息失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) {
      setResults(demoMatches as unknown as MatchResult[])
      setLoading(false)
      return
    }
    loadRecruitments()
  }, [demoMode])

  const runMatch = () => {
    const matched = recruitments.map((r) => calculateMatch(r, filters))
    const ranked = rankMatches(matched)
    setResults(ranked)
  }

  const handleCreateRecruitment = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formData.competition_target.trim()) { setFormError('请选择目标赛事'); return }
    if (!formData.description.trim() || formData.description.trim().length < 10) { setFormError('招募描述至少10个字'); return }

    if (!user) {
      setFormError('请先登录')
      return
    }

    setCreating(true)
    try {
      const { error: insertError } = await supabase.from('recruitments').insert({
        user_id: user.id,
        competition_target: formData.competition_target,
        competition_name: formData.competition_target,
        team_name: formData.team_name || null,
        description: formData.description,
        required_skills: formData.required_skills,
        current_members: 1,
        planned_members: formData.planned_members,
        deadline: formData.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        availability: formData.availability,
        status: 'open',
        contact_visibility: 'matched',
        last_active_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
      setShowCreateForm(false)
      setFormData({ competition_target: '', team_name: '', description: '', required_skills: [], planned_members: 4, deadline: '', availability: '' })
      loadRecruitments()
    } catch {
      setFormError('发布失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {demoMode ? '演示数据 - 寻找队友' : '寻找队友'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showFilters ? '收起筛选' : '展开筛选'}
          </button>
          {user && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              发布招募
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">目标赛事</label>
            <div className="flex flex-wrap gap-2">
              {COMPETITIONS.map((c) => (
                <button key={c} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">{c}</button>
              ))}
            </div>
          </div>
          <button
            onClick={runMatch}
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            开始匹配
          </button>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">发布招募</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-gray-100 rounded" aria-label="关闭">✕</button>
            </div>
            <form onSubmit={handleCreateRecruitment} className="space-y-4">
              {formError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标赛事 *</label>
                <select
                  value={formData.competition_target}
                  onChange={(e) => setFormData({ ...formData, competition_target: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择</option>
                  {COMPETITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">团队名称</label>
                <input
                  type="text"
                  value={formData.team_name}
                  onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="选填"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">招募描述 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="描述你的团队和项目方向（至少10字）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">计划招募人数</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.planned_members}
                  onChange={(e) => setFormData({ ...formData, planned_members: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">可参与时间</label>
                <input
                  type="text"
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：周末及工作日晚上"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {creating ? '发布中...' : '发布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={loadRecruitments} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">重试</button>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">{'🔍'}</div>
          <p className="text-gray-600 mb-2">暂未找到符合条件的队友</p>
          <p className="text-gray-400 text-sm mb-6">可以减少必选条件，或发布一条招募信息</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowFilters(true)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">修改筛选</button>
            {user && (
              <button onClick={() => setShowCreateForm(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">发布招募</button>
            )}
            <button onClick={loadRecruitments} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">查看全部招募</button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {results.map((result, i) => (
            <MatchCard key={result.recruitment.id || i} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
