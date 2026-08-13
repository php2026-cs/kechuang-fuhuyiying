-- ============================================================
-- Migration 004: 安全加固（针对 001/002 历史表的权限收紧）
--
-- 目标：
-- - messages：只有接收者能把 is_read 置为 true；禁止修改 content/sender/receiver/created_at
-- - notifications：用户只能 SELECT 自己的通知并标记已读；禁止改内容、伪造 user_id、直接 INSERT/DELETE
-- - user_roles：普通用户只能读自己的角色，不再暴露全部管理员名单
-- - 显式撤销 Supabase 默认特权可能授予 anon 的宽泛权限（RLS 之外的第二层防护）
--
-- 不重写 001/002，全部通过新 migration 修正。
-- ============================================================

-- ────────────────────────────────────────────
-- 1. messages：收紧 UPDATE
--    旧策略允许 sender 或 receiver 更新整行（可改 content / 伪造已读）。
--    新策略：只有 receiver 能更新，且只能把 is_read 置为 true。
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update_mark_read" ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id AND is_read = true);

-- 列级保护：即使 RLS 通过，也不能通过 UPDATE 改写内容/发送者/接收者/时间
CREATE OR REPLACE FUNCTION public.messages_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'messages: 只能更新已读状态';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_update_guard ON public.messages;
CREATE TRIGGER trg_messages_update_guard BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_update_guard();

-- 显式撤销 Supabase 默认特权可能给 anon 的宽泛权限
REVOKE ALL ON public.messages FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- ────────────────────────────────────────────
-- 2. notifications：只读自己的通知 + 标记已读
--    业务通知一律由 SECURITY DEFINER RPC 写入（003 已实现），客户端不需要 INSERT
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notifications_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications: 只能更新已读状态';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_update_guard ON public.notifications;
CREATE TRIGGER trg_notifications_update_guard BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_update_guard();

-- 客户端不再直接 INSERT 通知（截止提醒已改为服务端 RPC）
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- ────────────────────────────────────────────
-- 3. user_roles：只读自己的角色（管理员可读全部，供后台判断）
--    旧策略 auth.uid() IS NOT NULL 会让任意登录用户读到整个管理员名单
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
);

REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;

-- ============================================================
-- 说明：
-- 003 已对 team_applications / competition_follows / competition_reminders 做同样收紧，
-- 并显式撤销了函数对 PUBLIC/anon 的 EXECUTE。004 只处理 001/002 遗留表。
-- ============================================================
