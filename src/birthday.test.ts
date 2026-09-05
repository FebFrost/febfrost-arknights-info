import { describe, expect, it } from 'vitest'
import type { BirthdayEntry } from 'ark-info'
import { formatBirthdayMessage, getMonthDates, getWeekDates, groupBirthdayEntries, parseBirthdayQuery } from './birthday'

const entries: BirthdayEntry[] = [
  {
    name: '阿米娅',
    names: { zh: '阿米娅', en: 'Amiya' },
    birthday: { raw: '12月23日', month: 12, day: 23 },
  },
  {
    name: '煌',
    names: { zh: '煌', en: 'Blaze' },
    birthday: { raw: '12月25日', month: 12, day: 25 },
  },
]

describe('birthday domain', () => {
  it('creates a Monday to Sunday week', () => {
    const week = getWeekDates(new Date(2026, 11, 24))

    expect(week.map((date) => `${date.getMonth() + 1}-${date.getDate()}`)).toEqual([
      '12-21',
      '12-22',
      '12-23',
      '12-24',
      '12-25',
      '12-26',
      '12-27',
    ])
  })

  it('groups birthdays by month and day', () => {
    const days = groupBirthdayEntries(entries, getWeekDates(new Date(2026, 11, 24)))

    expect(days.find((day) => day.key === '12-23')?.entries[0].name).toBe('阿米娅')
    expect(days.find((day) => day.key === '12-25')?.entries[0].name).toBe('煌')
  })

  it('formats today birthdays', () => {
    const days = groupBirthdayEntries(entries, [new Date(2026, 11, 23)])

    expect(formatBirthdayMessage('today', days)).toBe('今日 (12月23日) 生日干员：阿米娅 (Amiya)')
  })

  it('formats a weekly digest without empty days', () => {
    const days = groupBirthdayEntries(entries, getWeekDates(new Date(2026, 11, 24)))

    expect(formatBirthdayMessage('week', days)).toContain('12月23日：阿米娅 (Amiya)')
    expect(formatBirthdayMessage('week', days)).toContain('12月25日：煌 (Blaze)')
    expect(formatBirthdayMessage('week', days)).not.toContain('12月24日：暂无')
  })

  it('parses relative day birthday queries', () => {
    const now = new Date(2026, 5, 17)

    expect(parseBirthdayQuery('明天生日干员', now)).toMatchObject({
      range: 'day',
      label: '明天',
    })
    expect(parseBirthdayQuery('后日干员', now)?.date.getDate()).toBe(19)
    expect(parseBirthdayQuery('昨天干员', now)?.date.getDate()).toBe(16)
  })

  it('parses explicit day birthday queries', () => {
    const query = parseBirthdayQuery('6月17日生日干员', new Date(2026, 0, 1))

    expect(query).toMatchObject({
      range: 'day',
      label: '6月17日',
    })
  })

  it('parses week and month birthday queries', () => {
    const now = new Date(2026, 5, 17)

    expect(parseBirthdayQuery('上上周生日干员', now)).toMatchObject({ range: 'week', label: '上上周' })
    expect(parseBirthdayQuery('今周干员', now)).toMatchObject({ range: 'week', label: '今周' })
    expect(parseBirthdayQuery('下月生日干员', now)).toMatchObject({ range: 'month', label: '下月' })
  })

  it('creates all days in a month', () => {
    expect(getMonthDates(new Date(2026, 1, 12))).toHaveLength(28)
  })

  // 等价性保障：message 路径已移除 commandLikeQueries 守卫，统一由 parseBirthdayQuery 处理。
  // 因此所有精确命令别名必须能被 parseBirthdayQuery 命中，否则非 @bot 触发会丢失响应。
  it('covers every exact command alias that the message guard used to block', () => {
    const now = new Date(2026, 5, 17)
    const aliases = [
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
    ]

    aliases.forEach((alias) => {
      expect(parseBirthdayQuery(alias, now), `应解析命令别名：${alias}`).not.toBeNull()
    })
  })

  // 「生日干员 [query]」带参数命令：command 路径与 message 路径使用完全等价的 fallback 解析链。
  // command 路径动作：parseBirthdayQuery(q) ?? parseBirthdayQuery(q+'生日干员') ?? parseBirthdayQuery(q+'干员')
  // message 路径对其提取出的 queryText 使用相同链，故两者对同一入参必返回相同结果。
  function resolveCommandForm(query: string, now = new Date()): ReturnType<typeof parseBirthdayQuery> {
    return parseBirthdayQuery(query, now)
      ?? parseBirthdayQuery(`${query}生日干员`, now)
      ?? parseBirthdayQuery(`${query}干员`, now)
  }

  it('resolves the command-form fallback chain equivalently to the command path', () => {
    const now = new Date(2026, 5, 17)

    expect(resolveCommandForm('6.17', now)).toMatchObject({ range: 'day' })
    expect(resolveCommandForm('上周', now)).toMatchObject({ range: 'week' })
    expect(resolveCommandForm('本月', now)).toMatchObject({ range: 'month' })
    expect(resolveCommandForm('干员', now)).toBeNull()
    expect(resolveCommandForm('不存在的范围', now)).toBeNull()
  })
})
