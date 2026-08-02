import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Recruitment, ForumPost } from '@/types'

function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const links = [
    { path: '/admin', label: '概览' },
    { path: '/admin/recruitments', label: '招募管理' },
    { path: '/admin/posts', label: '帖子管理' },
    { path: '/admin/users', label: '用户管理' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">后台管理</h1>
      <nav className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`px-4 py-2 rounded-md text-sm no-underline ${
              location.pathname === link.path
                ? 'bg-white shadow text-gray-900 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({ users: 0, recruitments: 0, posts: 0 })
  useEffect(() => {
    async function load() {
      const [{ count: u }, { count: r }, { count: p }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('recruitments').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('forum_posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      ])
      setStats({ users: u || 0, recruitments: r || 0, posts: p || 0 })
    }
    load()
  }, [])

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="text-3xl font-bold text-blue-600">{stats.users}</div>
        <p className="text-sm text-gray-500 mt-1">注册用户</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="text-3xl font-bold text-green-600">{stats.recruitments}</div>
        <p className="text-sm text-gray-500 mt-1">有效招募</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="text-3xl font-bold text-amber-600">{stats.posts}</div>
        <p className="text-sm text-gray-500 mt-1">论坛帖子</p>
      </div>
    </div>
  )
}

function RecruitmentsManager() {
  const [items, setItems] = useState<Recruitment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('recruitments').select('*, profiles(*)').order('created_at', { ascending: false })
      setItems((data || []) as Recruitment[])
      setLoading(false)
    }
    load()
  }, [])

  const togglePin = async (id: string) => {
    await supabase.from('recruitments').update({ is_pinned: true }).eq('id', id)
    // Reload
  }

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">团队名称</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">发布者</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-gray-100">
              <td className="px-4 py-3">{item.team_name || '未命名'}</td>
              <td className="px-4 py-3 text-gray-500">{item.profiles?.display_name || '-'}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{item.status}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{new Date(item.created_at).toLocaleDateString('zh-CN')}</td>
              <td className="px-4 py-3">
                <button onClick={() => togglePin(item.id)} className="text-blue-600 hover:underline text-xs">置顶</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PostsManager() {
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('forum_posts').select('*, profiles(*)').order('created_at', { ascending: false })
      setPosts((data || []) as ForumPost[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">作者</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">分类</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">时间</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-t border-gray-100">
              <td className="px-4 py-3">{post.title}</td>
              <td className="px-4 py-3 text-gray-500">{post.profiles?.display_name || '-'}</td>
              <td className="px-4 py-3 text-gray-500">{post.category}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(post.created_at).toLocaleDateString('zh-CN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UsersManager() {
  const [users, setUsers] = useState<Array<{id: string; email: string; created_at: string}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setUsers((data || []) as typeof users)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">显示名称</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">专业</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">年级</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">注册时间</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: Record<string, unknown>) => (
            <tr key={String(u.id)} className="border-t border-gray-100">
              <td className="px-4 py-3">{String(u.display_name || '-')}</td>
              <td className="px-4 py-3 text-gray-500">{String(u.major || '-')}</td>
              <td className="px-4 py-3 text-gray-500">{String(u.grade || '-')}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(String(u.created_at)).toLocaleDateString('zh-CN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">&#128274;</div>
        <p className="text-gray-500 mb-2">权限不足</p>
        <p className="text-sm text-gray-400">您没有访问管理后台的权限</p>
      </div>
    )
  }

  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="recruitments" element={<RecruitmentsManager />} />
        <Route path="posts" element={<PostsManager />} />
        <Route path="users" element={<UsersManager />} />
      </Routes>
    </AdminLayout>
  )
}
