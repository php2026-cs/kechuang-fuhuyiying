import { supabase } from '@/lib/supabase'
import type { NotificationRow } from '@/types'

function rowToNotification(row: Record<string, unknown>): NotificationRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: (row.type as string) || 'system',
    title: (row.title as string) || '',
    content: (row.content as string) || '',
    is_read: (row.is_read as boolean) || false,
    created_at: (row.created_at as string) || new Date().toISOString(),
  }
}

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(rowToNotification)
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
}
