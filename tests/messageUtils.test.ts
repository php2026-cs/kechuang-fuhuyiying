import { describe, expect, it } from 'vitest'
import { buildConversations } from '../src/lib/messageUtils'
import type { ChatMessage } from '../src/types'

function msg(overrides: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'sender_id' | 'receiver_id' | 'content'>): ChatMessage {
  return {
    is_read: false,
    created_at: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

describe('messageUtils', () => {
  it('按另一位参与者聚合会话', () => {
    const messages = [
      msg({ id: '1', sender_id: 'me', receiver_id: 'b', content: 'hi b' }),
      msg({ id: '2', sender_id: 'b', receiver_id: 'me', content: 'hi me' }),
      msg({ id: '3', sender_id: 'me', receiver_id: 'c', content: 'hi c' }),
    ]
    const convs = buildConversations('me', messages)
    expect(convs.size).toBe(2)
    expect(convs.get('b')?.messages.length).toBe(2)
    expect(convs.get('c')?.messages.length).toBe(1)
  })

  it('最后一条消息与时间正确', () => {
    const messages = [
      msg({ id: '1', sender_id: 'me', receiver_id: 'b', content: '第一条', created_at: new Date(2026, 0, 1, 10).toISOString() }),
      msg({ id: '2', sender_id: 'b', receiver_id: 'me', content: '最新一条', created_at: new Date(2026, 0, 1, 11).toISOString() }),
    ]
    const conv = buildConversations('me', messages).get('b')!
    expect(conv.lastMessage).toBe('最新一条')
    expect(conv.lastTime).toBe(new Date(2026, 0, 1, 11).getTime())
  })

  it('未读数只统计对方发来的未读消息', () => {
    const messages = [
      msg({ id: '1', sender_id: 'b', receiver_id: 'me', content: '未读', is_read: false }),
      msg({ id: '2', sender_id: 'b', receiver_id: 'me', content: '已读', is_read: true }),
      msg({ id: '3', sender_id: 'me', receiver_id: 'b', content: '自己发的', is_read: false }),
    ]
    expect(buildConversations('me', messages).get('b')?.unread).toBe(1)
  })

  it('按最后消息时间排序', () => {
    const messages = [
      msg({ id: '1', sender_id: 'b', receiver_id: 'me', content: '较早', created_at: new Date(2026, 0, 1).toISOString() }),
      msg({ id: '2', sender_id: 'c', receiver_id: 'me', content: '较晚', created_at: new Date(2026, 0, 3).toISOString() }),
    ]
    const sorted = Array.from(buildConversations('me', messages).values()).sort((a, b) => b.lastTime - a.lastTime)
    expect(sorted[0].peerId).toBe('c')
  })
})
