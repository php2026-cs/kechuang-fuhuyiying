import { useCallback, useEffect, useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { ForumPost, ForumReply } from '@/types'

const CATEGORIES = ['全部', '经验分享', '技术讨论', '组队邀请', '赛事讨论', '其他']

function PostCard({ post, replyCount, onOpen, onDelete }: {
  post: ForumPost
  replyCount: number
  onOpen: () => void
  onDelete: () => void
}) {
  const user = useAuthStore(s => s.user)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
    >
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
        <span className="text-xs text-gray-400">{replyCount} 条回复</span>
        {user && user.id === post.user_id && (
          <span onClick={e => e.stopPropagation()}>
            {confirmDelete ? (
              <span className="text-xs">
                <span className="text-red-500 mr-2">确认删除？</span>
                <button onClick={onDelete} className="text-red-600 hover:underline cursor-pointer">确认</button>
                <button onClick={() => setConfirmDelete(false)} className="text-gray-400 hover:underline ml-2 cursor-pointer">取消</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">删除</button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

function PostDetail({ post, replies, onClose, onAddReply, onDeleteReply }: {
  post: ForumPost
  replies: ForumReply[]
  onClose: () => void
  onAddReply: (content: string) => Promise<void>
  onDeleteReply: (replyId: string) => void
}) {
  const user = useAuthStore(s => s.user)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onAddReply(content.trim())
      setContent('')
    } catch {
      setError('回复失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{post.category}</span>
              <span>{post.profiles?.display_name || '匿名'}</span>
              <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded cursor-pointer" aria-label="关闭">✕</button>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">{post.content}</p>

          {/* 回复输入 */}
          {user ? (
            <div className="mb-6">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value.slice(0, 2000))}
                rows={3}
                maxLength={2000}
                placeholder={`以 ${user.email} 的身份回复...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit() }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">Ctrl/Cmd + Enter 快捷发送</span>
                <button onClick={() => void submit()} disabled={!content.trim() || submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {submitting ? '回复中...' : '回复'}
                </button>
              </div>
              {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-6 text-center">登录后参与回复讨论</p>
          )}

          {/* 回复列表 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{replies.length} 条回复</h3>
            {replies.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">还没有回复</p>
            ) : (
              <div className="space-y-3">
                {replies.map(reply => (
                  <div key={reply.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                      <span className="font-medium text-gray-700">{reply.profiles?.display_name || '匿名'}</span>
                      <span>{new Date(reply.created_at).toLocaleString('zh-CN')}</span>
                      {user && (user.id === reply.user_id) && (
                        <button onClick={() => onDeleteReply(reply.id)} className="ml-auto text-gray-400 hover:text-red-500 cursor-pointer">删除</button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ForumPage() {
  const user = useAuthStore(s => s.user)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [replies, setReplies] = useState<ForumReply[]>([])
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
  const [viewingPost, setViewingPost] = useState<ForumPost | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('forum_posts')
        .select('*, profiles(*)')
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (category !== '全部') query = query.eq('category', category)
      if (search.trim()) query = query.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`)

      const { data, error: queryError } = await query
      if (queryError) throw queryError
      setPosts((data || []) as ForumPost[])

      // 批量加载回复，用于真实回复计数
      const ids = (data || []).map((p: ForumPost) => p.id)
      if (ids.length > 0) {
        const { data: replyData } = await supabase
          .from('forum_replies')
          .select('*, profiles(*)')
          .eq('is_deleted', false)
          .in('post_id', ids)
        setReplies((replyData || []) as ForumReply[])
      } else {
        setReplies([])
      }
    } catch {
      setError('加载论坛失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => { void loadPosts() }, [loadPosts])

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
      await loadPosts()
    } catch {
      setCreateError('发布失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('forum_posts').update({ is_deleted: true }).eq('id', id)
      if (deleteError) throw deleteError
      if (viewingPost?.id === id) setViewingPost(null)
      await loadPosts()
    } catch {
      setError('删除失败，请重试')
    }
  }

  const addReply = async (content: string) => {
    if (!user || !viewingPost) return
    const { error } = await supabase.from('forum_replies').insert({
      post_id: viewingPost.id,
      user_id: user.id,
      content,
    })
    if (error) throw error
    await loadPosts()
    // 刷新当前详情
    const updated = posts.find(p => p.id === viewingPost.id)
    if (updated) setViewingPost(updated)
  }

  const deleteReply = async (replyId: string) => {
    try {
      await supabase.from('forum_replies').update({ is_deleted: true }).eq('id', replyId)
      await loadPosts()
    } catch {
      setError('删除回复失败，请重试')
    }
  }

  const replyCount = (postId: string) => replies.filter(r => r.post_id === postId).length
  const viewingReplies = viewingPost ? replies.filter(r => r.post_id === viewingPost.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">论坛</h1>
        {user && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
            发帖
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={e => { e.preventDefault(); void loadPosts() }} className="flex-1 flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索帖子..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 cursor-pointer">搜索</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 text-sm rounded-full border cursor-pointer ${
              category === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">发帖</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{createError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="不超过200字" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容 *</label>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ctrl/Cmd + Enter 发送" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void handleCreate(e) }} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">取消</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">{creating ? '发布中...' : '发布'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => void loadPosts()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">重试</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">{search || category !== '全部' ? '没有找到匹配的帖子' : '还没有帖子'}</p>
          {!search && category === '全部' && user && (
            <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">发布第一个帖子</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              replyCount={replyCount(post.id)}
              onOpen={() => setViewingPost(post)}
              onDelete={() => void handleDelete(post.id)}
            />
          ))}
        </div>
      )}

      {viewingPost && (
        <PostDetail
          post={viewingPost}
          replies={viewingReplies}
          onClose={() => setViewingPost(null)}
          onAddReply={addReply}
          onDeleteReply={replyId => void deleteReply(replyId)}
        />
      )}
    </div>
  )
}
