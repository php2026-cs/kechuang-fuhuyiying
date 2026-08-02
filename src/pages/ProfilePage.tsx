import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Link } from 'react-router-dom'
import type { UserProfile } from '@/types'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    display_name: '',
    major: '',
    grade: '',
    skills: [] as string[],
    bio: '',
    contact_visibility: 'logged_in' as UserProfile['contact_visibility'],
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        major: profile.major || '',
        grade: profile.grade || '',
        skills: profile.skills || [],
        bio: profile.bio || '',
        contact_visibility: profile.contact_visibility || 'logged_in',
      })
    }
  }, [profile])

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">请先登录</p>
        <Link to="/login" className="text-blue-600 hover:underline">前往登录</Link>
      </div>
    )
  }

  const handleSave = async () => {
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
          display_name: formData.display_name,
          major: formData.major,
          grade: formData.grade,
          skills: formData.skills,
          bio: formData.bio,
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

  const contactVisibilityLabels: Record<string, string> = {
    logged_in: '登录用户可见',
    matched: '匹配成功后可见',
    private: '仅接受站内私信',
    hidden: '完全隐藏',
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">个人资料</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {saveError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{saveError}</div>}
        {saveSuccess && <div className="bg-green-50 text-green-600 px-3 py-2 rounded text-sm">{saveSuccess}</div>}

        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
              <input type="text" value={formData.display_name} onChange={(e) => setFormData({...formData, display_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">专业</label>
              <input type="text" value={formData.major} onChange={(e) => setFormData({...formData, major: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
              <input type="text" value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
              <textarea value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系方式可见范围</label>
              <select
                value={formData.contact_visibility}
                onChange={(e) => setFormData({...formData, contact_visibility: e.target.value as UserProfile['contact_visibility']})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="logged_in">登录用户可见</option>
                <option value="matched">匹配成功后可见</option>
                <option value="private">仅接受站内私信</option>
                <option value="hidden">完全隐藏</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
                {(profile?.display_name || user.email || '?')[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900">{profile?.display_name || '未设置'}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div><span className="text-sm text-gray-400">专业：</span><span className="text-sm text-gray-700">{profile?.major || '未设置'}</span></div>
              <div><span className="text-sm text-gray-400">年级：</span><span className="text-sm text-gray-700">{profile?.grade || '未设置'}</span></div>
              <div><span className="text-sm text-gray-400">简介：</span><span className="text-sm text-gray-700">{profile?.bio || '未设置'}</span></div>
              <div><span className="text-sm text-gray-400">联系方式可见：</span><span className="text-sm text-gray-700">{contactVisibilityLabels[profile?.contact_visibility || 'logged_in']}</span></div>
            </div>
            <button onClick={() => setEditing(true)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 mt-4">编辑资料</button>
          </>
        )}
      </div>
    </div>
  )
}
