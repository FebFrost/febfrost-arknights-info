import type { BirthdayEntry } from 'ark-info'

export type BirthdayRangeKind = 'today' | 'day' | 'week' | 'month'

export interface BirthdayQuery {
  range: BirthdayRangeKind
  date: Date
  label: string
  title: string
}

export interface BirthdayDay {
  date: Date
  key: string
  entries: BirthdayEntry[]
}

export function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatDateKey(date: Date) {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatDisplayDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatDisplayMonth(date: Date) {
  return `${date.getMonth() + 1}月`
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getWeekDates(date: Date) {
  const start = startOfLocalDay(date)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(start)
  monday.setDate(start.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday)
    next.setDate(monday.getDate() + index)
    return next
  })
}

export function getMonthDates(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const days: Date[] = []
  for (let next = new Date(start); next.getMonth() === start.getMonth(); next.setDate(next.getDate() + 1)) {
    days.push(new Date(next))
  }
  return days
}

export function addDays(date: Date, days: number) {
  const next = startOfLocalDay(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7)
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function parseRepeatedOffset(input: string, unit: '周' | '月') {
  if (input === '本' || input === '这' || input === '今') return 0
  if (input === `本${unit}` || input === `这${unit}` || input === `今${unit}` || input === `这个${unit}`) return 0
  if (/^上+$/.test(input)) return -input.length
  if (/^下+$/.test(input)) return input.length
  return null
}

function createDayQuery(date: Date, label: string): BirthdayQuery {
  return {
    range: 'day',
    date: startOfLocalDay(date),
    label,
    title: `${label}生日干员`,
  }
}

function createWeekQuery(date: Date, label: string): BirthdayQuery {
  const week = getWeekDates(date)
  return {
    range: 'week',
    date: startOfLocalDay(date),
    label,
    title: `${label}生日干员 (${formatDisplayDate(week[0])} - ${formatDisplayDate(week[week.length - 1])})`,
  }
}

function createMonthQuery(date: Date, label: string): BirthdayQuery {
  return {
    range: 'month',
    date: new Date(date.getFullYear(), date.getMonth(), 1),
    label,
    title: `${label}生日干员`,
  }
}

export function parseBirthdayQuery(content: string, now = new Date()): BirthdayQuery | null {
  const input = content.trim().replace(/\s+/g, '')

  const relativeDay = input.match(/^(今日|今天|明天|后天|后日|昨天|昨日)(?:生日)?干员$/)
  if (relativeDay) {
    const text = relativeDay[1]
    const offsetMap: Record<string, number> = {
      今日: 0,
      今天: 0,
      明天: 1,
      后天: 2,
      后日: 2,
      昨天: -1,
      昨日: -1,
    }
    return createDayQuery(addDays(now, offsetMap[text]), text)
  }

  const date = input.match(/^(\d{1,2})(?:[.\/-]|月)(\d{1,2})(?:日)?(?:生日)?干员$/)
  if (date) {
    const month = Number(date[1])
    const day = Number(date[2])
    const parsed = new Date(now.getFullYear(), month - 1, day)
    if (parsed.getMonth() === month - 1 && parsed.getDate() === day) {
      return createDayQuery(parsed, formatDisplayDate(parsed))
    }
    return null
  }

  const week = input.match(/^((?:上+|下+|本|这|今)周)(?:生日)?干员$/)
  if (week) {
    const unitText = week[1].replace(/周$/, '')
    const offset = parseRepeatedOffset(unitText, '周')
    if (offset !== null) return createWeekQuery(addWeeks(now, offset), week[1])
  }

  const month = input.match(/^((?:上+|下+|本|这|今)月|这个月)(?:生日)?干员$/)
  if (month) {
    const text = month[1]
    const unitText = text === '这个月' ? text : text.replace(/月$/, '')
    const offset = parseRepeatedOffset(unitText, '月')
    if (offset !== null) return createMonthQuery(addMonths(now, offset), text)
  }

  return null
}

export function getEntryDateKey(entry: BirthdayEntry) {
  const birthday = entry.birthday
  if (!birthday?.month || !birthday.day) return null
  return `${pad2(birthday.month)}-${pad2(birthday.day)}`
}

export function groupBirthdayEntries(entries: BirthdayEntry[], dates: Date[]): BirthdayDay[] {
  return dates.map((date) => {
    const key = formatDateKey(date)
    return {
      date,
      key,
      entries: entries.filter((entry) => getEntryDateKey(entry) === key),
    }
  })
}

export function formatOperatorName(entry: BirthdayEntry) {
  const aliases = [entry.names.en, entry.names.ja].filter(Boolean)
  if (!aliases.length) return entry.name
  return `${entry.name} (${aliases.join(' / ')})`
}

export function formatBirthdayMessage(range: BirthdayRangeKind, days: BirthdayDay[], options: {
  includeEmptyDays?: boolean
  now?: Date
} = {}) {
  const visibleDays = options.includeEmptyDays ? days : days.filter((day) => day.entries.length > 0)
  const now = options.now ?? new Date()

  if (range === 'today') {
    const today = days[0]?.date ?? now
    if (!visibleDays.length) {
      return `今日 (${formatDisplayDate(today)}) 暂无干员生日。`
    }
    const names = visibleDays[0].entries.map(formatOperatorName).join('、')
    return `今日 (${formatDisplayDate(today)}) 生日干员：${names}`
  }

  if (!visibleDays.length) {
    return `本周暂无干员生日。`
  }

  const lines = visibleDays.map((day) => {
    const names = day.entries.length
      ? day.entries.map(formatOperatorName).join('、')
      : '暂无'
    return `${formatDisplayDate(day.date)}：${names}`
  })

  return [`本周生日干员 (${formatDisplayDate(days[0].date)} - ${formatDisplayDate(days[days.length - 1].date)})`, ...lines].join('\n')
}
