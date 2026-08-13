import type { Competition, CompetitionFollow, NotificationRow } from '@/types'

export interface ReminderStage {
  key: string
  label: string
  days: number
}

const STAGES: ReminderStage[] = [
  { key: 'deadline:7', label: '距离校内截止还有 7 天', days: 7 },
  { key: 'deadline:3', label: '距离校内截止还有 3 天', days: 3 },
  { key: 'deadline:1', label: '明天截止', days: 1 },
  { key: 'deadline:0', label: '今天截止', days: 0 },
]

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T23:59:59')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.round((targetDay - today) / 86400000)
}

export function nextSchoolDeadline(comp: Competition): string | null {
  return comp.school_deadline || comp.official_deadline || null
}

/**
 * 幂等检查截止提醒：已关注比赛距离截止 7/3/1/0 天时各生成一次。
 * existingStages 形如 "competitionId:deadline:7"，用于去重。
 */
export function checkCompetitionReminders(
  follows: CompetitionFollow[],
  competitions: Competition[],
  existingStages: string[],
): { notifications: Omit<NotificationRow, 'id' | 'created_at'>[]; newStages: string[] } {
  const notifications: Omit<NotificationRow, 'id' | 'created_at'>[] = []
  const newStages: string[] = []

  for (const follow of follows) {
    if (!follow.reminder_enabled) continue
    const comp = competitions.find(c => c.id === follow.competition_id)
    if (!comp) continue
    const deadline = nextSchoolDeadline(comp)
    if (!deadline) continue
    const days = daysUntil(deadline)
    if (days < 0 || days > 7) continue

    for (const stage of STAGES) {
      if (days !== stage.days) continue
      const key = `${follow.competition_id}:${stage.key}`
      if (existingStages.includes(key)) continue
      newStages.push(key)
      notifications.push({
        user_id: follow.user_id,
        type: 'competition',
        title: `「${comp.name}」${stage.label}`,
        content: `校内截止：${deadline}，别错过报名`,
        is_read: false,
      })
    }
  }

  return { notifications, newStages }
}
