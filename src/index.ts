import { Context, h, Schema } from 'koishi'
import type { BirthdayEntry, GetBirthdayOperatorsOptions } from 'ark-info'
import {} from 'koishi-plugin-cron'
import {} from 'koishi-plugin-puppeteer'
import type { BirthdayRangeKind } from './birthday'
import {
  formatBirthdayMessage,
  formatDateKey,
  formatOperatorName,
  getMonthDates,
  getWeekDates,
  groupBirthdayEntries,
  parseBirthdayQuery,
  startOfLocalDay,
  type BirthdayQuery,
} from './birthday'
import { resolveOperatorAvatars } from './assets'
import { createTodayBirthdayHtml, createWeekBirthdayHtml, renderHtmlToImage } from './render'

export const name = 'febfrost-arknights-info'
export const inject = ['cron', 'database', 'puppeteer']

const loggerName = 'febfrost-arknights-info'

export interface PluginConfig {
  targetGroups: string[]
  dailyCron: string
  weeklyCron: string
  includeEmptyDailyPush: boolean
  includeEmptyWeeklyDays: boolean
  endpoint?: string
}

export const Config: Schema<PluginConfig> = Schema.object({
  targetGroups: Schema.array(Schema.string())
    .default([])
    .description('生日推送白名单群聊 ID 列表'),
  dailyCron: Schema.string()
    .default('0 0 * * *')
    .description('每日生日推送 cron 表达式，默认每天 00:00'),
  weeklyCron: Schema.string()
    .default('10 0 * * 1')
    .description('本周生日推送 cron 表达式，默认每周一 00:10'),
  includeEmptyDailyPush: Schema.boolean()
    .default(false)
    .description('今日无生日干员时是否仍然推送'),
  includeEmptyWeeklyDays: Schema.boolean()
    .default(true)
    .description('本周推送中是否展示无生日干员的日期'),
  endpoint: Schema.string()
    .description('可选的 PRTS MediaWiki API endpoint'),
})

export interface ArkBirthdayCacheTable {
  key: string
  range: BirthdayRangeKind
  dateKey: string
  payload: BirthdayEntry[]
  updatedAt: Date
}

declare module 'koishi' {
  interface Tables {
    arkBirthdayCache: ArkBirthdayCacheTable
  }
}

export function apply(ctx: Context, config: PluginConfig) {
  const logger = ctx.logger(loggerName)

  ctx.model.extend('arkBirthdayCache', {
    key: 'string',
    range: 'string',
    dateKey: 'string',
    payload: 'json',
    updatedAt: 'timestamp',
  }, {
    primary: 'key',
  })

  const getArkInfo = async () => import('ark-info')

  async function fetchBirthdays(range: BirthdayRangeKind, date = new Date()) {
    const arkInfo = await getArkInfo()
    const options: GetBirthdayOperatorsOptions = {}
    if (range === 'week') {
      options.range = 'week'
      options.date = startOfLocalDay(date)
    } else if (range === 'month') {
      options.month = date.getMonth() + 1
    } else {
      options.date = startOfLocalDay(date)
    }
    if (config.endpoint) options.endpoint = config.endpoint
    const entries = await arkInfo.getBirthdayOperators(options)
    await saveCache(range, date, entries)
    return entries
  }

  async function saveCache(range: BirthdayRangeKind, date: Date, payload: BirthdayEntry[]) {
    const dateKey = range === 'today' || range === 'day'
      ? formatDateKey(date)
      : range === 'month'
        ? `${date.getFullYear()}-${date.getMonth() + 1}`
      : getWeekDates(date).map(formatDateKey).join(',')
    const key = `${range}:${date.getFullYear()}:${dateKey}`

    await ctx.database.upsert('arkBirthdayCache', () => [{
      key,
      range,
      dateKey,
      payload,
      updatedAt: new Date(),
    }])
  }

  async function createBirthdayPayload(range: BirthdayRangeKind, date = new Date()) {
    const entries = await fetchBirthdays(range, date)
    const arkInfo = await getArkInfo()
    const avatars = await resolveOperatorAvatars(arkInfo.getOperatorAssets, entries, {
      endpoint: config.endpoint,
    })
    const dates = range === 'today' || range === 'day'
      ? [startOfLocalDay(date)]
      : range === 'month'
        ? getMonthDates(date)
      : getWeekDates(date)
    const days = groupBirthdayEntries(entries, dates)

    return {
      avatars,
      days,
      entries,
      message: formatBirthdayMessage(range, days, {
        includeEmptyDays: range === 'week' && config.includeEmptyWeeklyDays,
        now: date,
      }),
    }
  }

  async function createBirthdayImage(range: BirthdayRangeKind, date = new Date(), title?: string) {
    const payload = await createBirthdayPayload(range, date)
    const html = range === 'today' || range === 'day'
      ? createTodayBirthdayHtml(payload.days[0], payload.avatars)
      : createWeekBirthdayHtml(payload.days, payload.avatars, config.includeEmptyWeeklyDays, title, new Date())
    const image = await renderHtmlToImage(ctx, html, range)

    return {
      ...payload,
      image,
    }
  }

  function formatDayBirthdayText(entries: BirthdayEntry[], label = '今天') {
    if (!entries.length) return `${label}暂无生日干员。`
    return `${label}生日的干员有${entries.map(formatOperatorName).join('、')}`
  }

  function createBirthdayContent(range: BirthdayRangeKind, image: Buffer, entries: BirthdayEntry[], label?: string) {
    if (range === 'today' || range === 'day') {
      return [h.image(image, 'image/png'), `\n${formatDayBirthdayText(entries, label)}`
      ]
    }
    return h.image(image, 'image/png')
  }

  async function createBirthdayResponse(query: BirthdayQuery) {
    const payload = await createBirthdayPayload(query.range, query.date)
    if (!payload.entries.length) {
      return `${query.label}范围内没有查询到相关干员信息。`
    }

    const html = query.range === 'today' || query.range === 'day'
      ? createTodayBirthdayHtml(payload.days[0], payload.avatars)
      : createWeekBirthdayHtml(
        payload.days,
        payload.avatars,
        query.range === 'week' && config.includeEmptyWeeklyDays,
        query.title,
        new Date()
      )
    const image = await renderHtmlToImage(ctx, html, query.range)
    return createBirthdayContent(query.range, image, payload.entries, query.label)
  }

  async function broadcast(content: h.Fragment) {
    if (!config.targetGroups.length) {
      logger.warn('未配置生日推送白名单群聊，跳过广播。')
      return
    }

    await Promise.all(ctx.bots.map(async (bot) => {
      try {
        if (typeof bot.broadcast === 'function') {
          await bot.broadcast(config.targetGroups, content)
          return
        }

        await Promise.all(config.targetGroups.map((groupId) => bot.sendMessage(groupId, content)))
      } catch (error) {
        logger.warn('生日推送发送失败。', error)
      }
    }))
  }

  async function pushBirthdays(range: BirthdayRangeKind) {
    const { entries, image } = await createBirthdayImage(range)
    if (range === 'today' && entries.length === 0 && !config.includeEmptyDailyPush) {
      logger.info('今日无生日干员，跳过每日推送。')
      return
    }

    await broadcast(createBirthdayContent(range, image, entries, '今天'))
  }

  ctx.command('今日生日干员', '查询今日生日的明日方舟干员')
    .alias('今日干员', '今天生日干员', '今天干员')
    .action(async () => {
      const { entries, image } = await createBirthdayImage('today')
      if (!entries.length) return '今天范围内没有查询到相关干员信息。'
      return createBirthdayContent('today', image, entries, '今天')
    })

  ctx.command('本周生日干员', '查询本周每天生日的明日方舟干员')
    .alias('本周干员', '今周生日干员', '今周干员', '这周生日干员', '这周干员')
    .action(async () => {
      const { entries, image } = await createBirthdayImage('week', new Date(), '本周生日干员')
      if (!entries.length) return '本周范围内没有查询到相关干员信息。'
      return h.image(image, 'image/png')
    })

  ctx.command('本月生日干员', '查询本月生日的明日方舟干员')
    .alias('本月干员', '今月生日干员', '今月干员', '这个月生日干员', '这个月干员')
    .action(async () => {
      const query = parseBirthdayQuery('本月生日干员')
      return createBirthdayResponse(query)
    })

  ctx.command('生日干员 [query:text]', '查询指定日期、周或月份生日的明日方舟干员')
    .alias('干员生日')
    .action(async (_, query = '今天') => {
      const parsed = parseBirthdayQuery(query)
        ?? parseBirthdayQuery(`${query}生日干员`)
        ?? parseBirthdayQuery(`${query}干员`)
      if (!parsed) return '未识别查询范围，请尝试：明天生日干员、6.17干员、上周生日干员、本月干员。'
      return createBirthdayResponse(parsed)
    })

  const commandLikeQueries = new Set([
    '今日生日干员',
    '今日干员',
    '今天生日干员',
    '今天干员',
    '本周生日干员',
    '本周干员',
    '今周生日干员',
    '今周干员',
    '这周生日干员',
    '这周干员',
    '本月生日干员',
    '本月干员',
    '今月生日干员',
    '今月干员',
    '这个月生日干员',
    '这个月干员',
  ])

  ctx.on('message', async (session) => {
    const content = session.content?.trim()
    if (!content || commandLikeQueries.has(content)) return
    const query = parseBirthdayQuery(content)
    if (!query) return
    await session.send(await createBirthdayResponse(query))
  })

  ctx.command('刷新干员生日缓存', '刷新今日和本周干员生日缓存')
    .action(async () => {
      await Promise.all([
        fetchBirthdays('today'),
        fetchBirthdays('week'),
      ])
      return '干员生日缓存已刷新。'
    })

  ctx.cron(config.dailyCron, async () => {
    logger.info('开始执行每日干员生日推送。')
    await pushBirthdays('today')
  })

  ctx.cron(config.weeklyCron, async () => {
    logger.info('开始执行本周干员生日推送。')
    await pushBirthdays('week')
  })
}
