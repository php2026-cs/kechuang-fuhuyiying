import { useState, useEffect, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { ForumPost } from '@/types'

const CATEGORIES = ['全部', '经验分享', '技术讨论', '组队邀请', '赛事讨论', '其他']

function PostCard({ post, onDelete }: { post: ForumPost; onDelete: (id: string) => void }) {
  const user = useAuthStore((s) => s.user)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      {post.is_pinned && (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mb-2 inline-block">置顶</span>
      )}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <span>{post.category}</span>
        <span>·</span>
        <span>{post.profiles?.display_name || '匿名'}</span>
        <span>·</span>
        <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-3 mb-3">{post.content}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {post.reply_count || 0} 条回复
        </span>
        {user && user.id === post.user_id && (
          <div>
            {confirmDelete ? (
              <span className="text-xs">
                <span className="text-red-500 mr-2">确认删除？</span>
                <button onClick={() => onDelete(post.id)} className="text-red-600 hover:underline">确认</button>
                <button onClick={() => setConfirmDelete(false)} className="text-gray-400 hover:underline ml-2">取消</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ForumPage() {
  const user = useAuthStore((s) => s.user)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('全部')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('经验分享')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadPosts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('forum_posts')
        .select('*, profiles(*)')
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (category !== '全部') {
        query = query.eq('category', category)
      }
      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
      }

      const { data, error: queryError } = await query
      if (queryError) throw queryError
      setPosts((data || []) as ForumPost[])
    } catch {
      setError('加载论坛失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPosts() }, [category])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    loadPosts()
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!user) { setCreateError('请先登录'); return }
    if (!newTitle.trim()) { setCreateError('请输入标题'); return }
    if (newTitle.trim().length > 200) { setCreateError('标题不能超过200字'); return }
    if (!newContent.trim()) { setCreateError('请输入内容'); return }
    if (newContent.trim().length > 10000) { setCreateError('内容不能超过10000字'); return }

    setCreating(true)
    try {
      const { error: insertError } = await supabase.from('forum_posts').insert({
        user_id: user.id,
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        is_pinned: false,
      })
      if (insertError) throw insertError
      setShowCreate(false)
      setNewTitle('')
      setNewContent('')
      loadPosts()
    } catch {
      setCreateError('发布失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('forum_posts').update({ is_deleted: true }).eq('id', id)
      loadPosts()
    } catch {
      // silently fail
    }
  }

  const filteredPosts = posts

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">论坛</h1>
        {user && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            发帖
          </button>
        )}
      </div>

      {/* Search & Category */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索帖子..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">搜索</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              category === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">发帖</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{createError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="不超过200字" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.filter(c => c !== '全部').map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容 *</label>
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ctrl/Cmd + Enter 发送" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCreate(e) }} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{creating ? '发布中...' : '发布'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={loadPosts} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">重试</button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无帖子</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
