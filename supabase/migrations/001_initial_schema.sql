-- 科创项目孵化营 数据库初始化迁移
-- 注意：花名册数据不出现在此迁移中，仅含业务表结构

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  major TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  contact_visibility TEXT DEFAULT 'logged_in' CHECK (contact_visibility IN ('logged_in', 'matched', 'private', 'hidden')),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户角色表 (用于管理员授权)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 3. 招募信息表
CREATE TABLE IF NOT EXISTS public.recruitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_name TEXT DEFAULT '',
  competition_target TEXT NOT NULL DEFAULT '',
  team_name TEXT,
  description TEXT DEFAULT '',
  required_skills TEXT[] DEFAULT '{}',
  current_members INT DEFAULT 1,
  planned_members INT DEFAULT 4,
  deadline DATE,
  availability TEXT DEFAULT '',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paused', 'completed', 'expired')),
  contact_visibility TEXT DEFAULT 'matched' CHECK (contact_visibility IN ('logged_in', 'matched', 'private', 'hidden')),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 论坛帖子表
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT '经验分享',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 论坛回复表
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 竞赛信息表
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT DEFAULT 'school' CHECK (level IN ('national', 'provincial', 'school')),
  description TEXT DEFAULT '',
  official_source TEXT DEFAULT '',
  suitable_majors TEXT[] DEFAULT '{}',
  registration_start DATE,
  official_deadline DATE,
  school_deadline DATE,
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'closing_soon', 'due_today', 'closed')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 私信表
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted_by_sender BOOLEAN DEFAULT FALSE,
  is_deleted_by_receiver BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 通知表
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_recruitments_user_id ON public.recruitments(user_id);
CREATE INDEX IF NOT EXISTS idx_recruitments_status ON public.recruitments(status) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_recruitments_created ON public.recruitments(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON public.forum_posts(category) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON public.forum_replies(post_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_recruitments_updated_at BEFORE UPDATE ON public.recruitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_forum_replies_updated_at BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
