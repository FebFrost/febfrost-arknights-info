import { mkdir, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { Context } from 'koishi'
import type { BirthdayDay } from './birthday'
import { formatDisplayDate, formatOperatorName } from './birthday'
import type { OperatorAvatarMap } from './assets'
import {} from 'koishi-plugin-puppeteer'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createCacheFileName(feature: string, identity: string, now = new Date()) {
  const safeFeature = feature.replace(/[^\w-]/g, '-')
  const safeIdentity = identity.replace(/[^\w-]/g, '-')
  return `${safeFeature}-${safeIdentity}-${now.getTime()}-${Math.floor(Math.random() * 1_000_000)}.html`
}

function avatarHtml(day: BirthdayDay, avatars: OperatorAvatarMap) {
  if (!day.entries.length) {
    return '<div class="empty">暂无</div>'
  }

  return day.entries.map((entry) => {
    const avatar = avatars[entry.name]
    const name = escapeHtml(entry.name)
    const label = escapeHtml(formatOperatorName(entry))
    const image = avatar
      ? `<img class="avatar-img" src="${escapeHtml(avatar)}" alt="${name}" />`
      : `<div class="avatar-fallback">${name.slice(0, 2)}</div>`

    return `
      <div class="operator" title="${label}">
        <div class="avatar">${image}</div>
        <div class="operator-name">${name}</div>
      </div>
    `
  }).join('')
}

function baseHtml(body: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: max-content;
      min-width: 720px;
      background: transparent;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      color: #1f2933;
    }
    #birthday-card {
      width: max-content;
      min-width: 720px;
      max-width: 1120px;
      padding: 28px;
      background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 42%, #eef5f8 100%);
      border: 1px solid #d5dde5;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(35, 45, 60, 0.14);
    }
    .today-card {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .avatar-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .operator {
      width: 92px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .avatar {
      width: 76px;
      height: 76px;
      border-radius: 8px;
      overflow: hidden;
      background: #dde5ec;
      border: 1px solid #bdc9d4;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .avatar-fallback {
      padding: 8px;
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      color: #334155;
    }
    .operator-name {
      width: 100%;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.25;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .today-text {
      min-width: 320px;
      max-width: 560px;
      font-size: 30px;
      font-weight: 800;
      line-height: 1.35;
    }
    .muted {
      margin-top: 8px;
      font-size: 18px;
      font-weight: 500;
      color: #667586;
    }
    .week-title {
      margin-bottom: 18px;
      font-size: 28px;
      font-weight: 800;
    }
    .day-row {
      display: grid;
      grid-template-columns: 124px 1fr;
      gap: 18px;
      align-items: center;
      padding: 16px 0;
      border-top: 1px solid #dce3ea;
    }
    .day-row:first-of-type { border-top: 0; }
    .day-title {
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 19px;
      font-weight: 800;
      text-align: center;
      background: #e6edf2;
      color: #263541;
    }
    .day-row.is-today .day-title {
      background: #174f63;
      color: #ffffff;
    }
    .empty {
      color: #81909f;
      font-size: 18px;
    }
  </style>
</head>
<body>${body}</body>
</html>`
}

export function createTodayBirthdayHtml(day: BirthdayDay, avatars: OperatorAvatarMap) {
  const body = `
    <main id="birthday-card" class="today-card">
      <section class="avatar-row">${day.entries.length ? avatarHtml(day, avatars) : ''}</section>
    </main>
  `
  return baseHtml(body)
}

export function createWeekBirthdayHtml(days: BirthdayDay[], avatars: OperatorAvatarMap, today = new Date(), includeEmptyDays = false) {
  const todayKey = `${today.getMonth() + 1}-${today.getDate()}`
  const visibleDays = includeEmptyDays ? days : days.filter((day) => day.entries.length > 0)
  const rows = visibleDays.map((day) => {
    const dayKey = `${day.date.getMonth() + 1}-${day.date.getDate()}`
    const isToday = dayKey === todayKey
    return `
      <section class="day-row${isToday ? ' is-today' : ''}">
        <div class="day-title">${escapeHtml(formatDisplayDate(day.date))}</div>
        <div class="avatar-row">${avatarHtml(day, avatars)}</div>
      </section>
    `
  }).join('')

  const body = `
    <main id="birthday-card">
      <header class="week-title">本周生日干员</header>
      ${rows || '<section class="empty">本周暂无干员生日。</section>'}
    </main>
  `
  return baseHtml(body)
}

export async function renderHtmlToImage(ctx: Context, html: string, identity: string) {
  const cacheDir = resolve(__dirname, '../cache')
  await mkdir(cacheDir, { recursive: true })
  const cachePath = resolve(cacheDir, createCacheFileName('ark-birthday', identity))
  await writeFile(cachePath, html, 'utf8')

  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })
    await page.goto(`file:///${cachePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#birthday-card')
    const element = await page.$('#birthday-card')
    return await element.screenshot({ encoding: 'binary' })
  } finally {
    await page.close()
  }
}
