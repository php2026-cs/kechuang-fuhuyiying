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

export async function recordReminderStages(stages: string[]): Promise<void> {
  // stages 形如 "competitionId:deadline:7"
  for (const stage of stages) {
    const [competitionId, key] = stage.split(':')
    if (!competitionId || !key) continue
    await supabase.from('competition_reminders').insert({ competition_id: competitionId, stage: key })
  }
}

export async function fetchMyReminderStages(): Promise<string[]> {
  const { data, error } = await supabase.from('competition_reminders').select('competition_id, stage')
  if (error) return []
  return (data || []).map(r => `${r.competition_id}:${r.stage}`)
}
