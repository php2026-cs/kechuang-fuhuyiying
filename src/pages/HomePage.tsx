import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'

interface Stats {
  activeRecruitments: number
  newRecruitments7d: number
  closingCompetitions: number
  completedTeams: number
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center p-4">
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-6 bg-white rounded-xl border border-gray-100">
      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
        {step}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </div>
  )
}

function HighlightCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-5 bg-white rounded-lg border border-gray-100">
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="font-semibold text-gray-900 text-sm mb-1">{title}</h4>
      <p className="text-gray-500 text-xs">{description}</p>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { enabled: demoMode, enable: enableDemo, matches: demoMatches } = useDemoStore()
  const [stats, setStats] = useState<Stats>({ activeRecruitments: 0, newRecruitments7d: 0, closingCompetitions: 0, completedTeams: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [{ count: activeCount }, { count: newCount }, { count: closingCount }, { count: teamCount }] = await Promise.all([
          supabase.from('recruitments').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_deleted', false),
          supabase.from('recruitments').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', sevenDaysAgo),
          supabase.from('competitions').select('*', { count: 'exact', head: true }).in('status', ['closing_soon', 'due_today']),
          supabase.from('recruitments').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('is_deleted', false),
        ])

        setStats({
          activeRecruitments: activeCount || 0,
          newRecruitments7d: newCount || 0,
          closingCompetitions: closingCount || 0,
          completedTeams: teamCount || 0,
        })
      } catch {
        // 数据加载失败时保持初始值
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                找到互补队友
                <br />
                让竞赛组队不再靠运气
              </h1>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                根据竞赛方向、个人技能和队友需求，为大学生推荐合适的竞赛伙伴，
                并提供竞赛日历、经验交流和积分计算服务。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (demoMode) { navigate('/recruit'); return }
                    if (!user) { navigate('/register'); return }
                    navigate('/recruit')
                  }}
                  className="px-6 py-3 bg-white text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {user ? '发布招募' : '注册并发布招募'}
                </button>
                <button
                  onClick={() => navigate('/recruit')}
                  className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400 transition-colors"
                >
                  寻找队友
                </button>
                <button
                  onClick={() => { enableDemo(); navigate('/recruit') }}
                  className="px-6 py-3 bg-transparent text-blue-100 font-medium rounded-lg border border-blue-400/50 hover:bg-blue-500/30 transition-colors"
                >
                  查看评审演示
                </button>
              </div>
            </div>

            {/* Preview card */}
            <div className="hidden md:block">
              <div className="bg-white text-gray-900 rounded-xl shadow-2xl p-5">
                <div className="text-xs text-amber-600 font-medium mb-2">匹配结果预览</div>
                {demoMode ? (
                  demoMatches.slice(0, 2).map((m, i) => (
                    <div key={i} className={`${i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{m.recruitment.team_name}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          匹配 {m.score}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{m.reasons.join('；')}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <div className="text-3xl mb-2">&#128269;</div>
                    点击"查看评审演示"预览匹配效果
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard value={stats.activeRecruitments} label="有效招募" />
              <StatCard value={stats.newRecruitments7d} label="最近七天新增招募" />
              <StatCard value={stats.closingCompetitions} label="即将截止竞赛" />
              <StatCard value={stats.completedTeams} label="已完成组队" />
            </div>
          )}
        </div>
      </section>

      {/* Three Steps */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">三步完成组队</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard
              step={1}
              title="填写竞赛意向和个人技能"
              description="选择你计划参加的竞赛，列出你掌握的技能和需要的队友类型。"
            />
            <StepCard
              step={2}
              title="获得可解释的队友推荐"
              description="系统根据竞赛方向、技能互补和专业匹配为你推荐最合适的队友。"
            />
            <StepCard
              step={3}
              title="通过站内沟通完成组队"
              description="使用站内私信与推荐队友沟通，确认意向后完成组队。"
            />
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">项目亮点</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <HighlightCard icon="&#127919;" title="竞赛与技能双向匹配" description="同时考虑竞赛目标一致性和技能互补性" />
            <HighlightCard icon="&#128269;" title="可解释推荐结果" description="每项推荐附带详细原因，不只是一个百分比" />
            <HighlightCard icon="&#128197;" title="竞赛信息聚合" description="赛事日历、报名截止提醒、积分计算一站式服务" />
            <HighlightCard icon="&#9889;" title="Supabase 实时数据同步" description="数据实时更新，支持离线草稿和云端同步" />
            <HighlightCard icon="&#128241;" title="响应式移动端体验" description="手机、平板、桌面端均可流畅使用" />
            <HighlightCard icon="&#128274;" title="数据权限保护" description="RLS 行级安全 + Supabase Auth，联系方式可控可见" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">准备好找到你的队友了吗？</h2>
          <p className="text-blue-100 mb-8">
            {profile ? `欢迎回来，${profile.display_name}！查看最新的招募信息或发布你自己的招募。` : '注册账号，填写你的技能和竞赛意向，开始寻找最适合的队友。'}
          </p>
          <div className="flex justify-center gap-3">
            {user ? (
              <>
                <button onClick={() => navigate('/recruit')} className="px-6 py-3 bg-white text-blue-700 font-medium rounded-lg hover:bg-blue-50">发布招募</button>
                <button onClick={() => navigate('/forum')} className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400">浏览论坛</button>
              </>
            ) : (
              <>
                <Link to="/register" className="px-6 py-3 bg-white text-blue-700 font-medium rounded-lg hover:bg-blue-50 no-underline">立即注册</Link>
                <button onClick={() => { enableDemo(); navigate('/recruit') }} className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400">查看评审演示</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
