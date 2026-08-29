-- ============================================================
-- Migration 008: 修复 messages_update_guard 的 NULL 边界问题
-- 007 中旧实现对 NEW.is_read 的等值判断在 NULL 时
-- 表达式结果为 NULL，PL/pgSQL 的 IF NULL 不会进入 THEN，
-- guard 没有独立、明确地拒绝 NULL。
-- 008 改为 NEW.is_read IS DISTINCT FROM TRUE：
--   - false -> true：允许
--   - true  -> true：允许（幂等 mark-read）
--   - true  -> false：禁止
--   - true  -> NULL：禁止
-- 不改 trigger 名称，不改现有 RLS，不新增权限，不降低安全约束。
-- ============================================================

CREATE OR REPLACE FUNCTION public.messages_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.is_deleted_by_sender IS DISTINCT FROM OLD.is_deleted_by_sender
     OR NEW.is_deleted_by_receiver IS DISTINCT FROM OLD.is_deleted_by_receiver THEN
    RAISE EXCEPTION 'messages: 只能更新已读状态';
  END IF;

  IF NEW.is_read IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'messages: is_read 只能置为 true';
  END IF;

  RETURN NEW;
END;
$$;
