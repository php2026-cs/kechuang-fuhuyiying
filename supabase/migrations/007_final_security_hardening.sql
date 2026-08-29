-- ============================================================
-- Migration 007: 最终安全加固
--
-- 三部分：
--  1. messages UPDATE guard 最终收紧：客户端 UPDATE 只允许把 is_read 置为 true
--  2. 封存 legacy 高风险表 private_messages / pokes（保留数据，关闭写权限）
--  3. 生产管理员 auth.users metadata -> public.user_roles 安全回填
--
-- 幂等、不删除任何数据、不降低现有 RLS。
-- ============================================================

-- ============================================================
-- 1. messages UPDATE guard 最终收紧
--    唯一允许变化：is_read（且只能向 true；已是 true 的幂等 mark-read 允许）
-- ============================================================
CREATE OR REPLACE FUNCTION public.messages_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 以下字段全部不可变化
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.is_deleted_by_sender IS DISTINCT FROM OLD.is_deleted_by_sender
     OR NEW.is_deleted_by_receiver IS DISTINCT FROM OLD.is_deleted_by_receiver THEN
    RAISE EXCEPTION 'messages: 只能更新已读状态';
  END IF;

  -- is_read 只能向 true 变化（true -> false/null 禁止；true -> true 幂等允许）
  IF NOT (NEW.is_read = true) THEN
    RAISE EXCEPTION 'messages: is_read 只能置为 true';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_update_guard ON public.messages;
CREATE TRIGGER trg_messages_update_guard BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_update_guard();

-- ============================================================
-- 2. 封存 legacy 高风险表 private_messages / pokes
--    仅当表存在时处理（全新安装 001-006 不含这些表，需容错）
--    保留表与全部数据；不 DELETE / TRUNCATE / DROP
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'private_messages' AND c.relkind = 'r') THEN
    ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_all_private_messages" ON public.private_messages;
    REVOKE ALL ON TABLE public.private_messages FROM anon;
    REVOKE ALL ON TABLE public.private_messages FROM authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'pokes' AND c.relkind = 'r') THEN
    ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "allow_all_pokes" ON public.pokes;
    REVOKE ALL ON TABLE public.pokes FROM anon;
    REVOKE ALL ON TABLE public.pokes FROM authenticated;
  END IF;
END $$;

-- competition_bookmarks / conversations / nudges：数据为 0、RLS 已启用、
-- 无 allow_all 全开放策略，本轮不扩大范围。
-- student_roster：保留原表与 policy，不删除。

-- ============================================================
-- 3. 生产管理员 auth.users metadata -> public.user_roles 安全回填
--    只信任服务端 metadata，不接受客户端 user_id；
--    不删除已有 user_roles，不覆盖 moderator 等其他角色。
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE u.raw_app_meta_data ->> 'role' = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;
