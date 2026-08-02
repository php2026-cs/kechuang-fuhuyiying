import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  loading: boolean
  initialized: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  initialize: () => Promise<void>
  checkAdminStatus: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  initialized: false,

  initialize: async () => {
    // 仅使用 Supabase session，不从 localStorage 读取敏感信息
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user, loading: false, initialized: true })
      await get().refreshProfile()
      await get().checkAdminStatus()
    } else {
      set({ loading: false, initialized: true })
    }

    // 监听 auth 状态变化
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user })
        await get().refreshProfile()
        await get().checkAdminStatus()
      } else {
        set({ user: null, profile: null, isAdmin: false })
      }
    })
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin + '/kechuang-fuhuyiying/',
      },
    })
    if (error) return { error: error.message }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        display_name: displayName,
      })
      if (profileError) return { error: profileError.message }
    }
    return {}
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAdmin: false })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) {
      set({ profile: data as UserProfile })
    }
  },

  checkAdminStatus: async () => {
    const user = get().user
    if (!user) {
      set({ isAdmin: false })
      return false
    }
    // 通过 RPC 或检查 user_roles 表验证管理员身份
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    const isAdmin = !!data
    set({ isAdmin })
    return isAdmin
  },
}))
