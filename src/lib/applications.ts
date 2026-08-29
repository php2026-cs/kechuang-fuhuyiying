import { supabase } from '@/lib/supabase'
import { attachOwnerProfiles } from '@/lib/relations'
import type { Recruitment, TeamApplication } from '@/types'

export interface ApplyResult {
  ok: boolean
  error?: string
}

function rowToApplication(row: Record<string, unknown>): TeamApplication {
  return {
    id: row.id as string,
    recruitment_id: row.recruitment_id as string,
    applicant_id: row.applicant_id as string,
    message: (row.message as string) || '',
    status: (row.status as TeamApplication['status']) || 'pending',
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || (row.created_at as string) || new Date().toISOString(),
    recruitment: row.recruitments as Recruitment | undefined,
    profiles: row.profiles as TeamApplication['profiles'],
  }
}

export async function fetchMyApplications(): Promise<TeamApplication[]> {
  const { data, error } = await supabase
    .from('team_applications')
    .select('*, recruitments(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachOwnerProfiles((data || []).map(rowToApplication))
}

export async function fetchRecruitmentApplications(recruitmentId: string): Promise<TeamApplication[]> {
  const { data, error } = await supabase
    .from('team_applications')
    .select('*')
    .eq('recruitment_id', recruitmentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachOwnerProfiles((data || []).map(rowToApplication))
}

export async function fetchApplicationsAsOwner(): Promise<TeamApplication[]> {
  // RLS 只允许队长看到自己招募收到的申请
  const { data, error } = await supabase
    .from('team_applications')
    .select('*, recruitments(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachOwnerProfiles((data || []).map(rowToApplication))
}

export async function applyToTeam(recruitmentId: string, message: string): Promise<ApplyResult> {
  try {
    const { data, error } = await supabase.rpc('apply_to_team', {
      p_recruitment_id: recruitmentId,
      p_message: message.trim(),
    })
    if (error) return { ok: false, error: error.message }
    const result = data as { ok?: boolean; error?: string }
    if (result?.ok) return { ok: true }
    return { ok: false, error: result?.error || '申请失败，请稍后重试' }
  } catch {
    return { ok: false, error: '申请失败，请稍后重试' }
  }
}

export async function respondToTeamApplication(applicationId: string, action: 'accept' | 'reject'): Promise<ApplyResult> {
  try {
    const { data, error } = await supabase.rpc('respond_to_team_application', {
      p_application_id: applicationId,
      p_action: action,
    })
    if (error) return { ok: false, error: error.message }
    const result = data as { ok?: boolean; error?: string }
    if (result?.ok) return { ok: true }
    return { ok: false, error: result?.error || '操作失败，请稍后重试' }
  } catch {
    return { ok: false, error: '操作失败，请稍后重试' }
  }
}

export async function withdrawTeamApplication(applicationId: string): Promise<ApplyResult> {
  try {
    const { data, error } = await supabase.rpc('withdraw_team_application', {
      p_application_id: applicationId,
    })
    if (error) return { ok: false, error: error.message }
    const result = data as { ok?: boolean; error?: string }
    if (result?.ok) return { ok: true }
    return { ok: false, error: result?.error || '撤回失败，请稍后重试' }
  } catch {
    return { ok: false, error: '撤回失败，请稍后重试' }
  }
}
