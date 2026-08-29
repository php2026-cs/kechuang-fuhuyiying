import { describe, expect, it } from 'vitest'
import { canApplyToTeam, isRecruitmentExpired, isTeamFull } from '../src/lib/applicationRules'
import type { Recruitment, TeamApplication } from '../src/types'

function makeRecruitment(overrides: Partial<Recruitment> = {}): Recruitment {
  return {
    id: 'r1',
    user_id: 'owner-1',
    competition_name: '挑战杯',
    competition_target: '挑战杯',
    team_name: '测试队',
    description: '我们需要前端和数据分析的同学，欢迎加入。',
    required_skills: ['前端开发'],
    current_members: 1,
    planned_members: 3,
    deadline: '2099-01-01',
    availability: '周末',
    status: 'open',
    contact_visibility: 'matched',
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeApplication(overrides: Partial<TeamApplication> = {}): TeamApplication {
  return {
    id: 'a1',
    recruitment_id: 'r1',
    applicant_id: 'applicant-1',
    message: '你好',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('applicationRules', () => {
  it('未登录不能申请', () => {
    expect(canApplyToTeam(makeRecruitment(), undefined, []).ok).toBe(false)
  })

  it('不能申请自己的团队', () => {
    const r = canApplyToTeam(makeRecruitment({ user_id: 'me' }), 'me', [])
    expect(r.ok).toBe(false)
  })

  it('已完成团队不能申请', () => {
    expect(canApplyToTeam(makeRecruitment({ status: 'completed' }), 'me', []).ok).toBe(false)
  })

  it('满员团队不能申请', () => {
    const rec = makeRecruitment({ current_members: 3, planned_members: 3 })
    expect(isTeamFull(rec)).toBe(true)
    expect(canApplyToTeam(rec, 'me', []).ok).toBe(false)
  })

  it('过期招募不能申请', () => {
    const rec = makeRecruitment({ deadline: '2020-01-01' })
    expect(isRecruitmentExpired(rec)).toBe(true)
    expect(canApplyToTeam(rec, 'me', []).ok).toBe(false)
  })

  it('重复 pending 被阻止', () => {
    const r = canApplyToTeam(makeRecruitment(), 'applicant-1', [makeApplication()])
    expect(r.ok).toBe(false)
  })

  it('已接受后不能继续申请', () => {
    const r = canApplyToTeam(makeRecruitment(), 'applicant-1', [makeApplication({ status: 'accepted' })])
    expect(r.ok).toBe(false)
  })

  it('被拒绝后允许重新申请', () => {
    const r = canApplyToTeam(makeRecruitment(), 'applicant-1', [makeApplication({ status: 'rejected' })])
    expect(r.ok).toBe(true)
  })

  it('正常情况可以申请', () => {
    expect(canApplyToTeam(makeRecruitment(), 'me', []).ok).toBe(true)
  })
})
