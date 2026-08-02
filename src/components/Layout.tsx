import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, isAdmin, signOut } = useAuthStore()
  const { enabled: demoMode, disable: exitDemo } = useDemoStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/recruit', label: '寻找队友' },
    { path: '/forum', label: '论坛' },
    { path: '/competition', label: '竞赛' },
  ]

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
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors no-underline ${
                  location.pathname === item.path
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md text-sm text-orange-600 hover:bg-orange-50 font-medium no-underline"
              >
                管理
              </Link>
            )}
          </nav>

          {/* User area */}
          <div className="flex items-center gap-2">
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
                        onClick={() => { signOut(); setUserMenuOpen(false); navigate('/') }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-md text-sm no-underline ${
                  location.pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                }`}
              >
                {item.label}
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
