import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}))

import { attachOwnerProfiles, type OwnerRow } from '@/lib/relations'
import type { UserProfile } from '@/types'

type Row = OwnerRow & { id: string }

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'p1',
    user_id: 'u1',
    display_name: '张三',
    major: '软件工程',
    grade: '大二',
    skills: [],
    bio: '',
    availability: '',
    competition_interests: [],
    contact_visibility: 'logged_in',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function mockProfilesQuery(result: { data: unknown; error: unknown }) {
  const select = vi.fn()
  const inFn = vi.fn(async () => result)
  const query = { select, in: inFn }
  select.mockImplementation(() => query)
  supabaseMocks.from.mockReturnValue(query)
  return query
}

describe('attachOwnerProfiles', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
  })

  it('merges profiles by user_id using a single IN query (no N+1)', async () => {
    const query = mockProfilesQuery({
      data: [profile()],
      error: null,
    })

    const rows: Row[] = [
      { id: 'r1', user_id: 'u1' },
      { id: 'r2', user_id: 'u1' },
    ]
    const merged = await attachOwnerProfiles(rows)

    expect(supabaseMocks.from).toHaveBeenCalledTimes(1)
    expect(query.in).toHaveBeenCalledWith('user_id', ['u1'])
    expect(merged[0].profiles?.display_name).toBe('张三')
    expect(merged[1].profiles?.display_name).toBe('张三')
  })

  it('skips the profiles query when there are no owner ids', async () => {
    const rows: Row[] = [{ id: 'r1' }, { id: 'r2' }]
    const merged = await attachOwnerProfiles(rows)
    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(merged).toHaveLength(2)
  })

  it('keeps rows when the profile is missing (list still renders)', async () => {
    mockProfilesQuery({ data: [], error: null })
    const rows: Row[] = [{ id: 'r1', user_id: 'u-missing' }]
    const merged = await attachOwnerProfiles(rows)
    expect(merged).toHaveLength(1)
    expect(merged[0].profiles).toBeUndefined()
  })

  it('returns original rows on profiles query error', async () => {
    mockProfilesQuery({ data: null, error: { message: 'boom' } })
    const rows: Row[] = [{ id: 'r1', user_id: 'u1' }]
    const merged = await attachOwnerProfiles(rows)
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('r1')
  })
})
