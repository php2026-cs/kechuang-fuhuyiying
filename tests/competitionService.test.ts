import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}))

import { toggleFollow } from '@/lib/competitionService'

function mockQuery(result: { error: unknown }) {
  const insert = vi.fn(async () => result)
  const del = vi.fn()
  const eq = vi.fn(async () => result)
  const query = { insert, delete: del, eq }
  del.mockImplementation(() => query)
  supabaseMocks.from.mockReturnValue(query)
  return query
}

describe('toggleFollow', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
  })

  it('inserts competition_id AND user_id when following (RLS requires user_id = auth.uid())', async () => {
    const query = mockQuery({ error: null })
    const ok = await toggleFollow('comp-1', false, 'user-1')
    expect(ok).toBe(true)
    expect(query.insert).toHaveBeenCalledWith({ competition_id: 'comp-1', user_id: 'user-1' })
  })

  it('deletes by competition_id when unfollowing (RLS restricts to own rows)', async () => {
    const query = mockQuery({ error: null })
    const ok = await toggleFollow('comp-1', true, 'user-1')
    expect(ok).toBe(true)
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('competition_id', 'comp-1')
  })

  it('returns false when insert fails', async () => {
    const query = mockQuery({ error: { message: 'boom' } })
    const ok = await toggleFollow('comp-1', false, 'user-1')
    expect(ok).toBe(false)
    expect(query.insert).toHaveBeenCalledWith({ competition_id: 'comp-1', user_id: 'user-1' })
  })
})
