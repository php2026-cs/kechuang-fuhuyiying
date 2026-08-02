-- 演示/种子数据（虚构、脱敏）
-- 此数据仅供演示模式使用，不包含真实学生信息

INSERT INTO public.competitions (name, level, description, official_source, suitable_majors, registration_start, official_deadline, school_deadline, status) VALUES
('挑战杯全国大学生课外学术科技作品竞赛', 'national', '挑战杯是全国最具影响力的大学生科技创新竞赛之一。', 'http://www.tiaozhanbei.net/', ARRAY['所有专业'], '2026-06-01', '2026-09-15', '2026-09-10', 'normal'),
('中国国际大学生创新大赛', 'national', '原"互联网+"大学生创新创业大赛，覆盖所有学科。', 'https://cy.ncss.cn/', ARRAY['所有专业'], '2026-05-01', '2026-08-30', '2026-08-25', 'closing_soon'),
('全国大学生电子设计竞赛', 'national', '面向电子信息类专业的权威赛事。', 'https://www.nuedc-training.com.cn/', ARRAY['电子信息', '自动化', '计算机'], '2026-07-01', '2026-08-01', '2026-07-28', 'due_today'),
('全国大学生数学建模竞赛', 'national', 'CUMCM - 面向全体大学生的数学建模竞赛。', 'http://www.mcm.edu.cn/', ARRAY['数学', '计算机', '物理', '工程'], '2026-08-01', '2026-09-10', '2026-09-05', 'normal'),
('全国大学生机械创新设计大赛', 'national', '面向机械及相关专业学生的创新设计竞赛。', 'http://www.machine-innovation.org/', ARRAY['机械', '材料', '自动化'], '2026-04-01', '2026-07-31', '2026-07-20', 'closed');

-- 演示用户通过 Supabase Auth 注册，不在此处插入
