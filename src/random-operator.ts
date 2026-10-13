import type { Operator } from 'ark-info'

export function parseRandomOperatorMessage(content: string): string | null {
  const match = content.trim().match(/^随机干员(?:\s+([^\r\n]+))?$/)
  return match ? (match[1] ?? '').trim() : null
}

export function selectRandomOperator(operators: Operator[], parameter = '', now = new Date(), random = Math.random) {
  const stars = parameter.match(/^([1-6一二两三四五六])星$/)
  const starNumbers: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
  const monthOffsets: Record<string, number> = { 本月: 0, 今月: 0, 这个月: 0, 上月: -1, 下月: 1 }
  let candidates: Operator[] = []
  if (stars) {
    const count = starNumbers[stars[1]] ?? Number(stars[1])
    candidates = operators.filter(operator => operator.stars === count)
  } else if (Object.prototype.hasOwnProperty.call(monthOffsets, parameter)) {
    const month = new Date(now.getFullYear(), now.getMonth() + monthOffsets[parameter], 1).getMonth() + 1
    candidates = operators.filter(operator => operator.birthday?.month === month)
  } else if (parameter) {
    const race = parameter === '扎拉克' ? '札拉克' : parameter
    candidates = operators.filter(operator => {
      const factions = [operator.nation, operator.organization, operator.team].filter(Boolean)
      return factions.some(faction => faction === parameter || faction.split('-').includes(parameter))
        || operator.race === parameter
        || operator.race?.split('/').includes(race)
    })
  }
  const pool = candidates.length ? candidates : operators
  return pool.length ? pool[Math.floor(random() * pool.length)] : undefined
}

export class RandomOperatorLimiter {
  private readonly records = new Map<string, number[]>()
  private readonly windowMs = 300_000
  private readonly limit = 10

  take(user: string, now = Date.now()) {
    const times = (this.records.get(user) ?? []).filter(time => time > now - this.windowMs)
    if (times.length >= this.limit) return false
    times.push(now)
    this.records.set(user, times)
    return true
  }

  prune(now = Date.now()) {
    for (const [user, times] of this.records) {
      const active = times.filter(time => time > now - this.windowMs)
      if (active.length) this.records.set(user, active)
      else this.records.delete(user)
    }
  }
}
