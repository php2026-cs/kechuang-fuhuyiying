import { describe, it, expect } from 'vitest'
import { calculateMatch, rankMatches } from '../src/lib/matching'
import type { Recruitment, MatchFilters, MatchResult } from '../src/types'

const baseRecruitment: Recruitment = {
  id: 'rec-1',
  user_id: 'user-1',
  competition_name: '挑战杯',
  competition_target: '挑战杯',
  team_name: '测试团队',
  description: '我们需要前端开发和数据分析的同学',
  required_skills: ['前端开发', '数据分析'],
  current_members: 2,
  planned_members: 5,
  deadline: '2026-09-15',
  availability: '周末',
  status: 'open',
  contact_visibility: 'matched',
  is_deleted: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_active_at: new Date().toISOString(),
}

const baseFilters: MatchFilters = {
  competition: { value: '挑战杯', requirement: 'prefer' },
  required_skills: { value: ['前端开发'], requirement: 'prefer' },
  my_skills: ['Python'],
  major_complement: 'prefer',
}

describe('calculateMatch', () => {
  it('should return high score for matching competition and skills', () => {
    const result = calculateMatch(baseRecruitment, baseFilters)
    expect(result.score).toBeGreaterThan(0)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('should include shared competition in reasons', () => {
    const result = calculateMatch(baseRecruitment, baseFilters)
    expect(result.sharedCompetitions).toContain('挑战杯')
  })

  it('should cap score at 100', () => {
    const result = calculateMatch(baseRecruitment, baseFilters)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('should give lower score when competition does not match with must requirement', () => {
    const filters = { ...baseFilters, competition: { value: '互联网+', requirement: 'must' as const } }
    const result = calculateMatch(baseRecruitment, filters)
    expect(result.score).toBeLessThanOrEqual(30)
  })

  it('should return empty reasons for no match', () => {
    const filters: MatchFilters = {
      competition: { value: '互联网+', requirement: 'must' },
      required_skills: { value: [], requirement: 'any' },
      my_skills: [],
      major_complement: 'any',
    }
    const result = calculateMatch(baseRecruitment, filters)
    expect(result.unmetConditions.length).toBeGreaterThan(0)
  })

  it('should produce stable results (deterministic)', () => {
    const r1 = calculateMatch(baseRecruitment, baseFilters)
    const r2 = calculateMatch(baseRecruitment, baseFilters)
    expect(r1.score).toBe(r2.score)
  })

  it('should score zero for deleted recruitments', () => {
    const deleted = { ...baseRecruitment, is_deleted: true }
    const result = calculateMatch(deleted, baseFilters)
    expect(result.score).toBeLessThanOrEqual(10) // low score
  })
})

describe('rankMatches', () => {
  it('should sort by score descending', () => {
    const results: MatchResult[] = [
      { recruitment: baseRecruitment, score: 50, reasons: [], sharedCompetitions: [], complementarySkills: [], unmetConditions: [], lastActive: '' },
      { recruitment: { ...baseRecruitment, id: 'rec-2' }, score: 90, reasons: [], sharedCompetitions: [], complementarySkills: [], unmetConditions: [], lastActive: '' },
      { recruitment: { ...baseRecruitment, id: 'rec-3' }, score: 70, reasons: [], sharedCompetitions: [], complementarySkills: [], unmetConditions: [], lastActive: '' },
    ]
    const ranked = rankMatches(results)
    expect(ranked[0].score).toBe(90)
    expect(ranked[1].score).toBe(70)
    expect(ranked[2].score).toBe(50)
  })

  it('should exclude expired recruitments', () => {
    const expired: MatchResult = {
      recruitment: { ...baseRecruitment, id: 'rec-expired', status: 'expired' },
      score: 90, reasons: [], sharedCompetitions: [], complementarySkills: [], unmetConditions: [], lastActive: ''
    }
    const ranked = rankMatches([expired])
    expect(ranked.length).toBe(0)
  })
})
