import type { BirthdayEntry } from 'ark-info'

export type BirthdayRangeKind = 'today' | 'week'

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
