import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Link } from 'react-router-dom'

export default function MessagesPage() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Array<{id: string; other_user: string; last_message: string; created_at: string}>>([])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    async function load() {
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
          .order('created_at', { ascending: false })
          .limit(50)
        setConversations((data || []) as unknown as typeof conversations)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">请先登录查看消息</p>
        <Link to="/login" className="text-blue-600 hover:underline">前往登录</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">消息</h1>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无消息</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div key={conv.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <p className="text-sm font-medium text-gray-900">{conv.other_user || '对话'}</p>
              <p className="text-sm text-gray-500 truncate">{conv.last_message || '暂无消息'}</p>
              <p className="text-xs text-gray-300 mt-1">{new Date(conv.created_at).toLocaleDateString('zh-CN')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
