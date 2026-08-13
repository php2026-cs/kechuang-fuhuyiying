import { useCallback, useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notificationsService'
import { fetchMyFollows, fetchMyReminderStages, recordReminderStages } from '@/lib/competitionService'
import { checkCompetitionReminders } from '@/lib/deadlineReminders'
import type { Competition, NotificationRow } from '@/types'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, isAdmin, signOut } = useAuthStore()
  const { enabled: demoMode, disable: exitDemo } = useDemoStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [msgUnread, setMsgUnread] = useState(0)

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      return
    }
    try {
      setNotifications(await fetchNotifications())
    } catch {
      // 通知加载失败不阻断页面
    }
  }, [user])

  const loadMsgUnread = useCallback(async () => {
    if (!user) {
      setMsgUnread(0)
      return
    }
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
      setMsgUnread(count || 0)
    } catch {
      // 忽略
    }
  }, [user])

  useEffect(() => {
    void loadNotifications()
    void loadMsgUnread()
    if (!user) return
    const timer = setInterval(() => {
      void loadNotifications()
      void loadMsgUnread()
    }, 10000)
    return () => clearInterval(timer)
  }, [user, loadNotifications, loadMsgUnread])

  // Realtime：新通知/新消息即时到达
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('layout-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as { receiver_id: string }
        if (row.receiver_id === user.id) void loadMsgUnread()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user, loadNotifications, loadMsgUnread])

  // 已关注比赛截止提醒（应用启动时幂等检查；真正 24h 后台提醒需 Edge Function/Cron）
  useEffect(() => {
    if (!user || demoMode) return
    let cancelled = false
    void (async () => {
      try {
        const [follows, stages] = await Promise.all([fetchMyFollows(), fetchMyReminderStages()])
        if (cancelled || follows.length === 0) return
        const { data } = await supabase.from('competitions').select('*')
        const competitions = (data || []) as Competition[]
        const { notifications: newNotifs, newStages } = checkCompetitionReminders(follows, competitions, stages)
        if (newNotifs.length === 0) return
        for (const n of newNotifs) {
          await supabase.from('notifications').insert(n)
        }
        await recordReminderStages(newStages)
        await loadNotifications()
      } catch {
        // 提醒检查失败不影响使用
      }
    })()
    return () => { cancelled = true }
  }, [user, demoMode, loadNotifications])

  const unread = notifications.filter(n => !n.is_read).length

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/recruit', label: '寻找队友' },
    { path: '/messages', label: '消息' },
    { path: '/forum', label: '论坛' },
    { path: '/competition', label: '竞赛' },
  ]

  const handleNotificationClick = (n: NotificationRow) => {
    void markNotificationRead(n.id)
    setNotifOpen(false)
    if (n.type === 'competition') {
      navigate('/competition')
    } else {
      navigate('/profile')
    }
  }

  const navLink = (item: { path: string; label: string }, badge?: number) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={() => { setMobileMenuOpen(false); setUserMenuOpen(false) }}
      className={`px-3 py-1.5 rounded-md text-sm transition-colors no-underline relative ${
        location.pathname === item.path
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {item.label}
      {badge ? (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Demo mode banner */}
      {demoMode && (
        <div className="bg-amber-500 text-white text-center py-1.5 text-sm flex items-center justify-center gap-4">
          <span>演示数据 - 仅用于评审展示</span>
          <button
            onClick={() => { exitDemo(); window.location.reload() }}
            className="underline text-white/90 hover:text-white"
          >
            退出演示
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-blue-700 font-bold text-lg no-underline">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">创</div>
            科创项目孵化营
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => navLink(item, item.path === '/messages' ? msgUnread : undefined))}
            {isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 rounded-md text-sm text-orange-600 hover:bg-orange-50 font-medium no-underline">管理</Link>
            )}
          </nav>

          {/* User area */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="通知"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center px-1">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                        <span className="font-medium text-sm text-gray-900">通知</span>
                        {unread > 0 && (
                          <button onClick={() => void markAllNotificationsRead().then(loadNotifications)} className="text-xs text-blue-600 hover:underline cursor-pointer">全部已读</button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-10">暂无通知</p>
                      ) : (
                        <div className="p-2 space-y-1">
                          {notifications.slice(0, 20).map(n => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${n.is_read ? '' : 'bg-blue-50'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900">{n.title}</span>
                                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                              </div>
                              {n.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>}
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="用户菜单"
                >
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {(profile?.display_name || user.email || '?')[0]}
                  </div>
                  <span className="text-sm text-gray-700 hidden sm:inline">
                    {profile?.display_name || user.email}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline" onClick={() => setUserMenuOpen(false)}>
                        个人资料
                      </Link>
                      <Link to="/messages" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline" onClick={() => setUserMenuOpen(false)}>
                        消息
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" className="block px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 no-underline" onClick={() => setUserMenuOpen(false)}>
                          后台管理
                        </Link>
                      )}
                      <hr className="my-1" />
                      <button
                        onClick={() => { void signOut(); setUserMenuOpen(false); navigate('/') }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 no-underline">登录</Link>
                <Link to="/register" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 no-underline">注册</Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100"
              aria-label="菜单"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen
                  ? <path d="M18 6L6 18M6 6l12 12" />
                  : <path d="M3 12h18M3 6h18M3 18h18" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-2 flex flex-col gap-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-md text-sm no-underline ${
                  location.pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                }`}
              >
                {item.label}{item.path === '/messages' && msgUnread > 0 ? `（${msgUnread}）` : ''}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-md text-sm text-orange-600 no-underline">管理</Link>
            )}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        <p>科创项目孵化营 - 大连理工大学未来技术学院</p>
        <p className="mt-1">竞赛组队，不再靠运气</p>
      </footer>
    </div>
  )
}
