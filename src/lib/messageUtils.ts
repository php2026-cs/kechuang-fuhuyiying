import type { ChatMessage } from '@/types'

export interface Conversation {
  peerId: string
  peerName: string
  lastMessage: string
  lastTime: number
  unread: number
  messages: ChatMessage[]
}

/**
 * 将扁平消息列表按「另一位参与者」聚合为会话（纯函数）。
 */
export function buildConversations(myId: string, messages: ChatMessage[]): Map<string, Conversation> {
  const map = new Map<string, Conversation>()
  for (const msg of messages) {
    const isSender = msg.sender_id === myId
    const peerId = isSender ? msg.receiver_id : msg.sender_id
    if (!peerId) continue

    let conv = map.get(peerId)
    if (!conv) {
      conv = { peerId, peerName: '', lastMessage: '', lastTime: 0, unread: 0, messages: [] }
      map.set(peerId, conv)
    }
    conv.messages.push(msg)
    const msgTime = new Date(msg.created_at).getTime()
    if (msgTime > conv.lastTime) {
      conv.lastTime = msgTime
      conv.lastMessage = msg.content
    }
    if (!isSender && !msg.is_read) conv.unread++
  }
  return map
}

export function formatMessageTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const diff = now.getTime() - ts
  if (diff < 7 * 86400000) return d.toLocaleDateString('zh-CN', { weekday: 'short' })
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
