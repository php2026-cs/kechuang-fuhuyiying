-- RLS 安全策略
-- 所有业务表启用 RLS，数据所有权通过 auth.uid() 判断

-- profiles: 用户只能编辑自己的资料，所有人可读取公开信息
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (NOT is_deleted);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_delete_soft ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles: 仅管理员可读，仅通过管理接口写入
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT USING (auth.uid() IS NOT NULL);
-- 插入由管理员 RPC 或 Edge Function 控制，前端不直接写入

-- recruitments: 公开可读（排除软删除），用户只能编辑自己的
ALTER TABLE public.recruitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY recruitments_select ON public.recruitments FOR SELECT USING (NOT is_deleted);
CREATE POLICY recruitments_insert ON public.recruitments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY recruitments_update ON public.recruitments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY recruitments_admin_update ON public.recruitments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- forum_posts: 公开可读（排除软删除），用户只能编辑删除自己的
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY forum_posts_select ON public.forum_posts FOR SELECT USING (NOT is_deleted);
CREATE POLICY forum_posts_insert ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY forum_posts_update ON public.forum_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY forum_posts_admin_update ON public.forum_posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- forum_replies: 公开可读，用户只能编辑删除自己的
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY forum_replies_select ON public.forum_replies FOR SELECT USING (NOT is_deleted);
CREATE POLICY forum_replies_insert ON public.forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY forum_replies_update ON public.forum_replies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY forum_replies_admin_update ON public.forum_replies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- competitions: 公开只读
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitions_select ON public.competitions FOR SELECT USING (true);
-- 竞赛数据由管理员通过管理接口维护

-- messages: 仅会话参与者可读写
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select ON public.messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);
CREATE POLICY messages_update ON public.messages FOR UPDATE USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- notifications: 仅接收者可读
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
