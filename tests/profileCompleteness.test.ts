import { describe, expect, it } from 'vitest'
import { calculateProfileCompleteness } from '../src/lib/profileCompleteness'
import type { UserProfile } from '../src/types'

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
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

describe('profileCompleteness', () => {
  it('空资料 → 0%', () => {
    expect(calculateProfileCompleteness(null).percent).toBe(0)
  })

  it('半完整资料（仅专业+技能）', () => {
    const result = calculateProfileCompleteness(baseProfile({
      display_name: '', grade: '', bio: '', availability: '', competition_interests: [],
    }))
    expect(result.percent).toBe(29)
    expect(result.missing.length).toBe(5)
  })

  it('完整资料 → 100%', () => {
    const result = calculateProfileCompleteness(baseProfile())
    expect(result.percent).toBe(100)
    expect(result.missing.length).toBe(0)
  })

  it('百分比稳定可重复', () => {
    expect(calculateProfileCompleteness(baseProfile()).percent).toBe(calculateProfileCompleteness(baseProfile()).percent)
  })
})
