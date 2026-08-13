// 积分计算（集中规则，结果仅供参考，以学院当年正式文件为准）

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'
export type Rank = '一等奖' | '二等奖' | '三等奖' | '参与奖'
export type EntryType = 'sci' | 'pro'

export interface PointEntry {
  grade: Grade
  rank: Rank
  type: EntryType
  isFirst: boolean
  teamSize: number
  myRank: number
}

export const SCORE_TABLE: Record<Grade, Partial<Record<Rank, number>>> = {
  A: { 一等奖: 50, 二等奖: 40, 三等奖: 30, 参与奖: 10 },
  B: { 一等奖: 37.5, 二等奖: 30, 三等奖: 20, 参与奖: 7.5 },
  C: { 一等奖: 25, 二等奖: 20, 三等奖: 15, 参与奖: 5 },
  D: { 一等奖: 15, 二等奖: 12, 三等奖: 8, 参与奖: 3 },
  E: { 一等奖: 10, 二等奖: 8, 三等奖: 5, 参与奖: 2 },
}

// >3 人组队时按排名打权重
export const TEAM_WEIGHTS = [1, 0.7, 0.5, 0.2]

// 科技创新类最多取 3 项（K），专业素养类最多取 2 项（J）
export const MAX_SCI = 3
export const MAX_PRO = 2
export const SCORE_CAP = 50

const GRADE_UP: Record<Grade, Grade> = { A: 'A', B: 'A', C: 'B', D: 'C', E: 'D' }

export function calcSingle(entry: PointEntry): number {
  let base = SCORE_TABLE[entry.grade][entry.rank] ?? 0
  // 第一名（冠军）奖励：按高一档计分
  if (entry.isFirst) {
    const upper = SCORE_TABLE[GRADE_UP[entry.grade]][entry.rank] ?? base
    base = upper
  }
  if (entry.teamSize <= 3) return base
  const weight = TEAM_WEIGHTS[Math.min(Math.max(entry.myRank - 1, 0), TEAM_WEIGHTS.length - 1)] ?? 0.2
  return base * weight
}

export function calculatePoints(entries: PointEntry[]): { K: number; J: number; H: number } {
  const sci = entries
    .filter(e => e.type === 'sci')
    .map(calcSingle)
    .sort((a, b) => b - a)
    .slice(0, MAX_SCI)
  const pro = entries
    .filter(e => e.type === 'pro')
    .map(calcSingle)
    .sort((a, b) => b - a)
    .slice(0, MAX_PRO)

  const K = sci.reduce((s, v) => s + v, 0)
  const J = pro.reduce((s, v) => s + v, 0)
  return { K, J, H: Math.min(K + J, SCORE_CAP) }
}
