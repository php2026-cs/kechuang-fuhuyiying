import { describe, expect, it } from 'vitest'
import { calcSingle, calculatePoints, type PointEntry } from '../src/lib/points'

describe('points', () => {
  it('B类一等奖基础分 37.5', () => {
    expect(calcSingle({ grade: 'B', rank: '一等奖', type: 'sci', isFirst: false, teamSize: 1, myRank: 1 })).toBe(37.5)
  })

  it('>3 人组队按名次打权重', () => {
    expect(calcSingle({ grade: 'B', rank: '一等奖', type: 'sci', isFirst: false, teamSize: 5, myRank: 2 })).toBeCloseTo(37.5 * 0.7)
  })

  it('第一名按高一档计分', () => {
    expect(calcSingle({ grade: 'C', rank: '一等奖', type: 'sci', isFirst: true, teamSize: 1, myRank: 1 })).toBe(37.5)
  })

  it('K 取前 3 项，J 取前 2 项，总分上限 50', () => {
    const entries: PointEntry[] = [
      { grade: 'A', rank: '一等奖' as const, type: 'sci' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'sci' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'sci' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'sci' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'pro' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'pro' as const, isFirst: false, teamSize: 1, myRank: 1 },
      { grade: 'A', rank: '一等奖' as const, type: 'pro' as const, isFirst: false, teamSize: 1, myRank: 1 },
    ]
    const result = calculatePoints(entries)
    expect(result.K).toBe(150)
    expect(result.J).toBe(100)
    expect(result.H).toBe(50)
  })
})
