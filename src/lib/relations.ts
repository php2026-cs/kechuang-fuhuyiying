import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

export interface OwnerRow {
  user_id?: string | null
  profiles?: UserProfile
}

/**
 * 两阶段加载「行 + 作者/队长 profile」：
 * 1. 收集唯一 user_id
 * 2. 一次 IN 查询 profiles（避免 N+1）
 * 3. 客户端按 user_id merge
 *
 * recruitments/forum 等表的 user_id 指向 auth.users，而 profiles.user_id 也指向
 * auth.users，二者之间没有直接外键，不能使用 PostgREST 嵌套 profiles(*)。
 * profile 缺失时仍然返回原始行，保证列表可显示。
 */
export async function attachOwnerProfiles<T extends OwnerRow>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map(r => r.user_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return rows

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', ids)

  if (error) {
    console.error('[relations] load owner profiles failed:', error)
    return rows
  }

  const byId = new Map<string, UserProfile>()
  for (const p of (data || []) as UserProfile[]) {
    byId.set(p.user_id, p)
  }

  return rows.map(r => ({
    ...r,
    profiles: r.user_id ? byId.get(r.user_id) : undefined,
  }))
}
