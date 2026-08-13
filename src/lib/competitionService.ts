import { supabase } from '@/lib/supabase'
import type { CompetitionFollow } from '@/types'

function rowToFollow(row: Record<string, unknown>): CompetitionFollow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    competition_id: row.competition_id as string,
    reminder_enabled: (row.reminder_enabled as boolean) !== false,
    created_at: (row.created_at as string) || new Date().toISOString(),
  }
}

export async function fetchMyFollows(): Promise<CompetitionFollow[]> {
  const { data, error } = await supabase
    .from('competition_follows')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(rowToFollow)
}

export async function toggleFollow(competitionId: string, followed: boolean): Promise<boolean> {
  if (followed) {
    const { error } = await supabase.from('competition_follows').delete().eq('competition_id', competitionId)
    return !error
  }
  const { error } = await supabase.from('competition_follows').insert({ competition_id: competitionId })
  return !error
}

/**
 * 调用服务端 RPC 执行幂等截止提醒检查。
 * 计算、通知写入与去重日志全部在数据库端完成，客户端无法伪造去重记录。
 */
export async function runReminderCheck(): Promise<{ ok: boolean; created?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('check_competition_reminders')
    if (error) return { ok: false, error: error.message }
    const result = data as { ok?: boolean; created?: number; error?: string }
    return { ok: result?.ok === true, created: result?.created, error: result?.error }
  } catch {
    return { ok: false, error: '提醒检查失败' }
  }
}
