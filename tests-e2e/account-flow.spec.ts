import { expect, test, type Page } from '@playwright/test'
import { loadE2ECredentials } from './helpers/env'

const creds = loadE2ECredentials()

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

async function expectCleanPage(page: Page, path: string, errors: string[]): Promise<void> {
  await page.goto(path, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const body = await page.locator('body').innerText()
  expect(body).not.toContain('permission denied')
  expect(body).not.toContain('加载招募信息失败')
  expect(body).not.toContain('加载论坛失败')
  expect(body).not.toContain('加载竞赛信息失败')
  const bad = errors.filter(e =>
    /permission denied|Could not find a relationship|load .* failed|Uncaught|is not a function|Cannot read properties|Minified React error/.test(e),
  )
  expect(bad, `console/page errors on ${path}`).toEqual([])
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('login', { waitUntil: 'load' })
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/kechuang-fuhuyiying' || url.pathname === '/kechuang-fuhuyiying/')
  await expect(page.getByRole('button', { name: '用户菜单' })).toBeVisible()
}

async function addProfileSkill(page: Page, skill: string): Promise<void> {
  await page.goto('profile', { waitUntil: 'load' })
  // 等待 profile 数据加载完成（避免在加载完成前打开弹窗导致表单为空、保存被校验拦截）
  await page.waitForResponse(
    r => r.url().includes('/rest/v1/profiles') && r.request().method() === 'GET' && r.status() === 200,
  )
  await page.getByRole('button', { name: '编辑资料' }).click()
  // 技能上限为 20；测试数据累积可能已满，先移除一个旧技能腾出名额
  const skillTags = page.getByRole('button', { name: /^删除技能 / })
  if ((await skillTags.count()) >= 20) {
    await skillTags.first().click()
  }
  const skillInput = page.getByPlaceholder('输入技能...')
  await skillInput.fill(skill)
  await page.getByRole('button', { name: '添加', exact: true }).first().click()
  await expect(page.getByText(skill, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  // 保存成功后弹窗关闭；若未关闭说明保存被校验/请求拦截
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0, { timeout: 10000 })
  await expect(page.getByText('资料完整度')).toBeVisible()
  await expect(page.getByText(skill, { exact: true }).first()).toBeVisible()
}

test.describe.serial('dual-account E2E', () => {
  if (!creds) return

  test('A: login + profile read/update (skills persist after reload)', async ({ browser }) => {
    const page = await browser.newPage()
    const errors = collectErrors(page)
    await login(page, creds.aEmail, creds.aPassword)
    // 技能名保持 ≤20 字符（SkillsEditor 按设计裁剪到 20）
    const skill = `E2ESkillA${String(Date.now()).slice(-8)}`
    await addProfileSkill(page, skill)
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByText(skill, { exact: true }).first()).toBeVisible()
    await expectCleanPage(page, '/', errors)
    await page.close()
  })

  test('A: publish recruitment with required_skills (planned 2 for auto-complete)', async ({ browser }) => {
    const page = await browser.newPage()
    const errors = collectErrors(page)
    await login(page, creds.aEmail, creds.aPassword)
    const ts = Date.now()
    const teamName = `E2E队${ts}`
    const comp = `E2E竞赛${ts}`

    await page.goto('profile', { waitUntil: 'load' })
    await page.getByRole('button', { name: '发布招募' }).click()
    await page.getByPlaceholder('选填').fill(teamName)
    await page.getByPlaceholder('如：挑战杯').fill(comp)
    await page.getByPlaceholder('至少10个字').fill('E2E 自动化双账号测试招募，需要前端能力。')
    await page.getByPlaceholder('输入技能...').fill('前端开发')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.locator('input[type="number"]').nth(1).fill('2')
    await page.getByRole('button', { name: '保存', exact: true }).click()

    // 等待“我的招募”列表重新加载完成后再断言
    await page.waitForResponse(
      r => r.url().includes('/rest/v1/recruitments') && r.url().includes('order=created_at.desc')
        && r.request().method() === 'GET' && r.status() === 200,
    )
    await expect(page.getByText(teamName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('前端开发', { exact: true }).first()).toBeVisible()
    await expectCleanPage(page, '/', errors)
    await page.close()
  })

  test('B: login + profile update (skills for matching)', async ({ browser }) => {
    const page = await browser.newPage()
    const errors = collectErrors(page)
    await login(page, creds.bEmail, creds.bPassword)
    await addProfileSkill(page, '前端开发')
    await expectCleanPage(page, '/', errors)
    await page.close()
  })

  test('B: matching shows A recruitment with reasons; apply; duplicate pending blocked', async ({ browser }) => {
    const page = await browser.newPage()
    const errors = collectErrors(page)
    await login(page, creds.bEmail, creds.bPassword)
    await page.goto('recruit', { waitUntil: 'load' })
    // 等待招募列表响应（慢响应时最多等 30s），随后仍用重试兜底
    await page.waitForResponse(
      r => r.url().includes('/rest/v1/recruitments') && r.url().includes('order=created_at.desc')
        && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 30000 },
    ).catch(() => undefined)
    await page.getByRole('button', { name: /展开筛选/ }).click()
    await page.getByRole('button', { name: '开始匹配' }).click()

    const team = page.getByText(/E2E队\d+/).first()
    // 若列表仍在加载导致结果为空，重试“开始匹配”（最多 5 次）
    for (let i = 0; i < 5; i++) {
      if (await team.isVisible().catch(() => false)) break
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: '开始匹配' }).click()
    }
    await expect(team).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/匹配 \d+%/).first()).toBeVisible()
    await expect(page.getByText(/你具备对方需要/).first()).toBeVisible()

    const card = page.locator('div.bg-white.rounded-xl.border.border-gray-200.p-5')
      .filter({ has: page.getByRole('heading', { name: /E2E队\d+/ }) })
      .first()
    await card.getByRole('button', { name: '申请加入' }).click()
    await page.getByRole('button', { name: '发送申请' }).click()
    await expect(page.getByText('申请已发送，等待队长处理')).toBeVisible()
    await expect(page.getByRole('button', { name: '已申请·待处理' }).first()).toBeVisible()

    // 重复 pending 的 UI 防护：按钮禁用（数据库唯一索引 + RPC 检查为第二道防线）
    await expect(card.getByRole('button', { name: '已申请·待处理' })).toBeDisabled()

    await expectCleanPage(page, '/', errors)
    await page.close()
  })

  test('A: sees B application, accepts; team auto-completes; B notification + mark read', async ({ browser }) => {
    const pageA = await browser.newPage()
    const errorsA = collectErrors(pageA)
    await login(pageA, creds.aEmail, creds.aPassword)

    await pageA.goto('profile', { waitUntil: 'load' })
    const applyBtn = pageA.getByRole('button', { name: /收到 \d+ 个申请/ }).first()
    await expect(applyBtn).toBeVisible({ timeout: 15000 })
    await applyBtn.click()
    await pageA.getByRole('button', { name: '接受', exact: true }).click()
    await expect(pageA.getByText('已接受成员加入')).toBeVisible()
    await expect(pageA.getByText(/2\/2 人/).first()).toBeVisible()
    await expect(pageA.getByText('已招满').first()).toBeVisible()

    const pageB = await browser.newPage()
    const errorsB = collectErrors(pageB)
    await login(pageB, creds.bEmail, creds.bPassword)
    await pageB.goto('/', { waitUntil: 'load' })
    // 等待通知加载完成后再打开下拉
    await pageB.waitForResponse(
      r => r.url().includes('/rest/v1/notifications') && r.request().method() === 'GET' && r.status() === 200,
    )
    await pageB.waitForTimeout(500)
    await pageB.getByRole('button', { name: '通知' }).click()
    await expect(pageB.getByText('你的组队申请已被接受').first()).toBeVisible()
    await pageB.getByRole('button', { name: '全部已读' }).click()
    await expect(pageB.getByRole('button', { name: '全部已读' })).toHaveCount(0)

    await expectCleanPage(pageA, '/', errorsA)
    await expectCleanPage(pageB, '/', errorsB)
    await pageA.close()
    await pageB.close()
  })

  test('A/B: messages A->B and B->A with no duplicates', async ({ browser }) => {
    const pageB = await browser.newPage()
    const errorsB = collectErrors(pageB)
    await login(pageB, creds.bEmail, creds.bPassword)

    await pageB.goto('recruit', { waitUntil: 'load' })
    await pageB.waitForResponse(
      r => r.url().includes('/rest/v1/recruitments') && r.url().includes('order=created_at.desc')
        && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 30000 },
    ).catch(() => undefined)
    await pageB.getByRole('button', { name: /展开筛选/ }).click()
    await pageB.getByRole('button', { name: '开始匹配' }).click()
    const team = pageB.getByText(/E2E队\d+/).first()
    for (let i = 0; i < 5; i++) {
      if (await team.isVisible().catch(() => false)) break
      await pageB.waitForTimeout(2000)
      await pageB.getByRole('button', { name: '开始匹配' }).click()
    }
    await expect(team).toBeVisible({ timeout: 15000 })
    const card = pageB.locator('div.bg-white.rounded-xl.border.border-gray-200.p-5')
      .filter({ has: pageB.getByRole('heading', { name: /E2E队\d+/ }) })
      .first()
    const teamName = (await team.textContent()) || 'E2E队'
    await card.getByRole('button', { name: '私信队长' }).click()

    await pageB.waitForURL(url => url.pathname.startsWith('/kechuang-fuhuyiying/messages'))
    const msgB = `你好，我对你的「${teamName}」招募感兴趣。`
    await expect(pageB.getByPlaceholder('输入消息（Enter 发送，Shift+Enter 换行）')).toHaveValue(msgB)
    await pageB.getByRole('button', { name: '发送', exact: true }).click()
    await expect(pageB.getByText(msgB, { exact: true }).first()).toBeVisible()

    const pageA = await browser.newPage()
    const errorsA = collectErrors(pageA)
    await login(pageA, creds.aEmail, creds.aPassword)
    await pageA.goto('messages', { waitUntil: 'load' })
    const conv = pageA.getByRole('button').filter({ hasText: msgB }).first()
    await expect(conv).toBeVisible({ timeout: 15000 })
    await conv.click()
    await expect(pageA.getByText(msgB, { exact: true }).first()).toBeVisible()
    const replyA = `E2E回复${Date.now()}`
    await pageA.getByPlaceholder('输入消息（Enter 发送，Shift+Enter 换行）').fill(replyA)
    await pageA.getByRole('button', { name: '发送', exact: true }).click()
    await expect(pageA.getByText(replyA, { exact: true })).toBeVisible()

    await pageB.goto('messages', { waitUntil: 'load' })
    const convB = pageB.getByRole('button').filter({ hasText: replyA }).first()
    await expect(convB).toBeVisible({ timeout: 15000 })
    await convB.click()
    await expect(pageB.getByText(replyA, { exact: true })).toHaveCount(1)
    await expect(pageB.getByText(msgB, { exact: true }).first()).toBeVisible()

    await expectCleanPage(pageA, '/', errorsA)
    await expectCleanPage(pageB, '/', errorsB)
    await pageA.close()
    await pageB.close()
  })

  test('message guard: mark-read ok; flag tampering and is_read revert blocked (007)', async ({ browser }) => {
    if (!creds) return

    // B 先给 A 发一条消息（走真实 UI + RPC）
    const pageB = await browser.newPage()
    pageB.on('response', r => {
      if (r.url().includes('/rest/v1/messages')) {
        console.log('[guard-debug] messages', r.request().method(), 'status =', r.status())
      }
    })
    await login(pageB, creds.bEmail, creds.bPassword)
    await pageB.goto('recruit', { waitUntil: 'load' })
    await pageB.waitForResponse(
      r => r.url().includes('/rest/v1/recruitments') && r.url().includes('order=created_at.desc')
        && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 30000 },
    ).catch(() => undefined)
    await pageB.getByRole('button', { name: /展开筛选/ }).click()
    await pageB.getByRole('button', { name: '开始匹配' }).click()
    const teamB = pageB.getByText(/E2E队\d+/).first()
    for (let i = 0; i < 5; i++) {
      if (await teamB.isVisible().catch(() => false)) break
      await pageB.waitForTimeout(2000)
      await pageB.getByRole('button', { name: '开始匹配' }).click()
    }
    await expect(teamB).toBeVisible({ timeout: 15000 })
    const card = pageB.locator('div.bg-white.rounded-xl.border.border-gray-200.p-5')
      .filter({ has: pageB.getByRole('heading', { name: /E2E队\d+/ }) })
      .first()
    await card.getByRole('button', { name: '私信队长' }).click()
    await pageB.waitForURL(url => url.pathname.startsWith('/kechuang-fuhuyiying/messages'))
    const guardMsg = `E2EGuard${Date.now()}`
    const guardInput = pageB.getByPlaceholder('输入消息（Enter 发送，Shift+Enter 换行）')
    // 等预填文本生效后再覆盖，避免预填 effect 晚于 fill 而重置输入
    await expect(guardInput).toHaveValue(/你好，我对你的/)
    await guardInput.fill(guardMsg)
    await pageB.waitForTimeout(300)
    await pageB.getByRole('button', { name: '发送', exact: true }).click()
    // 发送成功以真实的 POST 2xx 响应为准（气泡文本可能与输入值混淆）
    await pageB.waitForResponse(
      r => r.url().includes('/rest/v1/messages') && r.request().method() === 'POST'
        && r.status() >= 200 && r.status() < 300,
      { timeout: 15000 },
    )
    await pageB.close()

    // A 打开会话：触发真实 mark-read，并捕获会话请求头与消息 id（值仅内存使用，不输出）
    const pageA = await browser.newPage()
    let apiBase = ''
    let apiKey = ''
    let authHeader = ''
    let msgId = ''
    pageA.on('request', r => {
      if (r.url().includes('/rest/v1/messages')) {
        const headers = r.headers()
        apiBase = r.url().split('/rest/v1/')[0]
        if (headers.apikey) apiKey = headers.apikey
        if (headers.authorization) authHeader = headers.authorization
      }
    })
    pageA.on('response', async r => {
      if (r.url().includes('/rest/v1/messages') && r.request().method() === 'GET') {
        const body = await r.json().catch(() => null)
        if (Array.isArray(body)) {
          const hit = body.find(m => m.content === guardMsg)
          if (hit) msgId = hit.id
        }
      }
    })
    await login(pageA, creds.aEmail, creds.aPassword)
    await pageA.goto('messages', { waitUntil: 'load' })
    const conv = pageA.getByRole('button').filter({ hasText: guardMsg }).first()
    await expect(conv).toBeVisible({ timeout: 15000 })
    await conv.click()
    await expect(pageA.getByText(guardMsg, { exact: true }).first()).toBeVisible()
    await pageA.waitForTimeout(1500)
    expect(apiBase).toBeTruthy()
    expect(apiKey).toBeTruthy()
    expect(authHeader).toBeTruthy()
    expect(msgId).toBeTruthy()

    const patch = async (payload: Record<string, unknown>): Promise<number> => {
      const res = await fetch(`${apiBase}/rest/v1/messages?id=eq.${msgId}`, {
        method: 'PATCH',
        headers: {
          apikey: apiKey,
          authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      return res.status
    }

    // 1. receiver 标记已读 true：成功（幂等）
    expect(await patch({ is_read: true })).toBeLessThan(300)
    // 2. 同时修改 is_deleted_by_sender：被 guard 拒绝
    expect(await patch({ is_deleted_by_sender: true })).toBeGreaterThanOrEqual(400)
    // 3. 同时修改 is_deleted_by_receiver：被 guard 拒绝
    expect(await patch({ is_deleted_by_receiver: true })).toBeGreaterThanOrEqual(400)
    // 4. is_read 从 true 改回 false：被 guard 拒绝
    expect(await patch({ is_read: false })).toBeGreaterThanOrEqual(400)

    await pageA.close()
  })

  test('A: forum post + reply; competition follow/unfollow + points', async ({ browser }) => {
    const page = await browser.newPage()
    const errors = collectErrors(page)
    await login(page, creds.aEmail, creds.aPassword)

    await page.goto('forum', { waitUntil: 'load' })
    await page.getByRole('button', { name: '发帖' }).click()
    const title = `E2E帖子${Date.now()}`
    await page.getByPlaceholder('不超过200字').fill(title)
    await page.getByPlaceholder(/Ctrl\/Cmd \+ Enter 发送/).fill('E2E 自动化测试帖子正文。')
    await page.getByRole('button', { name: '发布', exact: true }).click()
    const post = page.getByText(title, { exact: true }).first()
    await expect(post).toBeVisible()
    await post.click()
    const replyText = `E2E回复${Date.now()}`
    await page.getByPlaceholder(/以 .* 的身份回复/).fill(replyText)
    await page.getByRole('button', { name: '回复', exact: true }).click()
    await expect(page.getByText(replyText, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭', exact: true }).click()

    await page.goto('competition', { waitUntil: 'load' })
    await page.waitForResponse(
      r => r.url().includes('/rest/v1/competitions') && r.request().method() === 'GET' && r.status() === 200,
    )
    await page.waitForTimeout(500)

    const compCard = () => page.locator('div.bg-white.rounded-xl.border.border-gray-200.p-5')
      .filter({ has: page.getByRole('heading', { name: '挑战杯全国大学生课外学术科技作品竞赛' }) })
      .first()

    // 1. 卡片正常显示
    await expect(compCard()).toBeVisible()

    // 2. 关注：写入成功、状态变已关注、无重复
    await compCard().getByRole('button', { name: '关注', exact: true }).click()
    await expect(compCard().getByRole('button', { name: '已关注', exact: true })).toHaveCount(1)

    // 3. 刷新后关注状态仍存在
    await page.reload({ waitUntil: 'load' })
    await page.waitForResponse(
      r => r.url().includes('/rest/v1/competitions') && r.request().method() === 'GET' && r.status() === 200,
    )
    await page.waitForTimeout(500)
    await expect(compCard().getByRole('button', { name: '已关注', exact: true })).toHaveCount(1)

    // 4. 用户只能操作自己的 follow：B 不应看到 A 的关注状态
    const pageB2 = await browser.newPage()
    const errorsB2 = collectErrors(pageB2)
    await login(pageB2, creds.bEmail, creds.bPassword)
    await pageB2.goto('competition', { waitUntil: 'load' })
    await pageB2.waitForResponse(
      r => r.url().includes('/rest/v1/competitions') && r.request().method() === 'GET' && r.status() === 200,
    )
    await pageB2.waitForTimeout(500)
    const compCardB = () => pageB2.locator('div.bg-white.rounded-xl.border.border-gray-200.p-5')
      .filter({ has: pageB2.getByRole('heading', { name: '挑战杯全国大学生课外学术科技作品竞赛' }) })
      .first()
    await expect(compCardB().getByRole('button', { name: '关注', exact: true })).toBeVisible()
    await expect(compCardB().getByRole('button', { name: '已关注', exact: true })).toHaveCount(0)
    await expectCleanPage(pageB2, '/', errorsB2)
    await pageB2.close()

    // 5. 取消关注：状态恢复为未关注
    await compCard().getByRole('button', { name: '已关注', exact: true }).click()
    await expect(compCard().getByRole('button', { name: '关注', exact: true })).toHaveCount(1)

    // 6. 刷新后仍为未关注
    await page.reload({ waitUntil: 'load' })
    await page.waitForResponse(
      r => r.url().includes('/rest/v1/competitions') && r.request().method() === 'GET' && r.status() === 200,
    )
    await page.waitForTimeout(500)
    await expect(compCard().getByRole('button', { name: '关注', exact: true })).toHaveCount(1)
    await expect(compCard().getByRole('button', { name: '已关注', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /添加竞赛/ }).click()
    await page.getByRole('button', { name: '计算积分' }).click()
    await expect(page.getByText(/总分/)).toBeVisible()

    await expectCleanPage(page, '/', errors)
    await page.close()
  })

  test('final sweep: all pages clean for A and B', async ({ browser }) => {
    const pageA = await browser.newPage()
    const errorsA = collectErrors(pageA)
    await login(pageA, creds.aEmail, creds.aPassword)
    for (const p of ['/', 'profile', 'recruit', 'forum', 'messages', 'competition']) {
      await expectCleanPage(pageA, p, errorsA)
    }
    await pageA.close()

    const pageB = await browser.newPage()
    const errorsB = collectErrors(pageB)
    await login(pageB, creds.bEmail, creds.bPassword)
    for (const p of ['/', 'profile', 'recruit', 'forum', 'messages', 'competition']) {
      await expectCleanPage(pageB, p, errorsB)
    }
    await pageB.close()
  })
})
