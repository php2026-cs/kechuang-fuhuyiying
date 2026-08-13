import type { Recruitment, UserProfile, MatchFilters, MatchResult } from '@/types'

// 匹配评分权重配置 - 集中管理
const WEIGHTS = {
  SAME_COMPETITION: 30,
  SKILL_MATCH_MY_NEEDS: 25,
  SKILL_MATCH_THEIR_NEEDS: 20,
  MAJOR_COMPLEMENT: 10,
  RECRUIT_COMPLETENESS: 5,
  RECRUIT_ACTIVE: 5,
  RECENT_ACTIVITY: 5,
}

const MAX_SCORE = 100

function normalizeSkills(skills: string[]): string[] {
  return skills.map(s => s.trim().toLowerCase()).filter(Boolean)
}

function overlapScore(myNeeds: string[], theirSkills: string[]): number {
  const needs = normalizeSkills(myNeeds)
  const skills = normalizeSkills(theirSkills)
  if (needs.length === 0) return 0
  const matched = needs.filter(n => skills.includes(n)).length
  return matched / needs.length
}

function overlapScoreReverse(mySkills: string[], theirNeeds: string[]): number {
  const skills = normalizeSkills(mySkills)
  const needs = normalizeSkills(theirNeeds)
  if (needs.length === 0) return 0
  const matched = needs.filter(n => skills.includes(n)).length
  return matched / needs.length
}

function majorComplement(myMajor: string, theirMajor: string): number {
  const m1 = myMajor.trim().toLowerCase()
  const m2 = theirMajor.trim().toLowerCase()
  if (!m1 || !m2) return 0
  // 不同专业视为互补
  return m1 !== m2 ? 1 : 0
}

function completenessScore(recruitment: Recruitment): number {
  let score = 0
  if (recruitment.competition_target) score += 0.25
  if (recruitment.description && recruitment.description.length > 20) score += 0.25
  if (recruitment.required_skills.length > 0) score += 0.25
  if (recruitment.availability) score += 0.25
  return score
}

function isRecruitActive(recruitment: Recruitment): number {
  if (recruitment.is_deleted) return 0
  if (recruitment.status === 'expired') return 0
  if (recruitment.status === 'open') return 1
  return 0.5
}

function recentActivityScore(lastActiveAt: string): number {
  const now = Date.now()
  const lastActive = new Date(lastActiveAt).getTime()
  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24)
  if (daysSinceActive <= 1) return 1
  if (daysSinceActive <= 7) return 0.7
  if (daysSinceActive <= 30) return 0.4
  return 0.1
}

export function calculateMatch(
  recruitment: Recruitment,
  filters: MatchFilters,
  userProfile?: UserProfile
): MatchResult {
  // 已删除或已过期的招募不参与推荐
  if (recruitment.is_deleted) {
    return {
      recruitment,
      score: 0,
      reasons: [],
      sharedCompetitions: [],
      complementarySkills: [],
      unmetConditions: ['招募已删除'],
      lastActive: recruitment.last_active_at || recruitment.created_at,
    }
  }
  if (recruitment.status === 'expired') {
    return {
      recruitment,
      score: 0,
      reasons: [],
      sharedCompetitions: [],
      complementarySkills: [],
      unmetConditions: ['招募已过期'],
      lastActive: recruitment.last_active_at || recruitment.created_at,
    }
  }

  const reasons: string[] = []
  const unmetConditions: string[] = []
  const sharedCompetitions: string[] = []
  const complementarySkills: string[] = []

  let totalScore = 0

  // 1. 目标赛事是否一致
  const competitionMatch = filters.competition.value
    ? recruitment.competition_target?.toLowerCase().includes(filters.competition.value.toLowerCase())
    : false
  if (competitionMatch) {
    totalScore += WEIGHTS.SAME_COMPETITION
    reasons.push(`你们都计划参加「${filters.competition.value}」`)
    sharedCompetitions.push(filters.competition.value)
  } else if (filters.competition.requirement === 'must') {
    unmetConditions.push('目标赛事不一致')
  }

  // 2. 对方技能是否满足我的需求
  const skillMatchMyNeeds = overlapScore(filters.required_skills.value, recruitment.required_skills)
  if (skillMatchMyNeeds > 0) {
    const score = Math.round(skillMatchMyNeeds * WEIGHTS.SKILL_MATCH_MY_NEEDS)
    totalScore += score
    const matched = filters.required_skills.value.filter(s =>
      recruitment.required_skills.map(r => r.toLowerCase()).includes(s.toLowerCase())
    )
    reasons.push(`对方具备${matched.join('、')}能力`)
  } else if (filters.required_skills.requirement === 'must') {
    unmetConditions.push('对方不具备所需技能')
  }

  // 3. 我的技能是否满足对方需求
  if (userProfile && userProfile.skills) {
    const skillMatchTheirNeeds = overlapScoreReverse(userProfile.skills, recruitment.required_skills)
    if (skillMatchTheirNeeds > 0) {
      const score = Math.round(skillMatchTheirNeeds * WEIGHTS.SKILL_MATCH_THEIR_NEEDS)
      totalScore += score
      const matched = recruitment.required_skills.filter(s =>
        userProfile.skills.map(r => r.toLowerCase()).includes(s.toLowerCase())
      )
      reasons.push(`你具备对方需要的${matched.join('、')}能力`)
      complementarySkills.push(...matched)
    }
  }

  // 4. 专业互补
  if (userProfile) {
    const majorComp = majorComplement(userProfile.major, recruitment.profiles?.major || '')
    if (majorComp > 0) {
      totalScore += WEIGHTS.MAJOR_COMPLEMENT
      reasons.push('专业方向互补')
    }
  }

  // 5. 招募信息完整度
  const completeness = completenessScore(recruitment)
  totalScore += Math.round(completeness * WEIGHTS.RECRUIT_COMPLETENESS)

  // 6. 招募是否仍然有效
  const activeScore = isRecruitActive(recruitment)
  totalScore += Math.round(activeScore * WEIGHTS.RECRUIT_ACTIVE)

  // 7. 最近活跃时间
  const activityScore = recentActivityScore(recruitment.last_active_at || recruitment.created_at)
  totalScore += Math.round(activityScore * WEIGHTS.RECENT_ACTIVITY)

  // 必须条件不满足时，大幅降低评分
  if (unmetConditions.length > 0) {
    totalScore = Math.min(totalScore, 30)
  }

  return {
    recruitment,
    score: Math.min(totalScore, MAX_SCORE),
    reasons,
    sharedCompetitions,
    complementarySkills,
    unmetConditions,
    lastActive: recruitment.last_active_at || recruitment.created_at,
  }
}

export function rankMatches(results: MatchResult[]): MatchResult[] {
  return results
    .filter(r => r.recruitment.status !== 'expired' && !r.recruitment.is_deleted)
    .sort((a, b) => b.score - a.score)
}
