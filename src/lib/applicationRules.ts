import type { Recruitment, TeamApplication } from '@/types'

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface CanApplyResult {
  ok: boolean
  reason: string
}

export function isRecruitmentOpen(recruitment: Recruitment): boolean {
  return recruitment.status === 'open' && !recruitment.is_deleted
}

export function isTeamFull(recruitment: Recruitment): boolean {
  return recruitment.current_members >= recruitment.planned_members
}

export function isRecruitmentExpired(recruitment: Recruitment): boolean {
  if (recruitment.status === 'expired') return true
  if (!recruitment.deadline) return false
  const deadline = new Date(recruitment.deadline + 'T23:59:59').getTime()
  return !Number.isNaN(deadline) && deadline < Date.now()
}

/**
 * 申请前的业务规则校验（纯函数）。
 * 数据库 RPC 是第二道保护，前端先检查以提供即时反馈。
 */
export function canApplyToTeam(
  recruitment: Recruitment,
  currentUserId: string | undefined,
  existingApplications: TeamApplication[],
): CanApplyResult {
  if (!currentUserId) return { ok: false, reason: '请先登录后再申请加入' }
  if (recruitment.user_id === currentUserId) return { ok: false, reason: '不能申请自己的团队' }
  if (recruitment.is_deleted) return { ok: false, reason: '该招募已删除' }
  if (!isRecruitmentOpen(recruitment)) {
    return {
      ok: false,
      reason: recruitment.status === 'paused'
        ? '该招募已暂停'
        : recruitment.status === 'completed' || isTeamFull(recruitment)
          ? '该团队已招满'
          : '该招募已过期',
    }
  }
  if (isRecruitmentExpired(recruitment)) return { ok: false, reason: '该招募已过期' }
  if (isTeamFull(recruitment)) return { ok: false, reason: '该团队已满员' }

  const pending = existingApplications.some(
    a => a.recruitment_id === recruitment.id && a.applicant_id === currentUserId && a.status === 'pending',
  )
  if (pending) return { ok: false, reason: '你已经申请过该团队，请等待队长处理' }

  const accepted = existingApplications.some(
    a => a.recruitment_id === recruitment.id && a.applicant_id === currentUserId && a.status === 'accepted',
  )
  if (accepted) return { ok: false, reason: '你已经是该团队成员' }

  return { ok: true, reason: '' }
}

export function validateApplyMessage(message: string): CanApplyResult {
  const trimmed = message.trim()
  if (trimmed.length === 0) return { ok: true, reason: '' }
  if (trimmed.length > 500) return { ok: false, reason: '申请留言最多 500 字' }
  return { ok: true, reason: '' }
}
