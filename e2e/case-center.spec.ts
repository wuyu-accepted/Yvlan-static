import { expect, test } from '@playwright/test'

test('Case Center translates every CASE 02 governance stage without the translation service', async ({ page }) => {
  let translationApiCalls = 0
  await page.route('**/api/campus-pulse/v1/translate', async (route) => {
    translationApiCalls += 1
    await route.fulfill({ status: 503, body: 'translation service disabled for offline test' })
  })
  await page.goto('/')

  await page.locator('a[href="/campus-pulse/results"]').first().click()
  await expect(page).toHaveURL(/\/campus-pulse\/results$/)

  const caseCenter = page.locator('section[aria-labelledby="case-gallery-title"]')
  await expect(caseCenter).toBeVisible()
  const case01 = caseCenter.getByRole('article').filter({
    has: page.getByRole('heading', { name: '暑期住宿床位怎么分，学生才觉得公平？', exact: true }),
  })
  const case02 = caseCenter.getByRole('article').filter({
    has: page.getByRole('heading', { name: '公开道歉之后，学校还应该做什么？', exact: true }),
  })
  await expect(case01).toBeVisible()
  await expect(case02).toBeVisible()

  await case02.getByRole('button', { name: '播放四步回应过程' }).click()
  const player = case02.locator('[aria-live="polite"]')
  await expect(player).toBeVisible()
  const stages = [
    'Tick 3 事件进入论坛',
    'Tick 3 学校回应进入讨论',
    'Tick 4 居民直接回应',
    'Tick 5 讨论继续发展',
  ]
  for (const stage of stages) {
    await player.getByRole('button', { name: stage, exact: true }).click()
    await player.getByRole('button', { name: '译为英文', exact: true }).click()
    await expect(player.locator('p[lang="en"]')).toBeVisible()
    await expect(player.locator('.content-translation__error')).toHaveCount(0)
  }
  expect(translationApiCalls).toBe(0)
})
