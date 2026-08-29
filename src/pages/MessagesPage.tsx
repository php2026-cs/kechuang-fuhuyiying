import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { buildConversations, formatMessageTime } from '@/lib/messageUtils'
import type { ChatMessage, UserProfile } from '@/types'

function ChatView({ messages, myId, peerName, contextTeam, sending, prefill, onSend, onRetry, onBack }: {
  messages: ChatMessage[]
  myId: string
  peerName: string
  contextTeam?: string
  sending: boolean
  prefill?: string
  onSend: (content: string) => void
  onRetry: (content: string) => void
  onBack: () => void
}) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (prefill) setText(prefill)
  }, [prefill])

  const send = () => {
    if (!text.trim() || sending) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: '420px' }}>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col flex-1">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-blue-600 hover:underline cursor-pointer">← 返回</button>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {(peerName || '?')[0]}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{peerName || '对方'}</p>
              {contextTeam && <p className="text-xs text-blue-600">关于：{contextTeam}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">还没有消息，发送第一条吧</div>
          )}
          {messages.map(m => {
            const isMe = m.sender_id === myId
            const isFailed = m.id.startsWith('failed_')
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${isMe ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-200'} ${isFailed ? 'bg-red-500 text-white' : ''}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                    {isFailed ? '发送失败' : formatMessageTime(new Date(m.created_at).getTime())}
                  </p>
                </div>
                {isFailed && (
                  <button onClick={() => onRetry(m.content)} className="mt-1 text-xs text-red-600 hover:underline cursor-pointer">重试发送</button>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 bg-white">
          <input
            value={text}
            onChange={e => setText(e.target.value.slice(0, 2000))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="输入消息（Enter 发送，Shift+Enter 换行）"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer text-sm"
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const user = useAuthStore(s => s.user)
  const [searchParams] = useSearchParams()
  const peerParam = searchParams.get('peer')
  const teamParam = searchParams.get('team')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePeer, setActivePeer] = useState<{ id: string; name: string; contextTeam?: string } | null>(null)
  const [prefill, setPrefill] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  const myId = user?.id || ''

  const loadMessages = useCallback(async () => {
    if (!myId) return
    try {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: true })
        .limit(500)
      if (queryError) throw queryError
      setMessages(prev => {
        const merged = [...(data || []) as ChatMessage[]]
        for (const m of prev) {
          if (!merged.some(x => x.id === m.id)) merged.push(m)
        }
        return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      })

      // 批量加载对方昵称（避免 N+1）
      const ids = [...new Set((data || []).flatMap((m: ChatMessage) => m.sender_id === myId ? [m.receiver_id] : [m.sender_id]))]
      if (ids.length > 0) {
        const { data: profData } = await supabase.from('profiles').select('*').in('user_id', ids)
        if (profData) {
          setProfiles(Object.fromEntries((profData as UserProfile[]).map(p => [p.user_id, p])))
        }
      }
    } catch {
      setError('加载消息失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [myId])

  useEffect(() => {
    if (!myId) {
      setLoading(false)
      return
    }
    void loadMessages()

    // 5 秒轮询兜底（Realtime 不可用时仍能收到）
    const timer = setInterval(() => void loadMessages(), 5000)
    return () => clearInterval(timer)
  }, [myId, loadMessages])

  // Realtime（按 id 去重，避免轮询重复）
  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as ChatMessage
        if (row.sender_id !== myId && row.receiver_id !== myId) return
        setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const row = payload.new as ChatMessage
        setMessages(prev => prev.map(m => m.id === row.id ? row : m))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [myId])

  // 从招募进入：?peer=xxx&team=xxx
  useEffect(() => {
    if (peerParam && myId && !activePeer) {
      const name = profiles[peerParam]?.display_name || '对方'
      setActivePeer({ id: peerParam, name, contextTeam: teamParam || undefined })
      setPrefill(teamParam ? `你好，我对你的「${teamParam}」招募感兴趣。` : '')
    }
  }, [peerParam, teamParam, myId, activePeer, profiles])

  // 打开会话时标记已读
  useEffect(() => {
    if (!activePeer || !myId) return
    void supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', activePeer.id)
      .eq('receiver_id', myId)
      .eq('is_read', false)
    setMessages(prev => prev.map(m =>
      m.sender_id === activePeer.id && m.receiver_id === myId ? { ...m, is_read: true } : m
    ))
  }, [activePeer, myId])

  const conversations = useMemo(() => {
    const map = buildConversations(myId, messages)
    for (const [peerId, conv] of map) {
      conv.peerName = profiles[peerId]?.display_name || '对方'
    }
    return Array.from(map.values()).sort((a, b) => b.lastTime - a.lastTime)
  }, [myId, messages, profiles])

  const activeMessages = useMemo(() => {
    if (!activePeer) return []
    const conv = buildConversations(myId, messages).get(activePeer.id)
    return conv?.messages || []
  }, [activePeer, myId, messages])

  const handleSend = async (content: string) => {
    if (!activePeer || !myId || sending) return
    if (content.length > 2000) {
      setToast('消息过长，最多 2000 字')
      return
    }
    setSending(true)
    const temp: ChatMessage = {
      id: 'temp_' + Date.now(),
      sender_id: myId,
      receiver_id: activePeer.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, temp])
    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({ sender_id: myId, receiver_id: activePeer.id, content })
        .select()
        .single()
      if (insertError) throw insertError
      const sent = data as ChatMessage
      setMessages(prev => prev.map(m => m.id === temp.id ? sent : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === temp.id ? { ...m, id: 'failed_' + Date.now() } : m))
      setToast('发送失败，请重试')
    } finally {
      setSending(false)
    }
  }

  const handleRetry = (content: string) => {
    setMessages(prev => prev.filter(m => !(m.id.startsWith('failed_') && m.content === content)))
    void handleSend(content)
  }

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2600)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">请先登录查看消息</p>
        <Link to="/login" className="text-blue-600 hover:underline">前往登录</Link>
      </div>
    )
  }

  if (activePeer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ChatView
          messages={activeMessages}
          myId={myId}
          peerName={activePeer.name}
          contextTeam={activePeer.contextTeam}
          sending={sending}
          prefill={prefill}
          onSend={handleSend}
          onRetry={handleRetry}
          onBack={() => { setActivePeer(null); setPrefill('') }}
        />
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm shadow-lg">{toast}</div>
        )}
      </div>
    )
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">消息</h1>
      <p className="text-sm text-gray-500 mb-6">
        {totalUnread > 0 ? `${totalUnread} 条未读消息` : '与匹配到的队友沟通'}
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm mb-4">
          {error}
          <button onClick={() => void loadMessages()} className="ml-2 text-blue-600 hover:underline cursor-pointer">重试</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">暂无消息</p>
          <p className="text-sm text-gray-400 mt-2 mb-4">找到合适的队伍后，可以直接联系队长</p>
          <Link to="/recruit" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 no-underline">寻找队友</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => (
            <button
              key={conv.peerId}
              onClick={() => setActivePeer({ id: conv.peerId, name: conv.peerName })}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{conv.peerName}</p>
                <div className="flex items-center gap-2">
                  {conv.unread > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center px-1">
                      {conv.unread > 99 ? '99+' : conv.unread}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">{formatMessageTime(conv.lastTime)}</span>
                </div>
              </div>
              <p className={`text-sm truncate mt-0.5 ${conv.unread > 0 ? 'text-gray-800' : 'text-gray-500'}`}>
                {conv.lastMessage || '开始聊天'}
              </p>
            </button>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm shadow-lg">{toast}</div>
      )}
    </div>
  )
}
