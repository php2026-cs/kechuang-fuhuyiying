// 用户类型
export interface UserProfile {
  id: string
  user_id: string
  display_name: string
  major: string
  grade: string
  skills: string[]
  bio: string
  availability: string
  competition_interests: string[]
  avatar_url?: string
  contact_visibility: 'logged_in' | 'matched' | 'private' | 'hidden'
  created_at: string
  updated_at: string
}

// 资料完整度
export interface ProfileCompleteness {
  percent: number
  missing: string[]
}

// 组队申请
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface TeamApplication {
  id: string
  recruitment_id: string
  applicant_id: string
  message: string
  status: ApplicationStatus
  created_at: string
  updated_at: string
  recruitment?: Recruitment
  profiles?: UserProfile
}

// 站内通知
export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
}

// 竞赛关注
export interface CompetitionFollow {
  id: string
  user_id: string
  competition_id: string
  reminder_enabled: boolean
  created_at: string
}

// 私信消息
export interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

// 论坛帖子（补充字段）
export interface ForumPost {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  is_pinned: boolean
  is_deleted: boolean
  reply_count?: number
  created_at: string
  updated_at: string
  profiles?: UserProfile
}

// 招募状态
// 原类型定义已前置，此处移除重复
export type RecruitStatus = 'open' | 'paused' | 'completed' | 'expired'

// 招募信息
export interface Recruitment {
  id: string
  user_id: string
  competition_name: string
  competition_target: string
  team_name?: string
  description: string
  required_skills: string[]
  current_members: number
  planned_members: number
  deadline: string
  availability: string
  status: RecruitStatus
  contact_visibility: 'logged_in' | 'matched' | 'private' | 'hidden'
  is_deleted: boolean
  created_at: string
  updated_at: string
  last_active_at: string
  profiles?: UserProfile
}

// 匹配条件
export type MatchRequirement = 'must' | 'prefer' | 'any'

export interface MatchFilters {
  competition: { value: string; requirement: MatchRequirement }
  required_skills: { value: string[]; requirement: MatchRequirement }
  my_skills: string[]
  major_complement: MatchRequirement
}

// 匹配结果
export interface MatchResult {
  recruitment: Recruitment
  score: number
  reasons: string[]
  sharedCompetitions: string[]
  complementarySkills: string[]
  unmetConditions: string[]
  lastActive: string
}

// 竞赛类型
export interface Competition {
  id: string
  name: string
  level: string
  description: string
  official_source: string
  suitable_majors: string[]
  registration_start: string
  official_deadline: string
  school_deadline: string
  status: 'normal' | 'closing_soon' | 'due_today' | 'closed'
  updated_at: string
}

// 论坛帖子
export interface ForumPost {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  is_pinned: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  profiles?: UserProfile
  reply_count?: number
}

// 论坛回复
export interface ForumReply {
  id: string
  post_id: string
  user_id: string
  content: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  profiles?: UserProfile
}

// 演示模式状态
export interface DemoState {
  enabled: boolean
  step: number
  data: Record<string, unknown>
}
