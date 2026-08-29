import { create } from 'zustand'

// 演示数据 - 虚构且脱敏
const DEMO_RECRUITMENTS = [
  {
    id: 'demo-1',
    user_id: 'demo-user-1',
    competition_name: '挑战杯',
    competition_target: '挑战杯全国大学生课外学术科技作品竞赛',
    team_name: '智能机器人创新队',
    description: '我们团队已有3名成员，包括机械设计和算法方向，现需招募1-2名具有嵌入式开发或PCB设计经验的同学。项目方向：智能巡检机器人。',
    required_skills: ['嵌入式开发', 'PCB设计', 'C/C++'],
    current_members: 3,
    planned_members: 5,
    deadline: '2026-09-15',
    availability: '每周可参与15小时以上',
    status: 'open',
    contact_visibility: 'matched',
    is_deleted: false,
    created_at: '2026-07-20T08:00:00Z',
    updated_at: '2026-08-01T12:00:00Z',
    last_active_at: '2026-08-02T10:30:00Z',
  },
  {
    id: 'demo-2',
    user_id: 'demo-user-2',
    competition_name: '互联网+',
    competition_target: '中国国际大学生创新大赛',
    team_name: '智慧农业数据平台',
    description: '寻找具有前端开发(React)或数据分析(Python)能力的同学。项目是智慧农业数据可视化平台。',
    required_skills: ['React', 'Python', '数据分析'],
    current_members: 2,
    planned_members: 4,
    deadline: '2026-08-30',
    availability: '周末及工作日晚上',
    status: 'open',
    contact_visibility: 'matched',
    is_deleted: false,
    created_at: '2026-07-15T10:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
    last_active_at: '2026-08-02T08:00:00Z',
  },
]

const DEMO_MATCHES = [
  {
    recruitment: DEMO_RECRUITMENTS[0],
    score: 85,
    reasons: ['你们都计划参加挑战杯', '对方具备你需要的嵌入式开发能力', '专业方向互补'],
    sharedCompetitions: ['挑战杯'],
    complementarySkills: ['嵌入式开发', 'PCB设计'],
    unmetConditions: [],
    lastActive: '2026-08-02T10:30:00Z',
  },
  {
    recruitment: DEMO_RECRUITMENTS[1],
    score: 72,
    reasons: ['对方具备你需要的React能力', '你具备对方需要的数据分析能力'],
    sharedCompetitions: [],
    complementarySkills: ['React'],
    unmetConditions: ['目标赛事不一致'],
    lastActive: '2026-08-02T08:00:00Z',
  },
]

export interface DemoApplication {
  id: string
  recruitment_id: string
  message: string
  status: 'pending'
  created_at: string
}

interface DemoState {
  enabled: boolean
  step: number
  matches: typeof DEMO_MATCHES
  recruitments: typeof DEMO_RECRUITMENTS
  applications: DemoApplication[]
  enable: () => void
  disable: () => void
  nextStep: () => void
  prevStep: () => void
  apply: (recruitmentId: string, message: string) => void
}

export const useDemoStore = create<DemoState>((set) => ({
  enabled: localStorage.getItem('demo_mode') === 'true',
  step: 1,
  matches: DEMO_MATCHES,
  recruitments: DEMO_RECRUITMENTS,
  applications: [],
  enable: () => {
    localStorage.setItem('demo_mode', 'true')
    set({ enabled: true, step: 1 })
  },
  disable: () => {
    localStorage.removeItem('demo_mode')
    set({ enabled: false, step: 1 })
  },
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 7) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  apply: (recruitmentId, message) => set((s) => ({
    applications: [
      { id: `demo-app-${Date.now()}`, recruitment_id: recruitmentId, message, status: 'pending', created_at: new Date().toISOString() },
      ...s.applications,
    ],
  })),
}))
