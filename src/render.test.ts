import { describe, expect, it } from 'vitest'
import type { BirthdayEntry } from 'ark-info'
import { getWeekDates, groupBirthdayEntries } from './birthday'
import { createTodayBirthdayHtml, createWeekBirthdayHtml } from './render'

const entry: BirthdayEntry = {
  name: '阿米娅',
  names: { zh: '阿米娅', en: 'Amiya' },
  birthday: { raw: '12月23日', month: 12, day: 23 },
}

describe('birthday render html', () => {
  it('renders today card avatar without birthday text', () => {
    const day = groupBirthdayEntries([entry], [new Date(2026, 11, 23)])[0]
    const html = createTodayBirthdayHtml(day, { 阿米娅: 'https://example.test/amiya.png' })

    expect(html).not.toContain('今天生日的干员有阿米娅')
    expect(html).toContain('https://example.test/amiya.png')
  })

  it('renders all week days and highlights today', () => {
    const days = groupBirthdayEntries([entry], getWeekDates(new Date(2026, 11, 24)))
    const html = createWeekBirthdayHtml(days, {}, new Date(2026, 11, 24), true)

    expect(html).toContain('12月23日')
    expect(html).toContain('12月24日')
    expect(html).toContain('is-today')
  })
})
