import { mkdir, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { Context } from 'koishi'
import type { BirthdayDay } from './birthday'
import { formatDisplayDate, formatOperatorName } from './birthday'
import type { OperatorAvatarMap } from './assets'
import {} from 'koishi-plugin-puppeteer'

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

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
      background: transparent;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      color: #1f2933;
    }
    #birthday-card {
      width: max-content;
      max-width: 1120px;
      padding: 16px;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(244, 248, 250, 0.96) 100%),
        repeating-linear-gradient(135deg, rgba(23, 79, 99, 0.06) 0 1px, transparent 1px 14px);
      border: 1px solid #c9d4dc;
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(35, 45, 60, 0.12);
    }
    .today-card {
      padding: 8px;
    }
    .avatar-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .operator {
      width: 88px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
    }
    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      overflow: hidden;
      background:
        linear-gradient(180deg, #eef3f6 0%, #d9e3ea 100%);
      border: 1px solid #aebec9;
      box-shadow:
        0 6px 14px rgba(30, 46, 58, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.72);
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
      color: #263541;
    }
    .week-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #dce3ea;
      font-size: 25px;
      font-weight: 800;
      color: #1f2d38;
    }
    .week-subtitle {
      font-size: 15px;
      font-weight: 700;
      color: #6f7f8e;
    }
    .day-grid {
      display: flex;
      gap: 12px;
      align-items: start;
      width: 924px;
    }
    .day-column {
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .day-row {
      width: 300px;
      min-height: 120px;
      padding: 10px;
      border: 1px solid #d7e0e7;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.54);
    }
    .day-tone-0 { background: #f7f3ea; border-color: #e2d7c2; }
    .day-tone-1 { background: #eef5f1; border-color: #cbded3; }
    .day-tone-2 { background: #f0f5fa; border-color: #ccdbe7; }
    .day-tone-3 { background: #f6f2f8; border-color: #dccfe5; }
    .day-tone-4 { background: #f5f4ed; border-color: #ded8bd; }
    .day-tone-5 { background: #eff5f7; border-color: #cbe0e5; }
    .day-tone-6 { background: #f7f1f1; border-color: #e3d0d0; }
    .day-title {
      display: flex;
      align-items: baseline;
      gap: 6px;
      width: max-content;
      min-width: 82px;
      padding: 7px 8px;
      margin-bottom: 10px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 800;
      text-align: center;
      background: #e7eef3;
      border: 1px solid #d2dde5;
      color: #263541;
    }
    .weekday {
      font-size: 12px;
      font-weight: 700;
      color: #687986;
    }
    .day-row.is-today .day-title {
      background: #174f63;
      border-color: #174f63;
      color: #ffffff;
      box-shadow: 0 6px 16px rgba(23, 79, 99, 0.22);
    }
    .day-row.is-today {
      border-color: rgba(23, 79, 99, 0.48);
      box-shadow: 0 8px 20px rgba(23, 79, 99, 0.12);
    }
    .day-row.is-today .weekday {
      color: rgba(255, 255, 255, 0.78);
    }
    .day-row .avatar-row {
      align-items: flex-start;
      gap: 10px;
    }
    .day-row .operator {
      width: 84px;
    }
    .day-row .avatar {
      width: 68px;
      height: 68px;
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
      <section class="avatar-row">${day.entries.length ? avatarHtml(day, avatars) : '<div class="empty">暂无</div>'}</section>
    </main>
  `
  return baseHtml(body)
}

function estimateDayCardHeight(day: BirthdayDay) {
  const rowCount = Math.max(1, Math.ceil(Math.max(1, day.entries.length) / 3))
  return 58 + rowCount * 94
}

function distributeDays(days: BirthdayDay[], columnCount = 3) {
  const columns = Array.from({ length: columnCount }, () => ({
    height: 0,
    days: [] as BirthdayDay[],
  }))

  for (const day of days) {
    const target = columns.reduce((shortest, column) => {
      return column.height < shortest.height ? column : shortest
    }, columns[0])

    target.days.push(day)
    target.height += estimateDayCardHeight(day)
  }

  return columns.map((column) => column.days)
}

function formatDayTitle(date: Date) {
  return `${escapeHtml(formatDisplayDate(date))}<span class="weekday">${WEEKDAY_NAMES[date.getDay()]}</span>`
}

export function createWeekBirthdayHtml(days: BirthdayDay[], avatars: OperatorAvatarMap, includeEmptyDays = false, title = '本周生日干员', highlightDate = new Date()) {
  const highlightKey = `${highlightDate.getMonth() + 1}-${highlightDate.getDate()}`
  const visibleDays = includeEmptyDays ? days : days.filter((day) => day.entries.length > 0)
  const renderDay = (day: BirthdayDay) => {
    const dayKey = `${day.date.getMonth() + 1}-${day.date.getDate()}`
    const isToday = dayKey === highlightKey
    return `
      <section class="day-row day-tone-${day.date.getDay()}${isToday ? ' is-today' : ''}">
        <div class="day-title">${formatDayTitle(day.date)}</div>
        <div class="avatar-row">${avatarHtml(day, avatars)}</div>
      </section>
    `
  }
  const columns = distributeDays(visibleDays)
  const columnHtml = columns
    .filter((column) => column.length > 0)
    .map((column) => `<div class="day-column">${column.map(renderDay).join('')}</div>`)
    .join('')

  const body = `
    <main id="birthday-card">
      <header class="week-title">
        <span>${escapeHtml(title)}</span>
        <span class="week-subtitle">${escapeHtml(formatDisplayDate(days[0].date))} - ${escapeHtml(formatDisplayDate(days[days.length - 1].date))}</span>
      </header>
      ${columnHtml
        ? `<section class="day-grid">${columnHtml}</section>`
        : '<section class="empty">本周暂无干员生日。</section>'
      }
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
