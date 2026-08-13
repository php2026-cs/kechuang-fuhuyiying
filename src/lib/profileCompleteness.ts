import type { ProfileCompleteness, UserProfile } from '@/types'

/**
 * 用户资料完整度（0-100）。
 * 计入：显示名称 / 专业 / 年级 / 技能 / 简介 / 感兴趣的比赛 / 可参与时间
 */
export function calculateProfileCompleteness(profile: UserProfile | null | undefined): ProfileCompleteness {
  if (!profile) {
    return {
      percent: 0,
      missing: ['display_name', 'major', 'grade', 'skills', 'bio', 'competition_interests', 'availability'],
    }
  }

  const missing: string[] = []
  if (!profile.display_name.trim()) missing.push('display_name')
  if (!profile.major.trim()) missing.push('major')
  if (!profile.grade.trim()) missing.push('grade')
  if (!(profile.skills || []).length) missing.push('skills')
  if (!profile.bio.trim()) missing.push('bio')
  if (!(profile.competition_interests || []).length) missing.push('competition_interests')
  if (!(profile.availability || '').trim()) missing.push('availability')

  const total = 7
  const filled = total - missing.length
  return { percent: Math.round((filled / total) * 100), missing }
}

export const COMPLETENESS_LABELS: Record<string, string> = {
  display_name: '显示名称',
  major: '专业',
  grade: '年级',
  skills: '技能',
  bio: '个人简介',
  competition_interests: '感兴趣的比赛',
  availability: '可参与时间',
}
