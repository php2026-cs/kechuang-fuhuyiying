import { describe, expect, it } from 'vitest'

import mig from '../supabase/migrations/005_auth_profile_bootstrap_and_legacy_grants.sql?raw'
import mig006 from '../supabase/migrations/006_fix_user_roles_policy.sql?raw'

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
