import { describe, expect, it } from 'vitest'

import mig from '../supabase/migrations/005_auth_profile_bootstrap_and_legacy_grants.sql?raw'
import mig006 from '../supabase/migrations/006_fix_user_roles_policy.sql?raw'
import mig007 from '../supabase/migrations/007_final_security_hardening.sql?raw'
import mig008 from '../supabase/migrations/008_fix_message_read_guard_null.sql?raw'

describe('migration 005: auth profile bootstrap', () => {
  it('creates an AFTER INSERT trigger on auth.users', () => {
    expect(mig).toContain('AFTER INSERT ON auth.users')
    expect(mig).toContain('on_auth_user_created')
    expect(mig).toContain('EXECUTE FUNCTION public.handle_new_user()')
  })

  it('trigger function is SECURITY DEFINER with a safe search_path', () => {
    const fn = mig.slice(mig.indexOf('FUNCTION public.handle_new_user'))
    expect(fn).toContain('SECURITY DEFINER')
    expect(fn).toContain("SET search_path = ''")
    expect(fn).not.toContain('SET search_path = public')
  })

  it('uses display_name from raw_user_meta_data and ON CONFLICT DO NOTHING', () => {
    expect(mig).toContain("raw_user_meta_data ->> 'display_name'")
    expect(mig).toContain('ON CONFLICT (user_id) DO NOTHING')
  })

  it('revokes direct EXECUTE of the trigger function from PUBLIC/anon/authenticated', () => {
    expect(mig).toContain('REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated')
    expect(mig).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.handle_new_user\(\) TO (anon|authenticated)/)
  })

  it('backfills existing auth.users without a profile', () => {
    expect(mig).toContain('INSERT INTO public.profiles (user_id, display_name)')
    expect(mig).toContain('FROM auth.users u')
    expect(mig).toContain('WHERE NOT EXISTS')
  })
})

describe('migration 005: legacy grants (minimal privilege)', () => {
  it('anon only gets SELECT on legacy public tables', () => {
    for (const table of ['profiles', 'recruitments', 'forum_posts', 'forum_replies', 'competitions']) {
      expect(mig).toContain(`GRANT SELECT ON public.${table} TO anon`)
      expect(mig).not.toMatch(new RegExp(`GRANT (INSERT|UPDATE|DELETE) ON public\\.${table} TO anon`))
    }
  })

  it('authenticated can SELECT/INSERT/UPDATE on other writable tables, never DELETE', () => {
    for (const table of ['recruitments', 'forum_posts', 'forum_replies']) {
      expect(mig).toContain(`GRANT SELECT, INSERT, UPDATE ON public.${table} TO authenticated`)
      const grantLines = mig.split('\n').filter(l => l.includes(`public.${table}`) && l.includes('GRANT'))
      for (const line of grantLines) {
        expect(line).not.toContain('DELETE')
      }
    }
  })

  it('profiles: authenticated is limited to SELECT/UPDATE (no INSERT/DELETE)', () => {
    expect(mig).toContain('GRANT SELECT, UPDATE ON public.profiles TO authenticated')
    expect(mig).not.toMatch(/GRANT (SELECT, )?INSERT.*public\.profiles TO authenticated/)
    const grantLines = mig.split('\n').filter(l => l.includes('public.profiles') && l.includes('GRANT'))
    for (const line of grantLines) {
      expect(line).not.toContain('DELETE')
    }
  })

  it('competitions are read-only for clients', () => {
    expect(mig).toContain('GRANT SELECT ON public.competitions TO authenticated')
    expect(mig).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*public\.competitions TO (authenticated|anon)/)
  })

  it('does not weaken 003/004 protections (no client INSERT on private tables)', () => {
    expect(mig).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*public\.(team_applications|competition_reminders|notifications) TO (anon|authenticated)/)
  })
})

describe('migration 006: user_roles policy recursion fix', () => {
  it('defines is_admin() as SECURITY DEFINER with empty search_path and schema-qualified query', () => {
    expect(mig006).toContain('FUNCTION public.is_admin()')
    expect(mig006).toContain('SECURITY DEFINER')
    expect(mig006).toContain("SET search_path = ''")
    expect(mig006).toContain('SELECT 1 FROM public.user_roles r')
  })

  it('policy references public.is_admin() and no longer self-references user_roles in EXISTS', () => {
    const policy = mig006.slice(mig006.indexOf('CREATE POLICY "user_roles_select"'))
    expect(policy).toContain('public.is_admin()')
    expect(policy).not.toMatch(/SELECT 1 FROM public\.user_roles r WHERE r\.user_id = auth\.uid\(\) AND r\.role = 'admin'/)
  })

  it('function execute is revoked from PUBLIC/anon and granted only to authenticated', () => {
    expect(mig006).toContain('REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon')
    expect(mig006).toContain('GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated')
    expect(mig006).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.is_admin\(\) TO anon/)
  })
})

describe('migration 007: final security hardening', () => {
  const guard = mig007.slice(mig007.indexOf('FUNCTION public.messages_update_guard'))

  it('exists and hardens the message guard (id / flags locked)', () => {
    expect(mig007).toContain('CREATE OR REPLACE FUNCTION public.messages_update_guard()')
    expect(guard).toContain('NEW.id IS DISTINCT FROM OLD.id')
    expect(guard).toContain('NEW.sender_id IS DISTINCT FROM OLD.sender_id')
    expect(guard).toContain('NEW.receiver_id IS DISTINCT FROM OLD.receiver_id')
    expect(guard).toContain('NEW.content IS DISTINCT FROM OLD.content')
    expect(guard).toContain('NEW.created_at IS DISTINCT FROM OLD.created_at')
    expect(guard).toContain('NEW.is_deleted_by_sender IS DISTINCT FROM OLD.is_deleted_by_sender')
    expect(guard).toContain('NEW.is_deleted_by_receiver IS DISTINCT FROM OLD.is_deleted_by_receiver')
  })

  it('only is_read can change and only towards true (no true -> false)', () => {
    expect(guard).toContain('NEW.is_read = true')
    expect(guard).toContain("RAISE EXCEPTION 'messages: is_read \u53EA\u80FD\u7F6E\u4E3A true'")
  })

  it('hardens private_messages and pokes (RLS on, allow_all dropped, grants revoked)', () => {
    expect(mig007).toContain('ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY')
    expect(mig007).toContain('ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY')
    expect(mig007).toContain('DROP POLICY IF EXISTS "allow_all_private_messages" ON public.private_messages')
    expect(mig007).toContain('DROP POLICY IF EXISTS "allow_all_pokes" ON public.pokes')
    expect(mig007).toContain('REVOKE ALL ON TABLE public.private_messages FROM anon')
    expect(mig007).toContain('REVOKE ALL ON TABLE public.private_messages FROM authenticated')
    expect(mig007).toContain('REVOKE ALL ON TABLE public.pokes FROM anon')
    expect(mig007).toContain('REVOKE ALL ON TABLE public.pokes FROM authenticated')
  })

  it('does not DROP/DELETE/TRUNCATE legacy data', () => {
    expect(mig007).not.toMatch(/DROP TABLE (public\.)?(private_messages|pokes)/)
    expect(mig007).not.toMatch(/DELETE FROM (public\.)?(private_messages|pokes)/)
    expect(mig007).not.toMatch(/TRUNCATE (TABLE )?(public\.)?(private_messages|pokes)/)
  })

  it('backfills admin metadata into user_roles with ON CONFLICT DO NOTHING', () => {
    expect(mig007).toContain('INSERT INTO public.user_roles (user_id, role)')
    expect(mig007).toContain('FROM auth.users u')
    expect(mig007).toContain("raw_app_meta_data ->> 'role' = 'admin'")
    expect(mig007).toContain('ON CONFLICT (user_id, role) DO NOTHING')
  })
})

describe('migration 008: message guard NULL boundary fix', () => {
  const guard = mig008.slice(mig008.indexOf('FUNCTION public.messages_update_guard'))

  it('replaces the guard with the NULL-safe is_read check', () => {
    expect(mig008).toContain('CREATE OR REPLACE FUNCTION public.messages_update_guard()')
    expect(guard).toContain('NEW.is_read IS DISTINCT FROM TRUE')
    expect(guard).not.toContain('NOT (NEW.is_read = true)')
    expect(guard).toContain("RAISE EXCEPTION 'messages: \u53EA\u80FD\u66F4\u65B0\u5DF2\u8BFB\u72B6\u6001'")
    expect(guard).toContain("RAISE EXCEPTION 'messages: is_read \u53EA\u80FD\u7F6E\u4E3A true'")
  })

  it('keeps all immutable fields locked', () => {
    expect(guard).toContain('NEW.id IS DISTINCT FROM OLD.id')
    expect(guard).toContain('NEW.sender_id IS DISTINCT FROM OLD.sender_id')
    expect(guard).toContain('NEW.receiver_id IS DISTINCT FROM OLD.receiver_id')
    expect(guard).toContain('NEW.content IS DISTINCT FROM OLD.content')
    expect(guard).toContain('NEW.created_at IS DISTINCT FROM OLD.created_at')
    expect(guard).toContain('NEW.is_deleted_by_sender IS DISTINCT FROM OLD.is_deleted_by_sender')
    expect(guard).toContain('NEW.is_deleted_by_receiver IS DISTINCT FROM OLD.is_deleted_by_receiver')
  })

  it('does not rename/recreate the trigger and adds no grants', () => {
    expect(mig008).not.toContain('CREATE TRIGGER')
    expect(mig008).not.toContain('DROP TRIGGER')
    expect(mig008).not.toMatch(/GRANT|REVOKE/)
  })

  it('covers the is_read transition semantics required by the guard', () => {
    interface MsgRow {
      id: string
      sender_id: string
      receiver_id: string
      content: string
      created_at: string
      is_read: boolean | null
      is_deleted_by_sender: boolean
      is_deleted_by_receiver: boolean
    }

    const base: MsgRow = {
      id: 'm1',
      sender_id: 'u1',
      receiver_id: 'u2',
      content: 'hello',
      created_at: '2026-01-01T00:00:00Z',
      is_read: false,
      is_deleted_by_sender: false,
      is_deleted_by_receiver: false,
    }

    // Model of the 008 guard: immutable fields locked, then is_read must be exactly true.
    const guardBlocks = (oldRow: MsgRow, newRow: MsgRow): boolean => {
      const immutable: Array<keyof Omit<MsgRow, 'is_read'>> = [
        'id',
        'sender_id',
        'receiver_id',
        'content',
        'created_at',
        'is_deleted_by_sender',
        'is_deleted_by_receiver',
      ]
      for (const field of immutable) {
        if (newRow[field] !== oldRow[field]) return true
      }
      return !(newRow.is_read === true)
    }

    // false -> true: allowed
    expect(guardBlocks(base, { ...base, is_read: true })).toBe(false)
    // true -> true: allowed (idempotent mark-read)
    expect(guardBlocks({ ...base, is_read: true }, { ...base, is_read: true })).toBe(false)
    // true -> false: blocked
    expect(guardBlocks({ ...base, is_read: true }, { ...base, is_read: false })).toBe(true)
    // true -> NULL: blocked
    expect(guardBlocks({ ...base, is_read: true }, { ...base, is_read: null })).toBe(true)
    // tampering with is_deleted_by_sender: blocked
    expect(guardBlocks(base, { ...base, is_read: true, is_deleted_by_sender: true })).toBe(true)
    // tampering with is_deleted_by_receiver: blocked
    expect(guardBlocks(base, { ...base, is_read: true, is_deleted_by_receiver: true })).toBe(true)
    // changing the row identity: blocked
    expect(guardBlocks(base, { ...base, is_read: true, id: 'm2' })).toBe(true)
  })
})
