import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'
import { calculateMatch, rankMatches } from '@/lib/matching'
import { canApplyToTeam } from '@/lib/applicationRules'
import { applyToTeam, fetchMyApplications } from '@/lib/applications'
import SkillsEditor from '@/components/SkillsEditor'
import type { MatchFilters, MatchResult, Recruitment, TeamApplication } from '@/types'

const COMPETITIONS = ['挑战杯', '互联网+', '大学生创新创业', '数学建模', 'ACM', '电子设计', '机械创新', '节能减排']

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: '招募中', cls: 'bg-green-100 text-green-700' },
  paused: { label: '已暂停', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: '已招满', cls: 'bg-gray-100 text-gray-600' },
  expired: { label: '已过期', cls: 'bg-red-100 text-red-600' },
}

function RecruitmentDetail({ result, onClose, onApply, onChat }: {
  result: MatchResult
  onClose: () => void
  onApply: () => void
  onChat: () => void
}) {
  const r = result.recruitment
  const st = STATUS_LABELS[r.status] || STATUS_LABELS.open
  const isFull = r.current_members >= r.planned_members
  const owner = r.profiles
  const canSeeContact = owner && r.contact_visibility !== 'hidden' && r.contact_visibility !== 'private'

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{r.team_name || r.competition_target}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
        </div>
        <div>
          {row('招募状态', <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>)}
          {row('目标赛事', r.competition_target)}
          {row('队伍人数', `${r.current_members}/${r.planned_members} 人${isFull ? '（已满员）' : `（还差 ${r.planned_members - r.current_members} 人）`}`)}
          {(r.required_skills || []).length > 0 && row('所需技能', r.required_skills.join('、'))}
          {r.description && row('项目简介', r.description)}
          {r.deadline && row('截止日期', r.deadline)}
          {r.availability && row('可参与时间', r.availability)}
          {owner && row('队长', `${owner.display_name}${owner.major ? ` · ${owner.major}` : ''}${owner.grade ? ` · ${owner.grade}` : ''}`)}
          {(owner?.skills || []).length > 0 && row('队长技能', owner!.skills.join('、'))}
          {canSeeContact && owner?.bio && row('队长简介', owner.bio)}
          {result.reasons.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-blue-700 mb-1">推荐原因</p>
              <ul className="text-sm text-gray-700 space-y-0.5">
                {result.reasons.map((reason, i) => <li key={i}>· {reason}</li>)}
              </ul>
            </div>
          )}
          {(!canSeeContact || !owner?.bio) && (
            <p className="text-xs text-gray-400 pt-2">联系方式已按隐私设置隐藏，可通过站内私信联系队长</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
          <button onClick={onChat} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">私信队长</button>
          <button onClick={onApply} disabled={isFull || r.status !== 'open'}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {isFull ? '已满员' : r.status !== 'open' ? st.label : '申请加入'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchCard({ result, applied, onDetail, onApply, onChat }: {
  result: MatchResult
  applied: 'none' | 'pending' | 'accepted' | 'rejected'
  onDetail: () => void
  onApply: () => void
  onChat: () => void
}) {
  const r = result.recruitment
  const st = STATUS_LABELS[r.status] || STATUS_LABELS.open
  const isFull = r.current_members >= r.planned_members

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{r.team_name || '未命名团队'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {r.competition_target} · {r.current_members}/{r.planned_members}人{isFull ? ' · 已满员' : ` · 还差 ${r.planned_members - r.current_members} 人`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            result.score >= 80 ? 'bg-green-100 text-green-700' :
            result.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            匹配 {result.score}%
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      {result.reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">推荐原因</p>
          <p className="text-sm text-gray-700">{result.reasons.join('；')}</p>
        </div>
      )}

      <div className="text-sm text-gray-600 mb-3">
        {(r.required_skills || []).length > 0 && (
          <p>
            招募技能：
            {r.required_skills.map(s => (
              <span key={s} className="inline-block bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs mr-1 mb-1">{s}</span>
            ))}
          </p>
        )}
        {result.unmetConditions.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">未满足：{result.unmetConditions.join('、')}</p>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{r.description}</p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>活跃于 {new Date(result.lastActive).toLocaleDateString('zh-CN')}</span>
        <button onClick={onDetail} className="text-blue-600 hover:underline cursor-pointer">查看详情</button>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={onApply}
          disabled={applied === 'pending' || applied === 'accepted' || isFull || r.status !== 'open'}
          className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {applied === 'pending' ? '已申请·待处理'
            : applied === 'accepted' ? '已加入'
            : isFull ? '已满员'
            : r.status !== 'open' ? st.label
            : '申请加入'}
        </button>
        <button onClick={onChat} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">私信队长</button>
      </div>
    </div>
  )
}

function ApplyModal({ recruitment, onClose, onSubmit }: {
  recruitment: Recruitment
  onClose: () => void
  onSubmit: (message: string) => Promise<void>
}) {
  const profile = useAuthStore(s => s.profile)
  const [message, setMessage] = useState(`你好，我对你的「${recruitment.team_name || recruitment.competition_target}」招募感兴趣。`)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const noSkills = !(profile?.skills || []).length

  const submit = async () => {
    setSubmitting(true)
    setError('')
    await onSubmit(message)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">申请加入「{recruitment.team_name || recruitment.competition_target}」</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">你的优势</label>
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">
              {noSkills
                ? <span className="text-amber-600">你还没有填写技能资料，完善技能资料可以提高通过率</span>
                : (profile?.skills || []).join(' / ')}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请留言</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
          </div>
          {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">取消</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {submitting ? '发送中...' : '发送申请'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecruitPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const { enabled: demoMode, matches: demoMatches, apply: demoApply } = useDemoStore()
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 筛选状态（真实生效）
  const [competition, setCompetition] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [mySkills, setMySkills] = useState<string[]>([])
  const [majorComplement, setMajorComplement] = useState<'any' | 'prefer' | 'must'>('prefer')
  const [statusFilter, setStatusFilter] = useState<'open' | 'all'>('open')
  const [showFilters, setShowFilters] = useState(false)

  // 我的申请状态（用于按钮显示）
  const [myApplications, setMyApplications] = useState<TeamApplication[]>([])
  const [detail, setDetail] = useState<MatchResult | null>(null)
  const [applyTarget, setApplyTarget] = useState<Recruitment | null>(null)
  const [toast, setToast] = useState('')

  const loadRecruitments = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('recruitments')
        .select('*, profiles(*)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setRecruitments((data || []) as Recruitment[])
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
    void loadRecruitments()
    if (user) {
      void fetchMyApplications().then(setMyApplications).catch(() => undefined)
    }
  }, [demoMode, user, demoMatches])

  const filters: MatchFilters = {
    competition: { value: competition, requirement: competition ? 'must' : 'any' },
    required_skills: { value: requiredSkills, requirement: requiredSkills.length ? 'prefer' : 'any' },
    my_skills: mySkills,
    major_complement: majorComplement,
  }

  const runMatch = () => {
    const source = demoMode ? (demoMatches as unknown as MatchResult[]).map(m => m.recruitment) : recruitments
    const ownId = user?.id
    const matched = source
      .filter(r => !r.is_deleted && (statusFilter === 'all' || r.status === statusFilter))
      .filter(r => !(ownId && r.user_id === ownId)) // 不推荐自己的招募
      .map(r => calculateMatch(r, filters, profile || undefined))
    setResults(rankMatches(matched))
  }

  const clearFilters = () => {
    setCompetition('')
    setRequiredSkills([])
    setMySkills([])
    setMajorComplement('prefer')
    setStatusFilter('open')
  }

  const appliedStatus = (recruitmentId: string): 'none' | 'pending' | 'accepted' | 'rejected' => {
    const list = myApplications.filter(a => a.recruitment_id === recruitmentId)
    if (list.some(a => a.status === 'pending')) return 'pending'
    if (list.some(a => a.status === 'accepted')) return 'accepted'
    if (list.some(a => a.status === 'rejected')) return 'rejected'
    return 'none'
  }

  const openApply = (recruitment: Recruitment) => {
    if (demoMode) {
      demoApply(recruitment.id, '演示模式模拟申请')
      setToast('演示模式：申请已模拟，不会写入数据库')
      return
    }
    if (!user) {
      navigate('/login')
      return
    }
    const check = canApplyToTeam(recruitment, user.id, myApplications)
    if (!check.ok) {
      setToast(check.reason)
      return
    }
    setApplyTarget(recruitment)
  }

  const submitApply = async (message: string) => {
    if (!applyTarget) return
    const res = await applyToTeam(applyTarget.id, message)
    if (res.ok) {
      setToast('申请已发送，等待队长处理')
      setApplyTarget(null)
      const apps = await fetchMyApplications()
      setMyApplications(apps)
    } else {
      setToast(res.error || '申请失败，请稍后重试')
    }
  }

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2600)
      return () => clearTimeout(t)
    }
  }, [toast])

  const showResults = demoMode || results.length > 0 || error !== '' || !loading
  const empty = showResults && results.length === 0 && !error && !loading && !demoMode

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {demoMode ? '演示数据 - 寻找队友' : '寻找队友'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            {showFilters ? '收起筛选' : '展开筛选'}
          </button>
          {user && (
            <button
              onClick={() => navigate('/profile')}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              发布招募
            </button>
          )}
        </div>
      </div>

      {/* 资料提示（轻量，不阻断） */}
      {!demoMode && !user && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-500">登录并完善专业、技能资料后，可以为你推荐真正匹配的队伍</p>
          <button onClick={() => navigate('/login')} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg cursor-pointer">登录 / 注册</button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">目标赛事</label>
            <div className="flex flex-wrap gap-2">
              {COMPETITIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setCompetition(prev => prev === c ? '' : c)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer ${
                    competition === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">我的技能（满足对方需求）</label>
            <SkillsEditor skills={mySkills} onChange={setMySkills}
              suggestions={['Python', 'C++', '前端', 'React', '数据分析', '嵌入式', 'UI设计', '机械设计']} max={10} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">对方需要具备的技能</label>
            <SkillsEditor skills={requiredSkills} onChange={setRequiredSkills}
              suggestions={['前端开发', '后端开发', '算法/建模', '嵌入式开发', '数据分析', '机械设计']} max={10} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700">专业互补</label>
            <select
              value={majorComplement}
              onChange={e => setMajorComplement(e.target.value as typeof majorComplement)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="prefer">偏好</option>
              <option value="must">必须</option>
              <option value="any">不要求</option>
            </select>
            <label className="text-sm font-medium text-gray-700">招募状态</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="open">仅招募中</option>
              <option value="all">全部（含暂停）</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runMatch}
              className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              开始匹配
            </button>
            <button onClick={clearFilters} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              清除筛选
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {loading && !demoMode ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={loadRecruitments} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">重试</button>
        </div>
      ) : empty ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-600 mb-2">暂时没有完全符合条件的队伍</p>
          <p className="text-gray-400 text-sm mb-6">可以尝试：放宽目标赛事条件、减少必须技能、查看最近活跃招募</p>
          <div className="flex justify-center gap-3">
            <button onClick={clearFilters} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">清除筛选</button>
            <button onClick={() => setShowFilters(true)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">调整筛选</button>
            <button onClick={runMatch} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">查看全部招募</button>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">点击「展开筛选」并「开始匹配」查看推荐结果</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {results.map(result => (
            <MatchCard
              key={result.recruitment.id}
              result={result}
              applied={appliedStatus(result.recruitment.id)}
              onDetail={() => setDetail(result)}
              onApply={() => openApply(result.recruitment)}
              onChat={() => navigate(`/messages?peer=${result.recruitment.user_id}&team=${encodeURIComponent(result.recruitment.team_name || result.recruitment.competition_target)}`)}
            />
          ))}
        </div>
      )}

      {detail && (
        <RecruitmentDetail
          result={detail}
          onClose={() => setDetail(null)}
          onApply={() => openApply(detail.recruitment)}
          onChat={() => navigate(`/messages?peer=${detail.recruitment.user_id}&team=${encodeURIComponent(detail.recruitment.team_name || detail.recruitment.competition_target)}`)}
        />
      )}

      {applyTarget && (
        <ApplyModal
          recruitment={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSubmit={submitApply}
        />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
