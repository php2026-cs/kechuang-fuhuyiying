import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Link } from 'react-router-dom'
import SkillsEditor from '@/components/SkillsEditor'
import CompletenessBar from '@/components/CompletenessBar'
import { calculateProfileCompleteness, COMPLETENESS_LABELS } from '@/lib/profileCompleteness'
import { mergeProfileIntoForm, profileToFormData } from '@/lib/profileForm'
import {
  fetchMyApplications,
  fetchApplicationsAsOwner,
  respondToTeamApplication,
  withdrawTeamApplication,
} from '@/lib/applications'
import type { Recruitment, TeamApplication, UserProfile } from '@/types'

const MAJORS = [
  '人工智能',
  '计算机科学与技术',
  '软件工程',
  '智能制造工程',
  '智能车辆工程',
  '机械设计制造及其自动化',
  '自动化',
  '电子信息工程',
  '生物工程',
  '智能建造',
  '其他',
]

const GRADES = ['大一', '大二', '大三', '大四', '研一', '研二', '研三', '其他']

const SKILL_SUGGESTIONS = ['Python', 'C++', '前端', 'React', '机械设计', 'SolidWorks', '机器学习', '数据分析', 'UI设计', '商业计划书', '路演', '嵌入式', 'MATLAB']
const COMP_INTEREST_SUGGESTIONS = ['挑战杯', '互联网+', '大创项目', '数学建模', 'ACM', '电子设计', '机器人大赛', 'RoboMaster', '蓝桥杯']

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: '招募中', cls: 'bg-green-100 text-green-700' },
  paused: { label: '已暂停', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: '已招满', cls: 'bg-gray-100 text-gray-600' },
  expired: { label: '已过期', cls: 'bg-red-100 text-red-600' },
}

function RecruitmentEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Recruitment | null
  onSave: (data: Partial<Recruitment>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    team_name: initial?.team_name || '',
    competition_target: initial?.competition_target || '',
    description: initial?.description || '',
    required_skills: initial?.required_skills || [] as string[],
    current_members: initial?.current_members ?? 1,
    planned_members: initial?.planned_members ?? 4,
    deadline: initial?.deadline || '',
    availability: initial?.availability || '',
    contact_visibility: initial?.contact_visibility || 'matched',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!form.competition_target.trim()) { setError('请选择目标赛事'); return }
    if (!form.description.trim() || form.description.trim().length < 10) { setError('招募描述至少10个字'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{initial ? '编辑招募' : '发布招募'}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
        </div>
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">团队名称</label>
            <input
              value={form.team_name}
              onChange={e => setForm({ ...form, team_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="选填"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目标赛事 *</label>
            <input
              value={form.competition_target}
              onChange={e => setForm({ ...form, competition_target: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：挑战杯"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">招募描述 *</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="至少10个字"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所需技能</label>
            <SkillsEditor skills={form.required_skills} onChange={required_skills => setForm({ ...form, required_skills })}
              suggestions={['前端开发', '后端开发', 'UI设计', '算法/建模', '嵌入式开发', '数据分析', '机械设计', 'PPT制作', '路演答辩', '文案写作']} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前人数</label>
              <input type="number" min={1} max={50} value={form.current_members}
                onChange={e => setForm({ ...form, current_members: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">计划人数</label>
              <input type="number" min={1} max={50} value={form.planned_members}
                onChange={e => setForm({ ...form, planned_members: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
              <input type="date" value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">可参与时间</label>
              <input value={form.availability}
                onChange={e => setForm({ ...form, availability: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如：周末" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">联系方式可见范围</label>
            <select value={form.contact_visibility}
              onChange={e => setForm({ ...form, contact_visibility: e.target.value as Recruitment['contact_visibility'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="logged_in">登录用户可见</option>
              <option value="matched">匹配成功后可见</option>
              <option value="private">仅接受站内私信</option>
              <option value="hidden">完全隐藏</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">取消</button>
            <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const refreshProfile = useAuthStore(s => s.refreshProfile)
  const [editing, setEditing] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [formData, setFormData] = useState(() => profileToFormData(profile))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  // 我的招募
  const [myRecruitments, setMyRecruitments] = useState<Recruitment[]>([])
  const [recruitLoading, setRecruitLoading] = useState(false)
  const [editingRecruitment, setEditingRecruitment] = useState<Recruitment | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // 申请
  const [myApplications, setMyApplications] = useState<TeamApplication[]>([])
  const [ownerApplications, setOwnerApplications] = useState<TeamApplication[]>([])
  const [applicationsFor, setApplicationsFor] = useState<Recruitment | null>(null)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')

  const completeness = useMemo(() => calculateProfileCompleteness(profile), [profile])
  const needsOnboarding = !!user && !onboardingDismissed && completeness.percent < 60

  // 表单只在打开编辑弹窗时初始化（见 openEditModal），
  // 避免 profile 异步刷新时通过 effect 重置正在编辑的内容

  const openEditModal = () => {
    setFormData(profileToFormData(profile))
    setEditing(true)
  }

  // profile 异步加载完成后，把未编辑字段补填为 profile 值，
  // 用户已输入的字段保持不变（避免覆盖输入，也避免空表单被校验拦截）
  useEffect(() => {
    if (editing && profile) {
      setFormData(prev => mergeProfileIntoForm(prev, profile))
    }
  }, [editing, profile])

  const loadRecruitments = useCallback(async () => {
    if (!user) return
    setRecruitLoading(true)
    try {
      const { data, error } = await supabase
        .from('recruitments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMyRecruitments((data || []) as Recruitment[])
    } catch {
      setActionError('加载我的招募失败，请重试')
    } finally {
      setRecruitLoading(false)
    }
  }, [user])

  const loadApplications = useCallback(async () => {
    if (!user) return
    try {
      const [mine, owned] = await Promise.all([fetchMyApplications(), fetchApplicationsAsOwner()])
      setMyApplications(mine)
      setOwnerApplications(owned)
    } catch {
      setActionError('加载申请失败，请重试')
    }
  }, [user])

  useEffect(() => {
    if (user) {
      void loadRecruitments()
      void loadApplications()
    }
  }, [user, loadRecruitments, loadApplications])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2600)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">请先登录</p>
        <Link to="/login" className="text-blue-600 hover:underline">前往登录</Link>
      </div>
    )
  }

  const handleSaveProfile = async () => {
    setSaveError('')
    setSaveSuccess('')
    if (!formData.display_name.trim()) {
      setSaveError('显示名称不能为空')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name.trim(),
          major: formData.major,
          grade: formData.grade,
          skills: formData.skills,
          bio: formData.bio,
          availability: formData.availability,
          competition_interests: formData.competition_interests,
          contact_visibility: formData.contact_visibility,
        })
        .eq('user_id', user.id)
      if (error) throw error
      setSaveSuccess('保存成功')
      setEditing(false)
      await refreshProfile()
    } catch {
      setSaveError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const saveRecruitment = async (data: Partial<Recruitment>) => {
    try {
      const base = {
        team_name: data.team_name || null,
        competition_target: data.competition_target,
        competition_name: data.competition_target,
        description: data.description,
        required_skills: data.required_skills || [],
        current_members: data.current_members ?? 1,
        planned_members: data.planned_members ?? 4,
        deadline: data.deadline || null,
        availability: data.availability || '',
        contact_visibility: data.contact_visibility || 'matched',
      }
      if (editingRecruitment) {
        const { error } = await supabase.from('recruitments').update({ ...base, last_active_at: new Date().toISOString() }).eq('id', editingRecruitment.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recruitments').insert({ ...base, user_id: user.id, status: 'open' })
        if (error) throw error
      }
      setEditingRecruitment(null)
      setShowCreate(false)
      setToast('保存成功')
      await loadRecruitments()
    } catch {
      setActionError('保存招募失败，请重试')
    }
  }

  const changeRecruitStatus = async (id: string, status: Recruitment['status']) => {
    try {
      const { error } = await supabase.from('recruitments').update({ status, last_active_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setToast(status === 'paused' ? '招募已暂停' : status === 'open' ? '招募已恢复' : '招募已结束')
      await loadRecruitments()
    } catch {
      setActionError('操作失败，请重试')
    }
  }

  const deleteRecruitment = async (id: string) => {
    try {
      const { error } = await supabase.from('recruitments').update({ is_deleted: true }).eq('id', id)
      if (error) throw error
      setToast('招募已删除')
      await loadRecruitments()
    } catch {
      setActionError('删除失败，请重试')
    }
  }

  const respond = async (app: TeamApplication, action: 'accept' | 'reject') => {
    setActionError('')
    const res = await respondToTeamApplication(app.id, action)
    if (!res.ok) {
      setActionError(res.error || '操作失败')
      return
    }
    setToast(action === 'accept' ? '已接受成员加入' : '已拒绝该申请')
    await loadApplications()
    await loadRecruitments()
  }

  const withdraw = async (app: TeamApplication) => {
    setActionError('')
    const res = await withdrawTeamApplication(app.id)
    if (!res.ok) {
      setActionError(res.error || '撤回失败')
      return
    }
    setToast('申请已撤回')
    await loadApplications()
  }

  const pendingCount = (recruitmentId: string) =>
    ownerApplications.filter(a => a.recruitment_id === recruitmentId && a.status === 'pending').length

  const contactVisibilityLabels: Record<string, string> = {
    logged_in: '登录用户可见',
    matched: '匹配成功后可见',
    private: '仅接受站内私信',
    hidden: '完全隐藏',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {actionError && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{actionError}</div>
      )}

      {/* Onboarding */}
      {needsOnboarding && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="font-medium text-gray-900">完善资料，获得更准确的队伍推荐</p>
            <div className="mt-2"><CompletenessBar percent={completeness.percent} /></div>
            {completeness.missing.length > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">
                还差：{completeness.missing.slice(0, 4).map(m => COMPLETENESS_LABELS[m]).join('、')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOnboardingDismissed(true)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg cursor-pointer">稍后填写</button>
            <button onClick={openEditModal} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">完善资料</button>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
            {(profile?.display_name || user.email || '?')[0]}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{profile?.display_name || '未设置'}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={openEditModal} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">编辑资料</button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-500">资料完整度 {completeness.percent}%</span>
            <span className="text-xs text-gray-400">完善资料可以获得更准确的队友推荐</span>
          </div>
          <CompletenessBar percent={completeness.percent} />
        </div>

        <div className="grid sm:grid-cols-2 gap-2 mt-4 text-sm">
          <div><span className="text-gray-400">专业：</span><span className="text-gray-700">{profile?.major || '未设置'}</span></div>
          <div><span className="text-gray-400">年级：</span><span className="text-gray-700">{profile?.grade || '未设置'}</span></div>
          <div className="sm:col-span-2"><span className="text-gray-400">简介：</span><span className="text-gray-700">{profile?.bio || '未设置'}</span></div>
          <div className="sm:col-span-2"><span className="text-gray-400">可参与时间：</span><span className="text-gray-700">{profile?.availability || '未设置'}</span></div>
          <div className="sm:col-span-2">
            <span className="text-gray-400">联系方式可见：</span>
            <span className="text-gray-700">{contactVisibilityLabels[profile?.contact_visibility || 'logged_in']}</span>
          </div>
          {(profile?.skills || []).length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-gray-400">技能：</span>
              <span className="inline-flex flex-wrap gap-1 ml-1">
                {profile!.skills.map(s => (
                  <span key={s} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{s}</span>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Edit profile */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">编辑个人资料</h2>
              <button onClick={() => setEditing(false)} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
            </div>
            <div className="space-y-4">
              {saveError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{saveError}</div>}
              {saveSuccess && <div className="bg-green-50 text-green-600 px-3 py-2 rounded text-sm">{saveSuccess}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
                <input value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">专业</label>
                  <select value={formData.major} onChange={e => setFormData({ ...formData, major: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- 请选择 --</option>
                    {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                  <select value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- 请选择 --</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">我的技能</label>
                <SkillsEditor skills={formData.skills} onChange={skills => setFormData({ ...formData, skills })} suggestions={SKILL_SUGGESTIONS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">感兴趣的比赛</label>
                <SkillsEditor skills={formData.competition_interests} onChange={competition_interests => setFormData({ ...formData, competition_interests })}
                  suggestions={COMP_INTEREST_SUGGESTIONS} placeholder="输入比赛名称..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
                <textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">可参与时间</label>
                <input value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：周末及工作日晚上" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系方式可见范围</label>
                <select value={formData.contact_visibility}
                  onChange={e => setFormData({ ...formData, contact_visibility: e.target.value as UserProfile['contact_visibility'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="logged_in">登录用户可见</option>
                  <option value="matched">匹配成功后可见</option>
                  <option value="private">仅接受站内私信</option>
                  <option value="hidden">完全隐藏</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">取消</button>
                <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 我的招募 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">我的招募</h2>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">发布招募</button>
        </div>
        {recruitLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : myRecruitments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-500">还没有发布招募信息</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">发布招募让队友找到你</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">立即发布</button>
          </div>
        ) : (
          <div className="space-y-3">
            {myRecruitments.map(r => {
              const st = STATUS_LABELS[r.status] || STATUS_LABELS.open
              const isFull = r.current_members >= r.planned_members
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{r.team_name || r.competition_target}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {r.current_members}/{r.planned_members} 人{isFull ? ' · 已满员' : ` · 还差 ${r.planned_members - r.current_members} 人`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{r.competition_target} · {r.description}</p>
                  {(r.required_skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.required_skills.map(s => <span key={s} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{s}</span>)}
                    </div>
                  )}
                  {r.deadline && <p className="text-xs text-gray-400 mt-2">截止：{r.deadline}</p>}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                    {pendingCount(r.id) > 0 && (
                      <button onClick={() => setApplicationsFor(r)}
                        className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 cursor-pointer">
                        收到 {pendingCount(r.id)} 个申请
                      </button>
                    )}
                    {r.status === 'open' && (
                      <>
                        <button onClick={() => changeRecruitStatus(r.id, 'paused')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">暂停</button>
                        <button onClick={() => changeRecruitStatus(r.id, 'completed')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">结束招募</button>
                      </>
                    )}
                    {r.status === 'paused' && (
                      <button onClick={() => changeRecruitStatus(r.id, 'open')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">恢复</button>
                    )}
                    <button onClick={() => setEditingRecruitment(r)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">编辑</button>
                    <button onClick={() => { if (window.confirm('确定删除该招募吗？')) void deleteRecruitment(r.id) }} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer">删除</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 我的申请 */}
      {myApplications.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">我的申请</h2>
          <div className="space-y-2">
            {myApplications.slice(0, 10).map(app => {
              const st = app.status === 'pending' ? { label: '待处理', cls: 'bg-amber-100 text-amber-700' }
                : app.status === 'accepted' ? { label: '已接受', cls: 'bg-green-100 text-green-700' }
                : app.status === 'rejected' ? { label: '未通过', cls: 'bg-red-100 text-red-600' }
                : { label: '已撤回', cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {app.recruitment?.team_name || app.recruitment?.competition_target || '已删除的招募'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(app.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {app.status === 'pending' && (
                      <button onClick={() => void withdraw(app)} className="text-xs text-gray-500 hover:text-red-600 cursor-pointer">撤回</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 编辑/新建招募 */}
      {(editingRecruitment || showCreate) && (
        <RecruitmentEditor
          initial={editingRecruitment}
          onSave={saveRecruitment}
          onCancel={() => { setEditingRecruitment(null); setShowCreate(false) }}
        />
      )}

      {/* 收到的申请 */}
      {applicationsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">「{applicationsFor.team_name || applicationsFor.competition_target}」的申请</h2>
              <button onClick={() => setApplicationsFor(null)} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
            </div>
            {actionError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm mb-3">{actionError}</div>}
            {ownerApplications.filter(a => a.recruitment_id === applicationsFor.id).length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂时没有组队申请</p>
            ) : (
              <div className="space-y-3">
                {ownerApplications.filter(a => a.recruitment_id === applicationsFor.id).map(app => (
                  <div key={app.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{app.profiles?.display_name || '申请人'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700'
                          : app.status === 'accepted' ? 'bg-green-100 text-green-700'
                          : app.status === 'rejected' ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {app.status === 'pending' ? '待处理' : app.status === 'accepted' ? '已接受' : app.status === 'rejected' ? '已拒绝' : '已撤回'}
                      </span>
                    </div>
                    {app.profiles?.major && <p className="text-xs text-gray-500 mt-0.5">{app.profiles.major}{app.profiles.grade ? ` · ${app.profiles.grade}` : ''}</p>}
                    {(app.profiles?.skills || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {app.profiles!.skills.slice(0, 6).map(s => <span key={s} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{s}</span>)}
                      </div>
                    )}
                    {app.message && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">{app.message}</p>}
                    {app.status === 'pending' && (
                      <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => void respond(app, 'reject')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">拒绝</button>
                        <button onClick={() => void respond(app, 'accept')} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">接受</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
