import { describe, expect, it } from 'vitest'
import { isPristineProfileForm, mergeProfileIntoForm, profileToFormData } from '@/lib/profileForm'
import type { UserProfile } from '@/types'

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'p1',
    user_id: 'u1',
    display_name: '张三',
    major: '软件工程',
    grade: '大二',
    skills: ['React'],
    bio: '热爱前端',
    availability: '周末',
    competition_interests: ['挑战杯'],
    contact_visibility: 'logged_in',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('profileToFormData', () => {
  it('maps all profile fields into the edit form', () => {
    const form = profileToFormData(profile())
    expect(form).toEqual({
      display_name: '张三',
      major: '软件工程',
      grade: '大二',
      skills: ['React'],
      bio: '热爱前端',
      availability: '周末',
      competition_interests: ['挑战杯'],
      contact_visibility: 'logged_in',
    })
  })

  it('returns safe defaults for missing profile', () => {
    const form = profileToFormData(null)
    expect(form).toEqual({
      display_name: '',
      major: '',
      grade: '',
      skills: [],
      bio: '',
      availability: '',
      competition_interests: [],
      contact_visibility: 'logged_in',
    })
  })

  it('is a pure mapping: same input -> same output', () => {
    const p = profile()
    expect(profileToFormData(p)).toEqual(profileToFormData(p))
  })

  it('empty (untouched) form is pristine', () => {
    expect(isPristineProfileForm(profileToFormData(null))).toBe(true)
  })

  it('form with user input is not pristine', () => {
    const form = profileToFormData(null)
    form.skills = ['Python']
    expect(isPristineProfileForm(form)).toBe(false)
  })

  it('merge fills untouched fields from profile', () => {
    const form = profileToFormData(null)
    const merged = mergeProfileIntoForm(form, profile())
    expect(merged.display_name).toBe('张三')
    expect(merged.major).toBe('软件工程')
  })

  it('merge preserves user-typed fields', () => {
    const form = profileToFormData(null)
    form.skills = ['Python']
    form.display_name = '我自己的昵称'
    const merged = mergeProfileIntoForm(form, profile())
    expect(merged.skills).toEqual(['Python'])
    expect(merged.display_name).toBe('我自己的昵称')
    expect(merged.major).toBe('软件工程')
  })
})
