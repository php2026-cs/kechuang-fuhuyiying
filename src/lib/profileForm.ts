import type { UserProfile } from '@/types'

export interface ProfileFormData {
  display_name: string
  major: string
  grade: string
  skills: string[]
  bio: string
  availability: string
  competition_interests: string[]
  contact_visibility: UserProfile['contact_visibility']
}

/**
 * profile → 编辑表单 的纯映射。
 * 在打开编辑弹窗时调用，避免 profile 异步刷新（如 auth 状态变化）时
 * 通过 useEffect 重置正在编辑的表单导致输入丢失。
 */
export function profileToFormData(profile: UserProfile | null | undefined): ProfileFormData {
  return {
    display_name: profile?.display_name || '',
    major: profile?.major || '',
    grade: profile?.grade || '',
    skills: profile?.skills || [],
    bio: profile?.bio || '',
    availability: profile?.availability || '',
    competition_interests: profile?.competition_interests || [],
    contact_visibility: profile?.contact_visibility || 'logged_in',
  }
}

/**
 * 表单是否仍为「未编辑」初始状态（用于 profile 异步加载完成后安全回填，
 * 避免覆盖用户已输入的内容）。
 */
export function isPristineProfileForm(form: ProfileFormData): boolean {
  return JSON.stringify(form) === JSON.stringify(profileToFormData(null))
}

/**
 * profile 异步到达后与当前表单合并：
 * 用户已修改的字段保留，未触碰的字段用 profile 补齐。
 * 避免覆盖用户输入，也避免 profile 未加载时表单为空导致保存被校验拦截。
 */
export function mergeProfileIntoForm(
  form: ProfileFormData,
  profile: UserProfile | null | undefined,
): ProfileFormData {
  const pristine = profileToFormData(null)
  const merged: ProfileFormData = { ...profileToFormData(profile) }
  const keepUser = (key: keyof ProfileFormData): boolean =>
    JSON.stringify(form[key]) !== JSON.stringify(pristine[key])

  if (keepUser('display_name')) merged.display_name = form.display_name
  if (keepUser('major')) merged.major = form.major
  if (keepUser('grade')) merged.grade = form.grade
  if (keepUser('skills')) merged.skills = form.skills
  if (keepUser('bio')) merged.bio = form.bio
  if (keepUser('availability')) merged.availability = form.availability
  if (keepUser('competition_interests')) merged.competition_interests = form.competition_interests
  if (keepUser('contact_visibility')) merged.contact_visibility = form.contact_visibility
  return merged
}
