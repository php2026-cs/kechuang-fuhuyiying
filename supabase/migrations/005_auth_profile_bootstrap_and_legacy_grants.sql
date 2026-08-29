-- ============================================================
-- Migration 005: 注册资料由数据库自动创建 + 旧表最小权限补齐
--
-- 背景：开启邮箱确认时，signUp 成功后客户端没有 authenticated session，
-- 直接在 public.profiles 插入会得到 permission denied。
-- 修复：profile 创建改为 auth.users AFTER INSERT trigger 自动完成；
-- 同时对 001 旧表补齐显式最小 GRANT（严格默认权限项目缺少它们）。
-- ============================================================

-- ────────────────────────────────────────────
-- 1. auth.users → profiles 自动创建
--    身份来自 NEW.id（数据库端），不信任客户端传入的 user_id
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'display_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- trigger function 只供数据库内部触发，不暴露给 anon/authenticated 直接执行
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- auth 服务（supabase_auth_admin）执行 auth.users 的写入，需保留 EXECUTE
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ────────────────────────────────────────────
-- 2. 补齐已有 auth.users 但缺 profiles 的用户
--    display_name 优先取 raw_user_meta_data，缺失则为空字符串
-- ────────────────────────────────────────────
INSERT INTO public.profiles (user_id, display_name)
SELECT u.id, coalesce(u.raw_user_meta_data ->> 'display_name', '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ────────────────────────────────────────────
-- 3. 001 旧表最小权限补齐
--    规则：anon 只读公开表；authenticated 仅业务所需写入；
--    任何角色都没有表级 DELETE（删除走软删除 / RPC / 管理员）
-- ────────────────────────────────────────────

-- profiles：公开可读，登录用户可改自己的资料；
-- 不允许客户端 INSERT（注册 profile 由 auth.users trigger 创建）与 DELETE
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- recruitments：公开可读，登录用户可发布/编辑自己的招募，删除走软删除
REVOKE ALL ON public.recruitments FROM anon;
GRANT SELECT ON public.recruitments TO anon;
REVOKE ALL ON public.recruitments FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recruitments TO authenticated;

-- forum_posts：公开可读，登录用户可发帖/编辑自己的帖子，删除走软删除
REVOKE ALL ON public.forum_posts FROM anon;
GRANT SELECT ON public.forum_posts TO anon;
REVOKE ALL ON public.forum_posts FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.forum_posts TO authenticated;

-- forum_replies：公开可读，登录用户可回复/编辑自己的回复，删除走软删除
REVOKE ALL ON public.forum_replies FROM anon;
GRANT SELECT ON public.forum_replies TO anon;
REVOKE ALL ON public.forum_replies FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.forum_replies TO authenticated;

-- competitions：公开只读，客户端不可写
REVOKE ALL ON public.competitions FROM anon;
GRANT SELECT ON public.competitions TO anon;
REVOKE ALL ON public.competitions FROM authenticated;
GRANT SELECT ON public.competitions TO authenticated;

-- ============================================================
-- 说明：
-- - 003/004 的安全措施保持不变（team_applications / competition_reminders
--   仅 RPC 写入；notifications 禁止客户端 INSERT；messages / user_roles 权限不变）
-- - 上述 REVOKE + GRANT 组合可安全重复执行
-- ============================================================
