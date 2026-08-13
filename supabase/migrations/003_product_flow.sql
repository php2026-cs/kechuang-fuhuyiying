-- ============================================================
-- Migration 003: 产品闭环（用户资料扩展 / 组队申请 / 竞赛关注 / 截止提醒）
--
-- 安全原则（与旧快照 00004 的区别）：
-- - 身份唯一真相 = auth.uid()，客户端不能决定 applicant_id / owner_id / user_id
-- - 私人业务表只对 authenticated 授权，禁止匿名全 CRUD
-- - 不开放 USING(true)/WITH CHECK(true) 生产策略
-- - 所有状态变更走 SECURITY DEFINER RPC（search_path 固定、事务内校验）
-- ============================================================

-- 1. profiles 扩展字段
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS competition_interests TEXT[] DEFAULT '{}';

-- ============================================================
-- 2. team_applications（组队申请）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruitment_id UUID NOT NULL REFERENCES public.recruitments(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_recruitment ON public.team_applications(recruitment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_applicant ON public.team_applications(applicant_id, created_at DESC);
-- 同一用户对同一有效招募只能有一个 pending 申请（第二道防线）
CREATE UNIQUE INDEX IF NOT EXISTS uq_apps_pending ON public.team_applications(recruitment_id, applicant_id) WHERE status = 'pending';

ALTER TABLE public.team_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_applications_select" ON public.team_applications;
CREATE POLICY "team_applications_select" ON public.team_applications FOR SELECT USING (
  applicant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.recruitments r WHERE r.id = recruitment_id AND r.user_id = auth.uid())
);
DROP POLICY IF EXISTS "team_applications_insert" ON public.team_applications;
CREATE POLICY "team_applications_insert" ON public.team_applications FOR INSERT WITH CHECK (applicant_id = auth.uid());
-- 状态变更（accepted/rejected/withdrawn）一律通过 RPC，不开放直接 UPDATE/DELETE

GRANT SELECT, INSERT ON public.team_applications TO authenticated;

-- ============================================================
-- 3. competition_follows（竞赛关注）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.competition_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, competition_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user ON public.competition_follows(user_id);

ALTER TABLE public.competition_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.competition_follows;
CREATE POLICY "follows_select" ON public.competition_follows FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "follows_insert" ON public.competition_follows;
CREATE POLICY "follows_insert" ON public.competition_follows FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "follows_update" ON public.competition_follows;
CREATE POLICY "follows_update" ON public.competition_follows FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "follows_delete" ON public.competition_follows;
CREATE POLICY "follows_delete" ON public.competition_follows FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_follows TO authenticated;

-- ============================================================
-- 4. competition_reminders（截止提醒去重记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.competition_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, competition_id, stage)
);

ALTER TABLE public.competition_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_select" ON public.competition_reminders;
CREATE POLICY "reminders_select" ON public.competition_reminders FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reminders_insert" ON public.competition_reminders;
CREATE POLICY "reminders_insert" ON public.competition_reminders FOR INSERT WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.competition_reminders TO authenticated;

-- ============================================================
-- 5. RPC: 申请加入团队
--    身份取自 auth.uid()，不信任客户端传入的 applicant_id / owner_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_to_team(p_recruitment_id UUID, p_message TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.recruitments%ROWTYPE;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '请先登录');
  END IF;

  SELECT * INTO v_rec FROM public.recruitments
    WHERE id = p_recruitment_id AND is_deleted = false
    FOR UPDATE;
  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '招募不存在或已删除');
  END IF;
  IF v_rec.user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '不能申请自己的团队');
  END IF;
  IF v_rec.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', '该招募已暂停或结束');
  END IF;
  IF v_rec.deadline IS NOT NULL AND v_rec.deadline < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'error', '该招募已过期');
  END IF;
  IF v_rec.current_members >= v_rec.planned_members THEN
    RETURN jsonb_build_object('ok', false, 'error', '该团队已满员');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.team_applications
    WHERE recruitment_id = p_recruitment_id AND applicant_id = v_uid AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', '你已经申请过该团队，请等待队长处理');
  END IF;

  INSERT INTO public.team_applications (recruitment_id, applicant_id, message, status)
  VALUES (p_recruitment_id, v_uid, coalesce(p_message, ''), 'pending');

  INSERT INTO public.notifications (user_id, type, title, content)
  VALUES (
    v_rec.user_id,
    'application',
    '收到新的组队申请',
    '有人申请加入你的团队「' || coalesce(v_rec.team_name, v_rec.competition_target) || '」'
  );

  UPDATE public.recruitments SET last_active_at = NOW() WHERE id = p_recruitment_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 6. RPC: 队长接受/拒绝申请（事务内完成，防止并发超员）
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_team_application(p_application_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.team_applications%ROWTYPE;
  v_rec public.recruitments%ROWTYPE;
  v_uid UUID;
  v_new_size INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '请先登录');
  END IF;
  IF p_action NOT IN ('accept', 'reject') THEN
    RETURN jsonb_build_object('ok', false, 'error', '无效操作');
  END IF;

  SELECT * INTO v_app FROM public.team_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '申请不存在');
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', '该申请已处理');
  END IF;

  SELECT * INTO v_rec FROM public.recruitments
    WHERE id = v_app.recruitment_id AND is_deleted = false
    FOR UPDATE;
  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '招募不存在或已删除');
  END IF;
  IF v_rec.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '你不是该招募的队长，无权处理');
  END IF;

  IF p_action = 'accept' THEN
    IF v_rec.status <> 'open' THEN
      RETURN jsonb_build_object('ok', false, 'error', '该招募已暂停或结束');
    END IF;
    IF v_rec.deadline IS NOT NULL AND v_rec.deadline < CURRENT_DATE THEN
      RETURN jsonb_build_object('ok', false, 'error', '该招募已过期');
    END IF;
    IF v_rec.current_members >= v_rec.planned_members THEN
      RETURN jsonb_build_object('ok', false, 'error', '团队已满员，无法接受更多申请');
    END IF;

    v_new_size := v_rec.current_members + 1;
    UPDATE public.recruitments SET
      current_members = v_new_size,
      status = CASE WHEN v_new_size >= v_rec.planned_members THEN 'completed' ELSE 'open' END,
      last_active_at = NOW()
    WHERE id = v_app.recruitment_id;

    UPDATE public.team_applications SET status = 'accepted', updated_at = NOW() WHERE id = p_application_id;

    INSERT INTO public.notifications (user_id, type, title, content)
    VALUES (
      v_app.applicant_id,
      'team',
      '你的组队申请已被接受',
      '「' || coalesce(v_rec.team_name, v_rec.competition_target) || '」已接受你的申请，快去和队长沟通吧'
    );
  ELSE
    UPDATE public.team_applications SET status = 'rejected', updated_at = NOW() WHERE id = p_application_id;

    INSERT INTO public.notifications (user_id, type, title, content)
    VALUES (
      v_app.applicant_id,
      'team',
      '你的组队申请未通过',
      '「' || coalesce(v_rec.team_name, v_rec.competition_target) || '」未通过你的申请，可以再看看其他队伍'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 7. RPC: 撤回自己的 pending 申请
-- ============================================================
CREATE OR REPLACE FUNCTION public.withdraw_team_application(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.team_applications%ROWTYPE;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '请先登录');
  END IF;

  SELECT * INTO v_app FROM public.team_applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '申请不存在');
  END IF;
  IF v_app.applicant_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '只能撤回自己的申请');
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', '该申请已处理，无法撤回');
  END IF;

  UPDATE public.team_applications SET status = 'withdrawn', updated_at = NOW() WHERE id = p_application_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 8. 授权 RPC（仅 authenticated，不允许 anon 调用）
GRANT EXECUTE ON FUNCTION public.apply_to_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_team_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_team_application TO authenticated;

-- ============================================================
-- 9. Realtime（消息 / 通知 / 申请 / 关注）
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_applications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_follows; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 注意：执行后在 Supabase Dashboard → Database → Replication 确认上述表已开启
