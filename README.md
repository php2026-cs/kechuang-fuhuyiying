# 科创项目孵化营

面向大学生的智能竞赛组队与信息聚合平台，由大连理工大学未来技术学院开发。提供队友匹配、招募发布、论坛交流、竞赛日历和积分计算服务。

## 项目背景

大学生参加科创竞赛时面临三大痛点：
1. **组队困难**：靠运气在群聊中找队友，效率低下，匹配不精准
2. **信息分散**：竞赛信息分布在多个平台，报名截止日期易错过
3. **经验断层**：缺乏前辈经验和系统性指导，积分计算规则复杂

本项目通过"竞赛意向 + 技能互补 + 可解释推荐"三位一体的算法，为大学生提供一站式科创竞赛服务。

## 核心功能

| 功能 | 说明 |
|------|------|
| **智能队友匹配** | 基于竞赛方向、技能互补、专业匹配的多维评分，每项推荐附带详细原因 |
| **招募信息管理** | 发布/编辑/暂停/完成招募，支持多种联系方式可见范围 |
| **论坛交流** | 分类讨论、发帖/回复/搜索、删除二次确认 |
| **竞赛日历** | 赛事信息聚合、截止状态提醒、官方信息来源链接 |
| **积分计算器** | 快速估算竞赛积分，明确标注仅供参考 |
| **评审演示模式** | 独立演示数据，不污染生产环境，30 秒完整展示 |
| **管理员后台** | 用户管理、招募管理、帖子管理（仅通过 Supabase Auth + RLS 授权） |

## 系统架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   React 18   │    │  Zustand     │    │  Supabase    │
│   Router v6  │───▶│  Store       │───▶│  Client      │──▶ Supabase
│   TypeScript │    │  (Auth/Demo) │    │  (REST/RT)   │
└──────────────┘    └──────────────┘    └──────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  GitHub Pages (Static Hosting)       │
└──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────┐
│  Supabase Backend                    │
│  ├── Auth (email/password)           │
│  ├── Database (PostgreSQL)           │
│  ├── RLS (Row Level Security)        │
│  ├── Realtime (WebSocket)            │
│  └── Storage                         │
└──────────────────────────────────────┘
```

## 技术栈

- **前端**：React 18, TypeScript 5, Vite 5, React Router 6, Zustand 4
- **后端**：Supabase (Auth, Database, RLS, Realtime)
- **测试**：Vitest, Testing Library
- **CI/CD**：GitHub Actions → GitHub Pages
- **代码规范**：ESLint, TypeScript strict

## 本地运行

### 环境要求

- Node.js >= 18
- pnpm

### 安装依赖

```bash
pnpm install
```

### 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

配置项：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 启动开发服务器

```bash
pnpm dev
```

### 运行测试

```bash
pnpm test
```

### 运行类型检查

```bash
pnpm typecheck
```

### 构建生产版本

```bash
pnpm build
```

## Supabase 初始化

1. 创建 Supabase 项目
2. 启用 Email Auth
3. 在 SQL Editor 中依次执行：
   - `supabase/migrations/001_initial_schema.sql`（表结构）
   - `supabase/migrations/002_rls_policies.sql`（RLS 策略）
   - `supabase/seed.sql`（可选，竞赛种子数据）
4. 设置管理员：在 `user_roles` 表中插入管理员记录
5. 将 Supabase URL 和 anon key 配置到 `.env`

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `profiles` | 用户资料 | user_id, display_name, skills, contact_visibility |
| `user_roles` | 用户角色 | user_id, role (admin/moderator) |
| `recruitments` | 招募信息 | user_id, competition_target, required_skills, status |
| `forum_posts` | 论坛帖子 | user_id, title, content, category, is_pinned |
| `forum_replies` | 论坛回复 | post_id, user_id, content |
| `competitions` | 竞赛信息 | name, level, official_deadline, school_deadline |
| `messages` | 私信 | sender_id, receiver_id, content |
| `notifications` | 通知 | user_id, type, title, is_read |

## RLS 权限说明

所有业务表均已启用 RLS（Row Level Security），权限策略如下：

- **profiles**：公开可读，仅本人可编辑
- **recruitments**：公开可读（排除软删除），仅本人可编辑，管理员可管理任意招募
- **forum_posts / forum_replies**：公开可读，仅本人可编辑/删除
- **competitions**：公开只读，由管理员通过后台维护
- **messages**：仅会话参与者可读写
- **notifications**：仅接收者可读写
- **user_roles**：仅用于后端权限验证，不暴露给前端

管理员权限通过 `user_roles` 表验证，不依赖于 localStorage 或前端状态。

## 演示模式说明

点击首页"查看评审演示"按钮即可进入演示模式。演示模式：

- 使用虚构、脱敏的演示数据
- 所有内容标注"演示数据"标签
- 不会写入生产数据库
- 提供明确的"退出演示"按钮
- 依次展示：招募填写 → 匹配结果 → 推荐原因 → 沟通界面 → 论坛 → 竞赛日历 → 积分计算

## 安全与隐私

- **认证**：使用 Supabase Auth，支持邮箱注册/登录，密码长度至少 8 位
- **管理员**：不再使用硬编码密码，仅通过 `user_roles` 表验证
- **花名册**：不打包到前端 Bundle，通过安全接口单条验证
- **联系方式**：四种可见范围（登录可见/匹配后可见/仅私信/完全隐藏），默认不公开
- **软删除**：删除操作执行软删除，数据不会出现在公开查询中
- **localStorage**：仅保存未提交表单草稿、界面偏好和演示模式状态

## 已知限制

- 当前为静态前端部署，部分功能（如邮件确认、文件上传）需 Supabase 配置
- 私信目前使用轮询模式，未来可升级为 Realtime 订阅
- 花名册验证接口需部署 Supabase Edge Function
- 积分计算器当前为参考模板，具体规则需配置

## 后续规划

- [ ] Edge Function：花名册安全验证接口
- [ ] Realtime：私信和通知实时推送
- [ ] 更多竞赛积分规则模板
- [ ] 用户行为分析面板
- [ ] PWA 离线支持
- [ ] 国际化 i18n
