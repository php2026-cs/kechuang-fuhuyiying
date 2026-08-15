-- ============================================================
-- Migration 006: 修复 user_roles RLS 无限递归
--
-- 根因：004 的 user_roles_select 策略在 EXISTS 子查询中自引用
-- public.user_roles（同一张表），触发 PostgreSQL 42P17
-- "infinite recursion detected in policy for relation user_roles"，
-- 导致登录后每次 checkAdminStatus 查询都返回 HTTP 500。
--
-- 修复：用 SECURITY DEFINER 的 is_admin() 函数做管理员判断——
-- 函数以 owner 身份执行，RLS 不再递归应用；策略只调用函数。
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role = 'admin'
  )
$$;

-- 仅 authenticated 需要（策略求值时以当前用户身份调用）；
-- 不暴露给 anon / PUBLIC
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 替换自引用的策略
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);

-- 权限保持：authenticated 只读自己的角色（RLS 行级控制）
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
