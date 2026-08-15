import { expect, test, type Page } from '@playwright/test'

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

const PAGES: Array<[string, string, string | null]> = [
  ['/', 'home', null],
  ['recruit', 'recruit', '加载招募信息失败'],
  ['forum', 'forum', '加载论坛失败'],
  ['competition', 'competition', '加载竞赛信息失败'],
  ['messages', 'messages', null],
  ['profile', 'profile', null],
]

test.describe('anonymous pages', () => {
  for (const [path, name, errorBanner] of PAGES) {
    test(`${name} (${path}) loads without relation/permission/runtime errors`, async ({ page }) => {
      const errors = collectErrors(page)
      await page.goto(path, { waitUntil: 'load' })
      await expect(page.locator('#root')).toBeVisible()
      await page.waitForTimeout(1500)

      const body = await page.locator('body').innerText()
      expect(body).not.toContain('permission denied')
      if (errorBanner) expect(body).not.toContain(errorBanner)

      const bad = errors.filter(e =>
        /permission denied|Could not find a relationship|load .* failed|Uncaught|is not a function|Cannot read properties|Minified React error/.test(e),
      )
      expect(bad, `console/page errors on ${path}`).toEqual([])
    })
  }

  test('recruit page renders the match UI (filters visible)', async ({ page }) => {
    await page.goto('recruit', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: '寻找队友' })).toBeVisible()
    await expect(page.getByRole('button', { name: /展开筛选/ })).toBeVisible()
  })
})
