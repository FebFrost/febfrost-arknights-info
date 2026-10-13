import type { Operator } from 'ark-info'

export function parseRandomOperatorMessage(content: string): string | null {
  const match = content.trim().match(/^随机干员(?:\s+([^\r\n]+))?$/)
  return match ? (match[1] ?? '').trim() : null
}

export type OperatorTagCategory = '职业' | '子职业' | '势力' | '种族'

function normalizeTag(tag: string) {
  return tag.replace(/术士/g, '术师').replace(/扎拉克/g, '札拉克')
}

function operatorTags(operator: Operator): Record<OperatorTagCategory, string[]> {
  const factions = [operator.nation, operator.organization, operator.team].filter(Boolean)
  return {
    职业: [operator.profession].filter(Boolean),
    子职业: operator.subProfession ? [operator.subProfession, `${operator.profession}-${operator.subProfession}`] : [],
    势力: factions.flatMap(faction => [faction, ...faction.split('-')]),
    种族: operator.race ? [operator.race, ...operator.race.split('/')] : [],
  }
}

export function getOperatorTagList(operators: Operator[], category: OperatorTagCategory) {
  const tags = operators.flatMap(operator => {
    if (category === '子职业') return operator.subProfession ? [`${operator.profession}-${operator.subProfession}`] : []
    return operatorTags(operator)[category]
  })
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function formatOperatorTagList(operators: Operator[], category: OperatorTagCategory) {
  const tags = getOperatorTagList(operators, category)
  if (!tags.length) return '暂无可用标签。'
  return tags.slice(0, 50).join('、') + (tags.length > 50 ? `……（其余 ${tags.length - 50} 个标签暂省略）` : '')
}

export function drawRandomOperator(operators: Operator[], parameter = '', now = new Date(), random = Math.random) {
  const starNumbers: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
  const monthOffsets: Record<string, number> = { 本月: 0, 今月: 0, 这个月: 0, 上月: -1, 下月: 1 }
  const tagged = operators.map(operator => ({ operator, tags: Object.values(operatorTags(operator)).flat().map(normalizeTag) }))
  const knownTags = new Set(tagged.flatMap(item => item.tags))
  let candidates = tagged
  const matchedTags: string[] = []
  for (const token of [...new Set(parameter.trim().split(/\s+/).filter(Boolean))]) {
    const stars = token.match(/^([1-6一二两三四五六])星$/)
    if (stars) {
      const count = starNumbers[stars[1]] ?? Number(stars[1])
      candidates = candidates.filter(item => item.operator.stars === count)
    } else if (Object.prototype.hasOwnProperty.call(monthOffsets, token)) {
      const month = new Date(now.getFullYear(), now.getMonth() + monthOffsets[token], 1).getMonth() + 1
      candidates = candidates.filter(item => item.operator.birthday?.month === month)
    } else if (knownTags.has(normalizeTag(token))) {
      candidates = candidates.filter(item => item.tags.includes(normalizeTag(token)))
    } else {
      continue
    }
    matchedTags.push(token)
  }
  const fallback = matchedTags.length > 0 && candidates.length === 0
  const pool = fallback ? operators : candidates.map(item => item.operator)
  return { operator: pool.length ? pool[Math.floor(random() * pool.length)] : undefined, fallback, matchedTags }
}

export function selectRandomOperator(operators: Operator[], parameter = '', now = new Date(), random = Math.random) {
  return drawRandomOperator(operators, parameter, now, random).operator
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
