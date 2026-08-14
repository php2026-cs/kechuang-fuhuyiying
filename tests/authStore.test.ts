import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: supabaseMocks.signUp,
    },
    from: supabaseMocks.from,
  },
}))

import { useAuthStore } from '@/stores/authStore'

describe('authStore.signUp', () => {
  beforeEach(() => {
    supabaseMocks.signUp.mockReset()
    supabaseMocks.from.mockReset()
    useAuthStore.setState({
      user: null,
      profile: null,
      isAdmin: false,
      loading: true,
      initialized: false,
    })
  })

  it('calls supabase.auth.signUp with display_name in options.data', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await useAuthStore.getState().signUp('a@example.com', 'password123', '测试用户')

    expect(supabaseMocks.signUp).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@example.com',
      password: 'password123',
      options: expect.objectContaining({
        data: { display_name: '测试用户' },
      }),
    }))
  })

  it('does NOT insert into profiles from the client', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await useAuthStore.getState().signUp('a@example.com', 'password123', '测试用户')

    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('returns the signUp error message and does not touch profiles on failure', async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'signup failed' },
    })
    const result = await useAuthStore.getState().signUp('a@example.com', 'password123', '测试用户')

    expect(result.error).toBe('signup failed')
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })
})
