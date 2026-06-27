import { describe, expect, it } from 'vitest'
import type { BirthdayEntry } from 'ark-info'
import { formatBirthdayMessage, getWeekDates, groupBirthdayEntries } from './birthday'

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
})
