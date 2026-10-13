import { describe, expect, it } from 'vitest'
import type { Operator } from 'ark-info'
import { parseRandomOperatorMessage, RandomOperatorLimiter, selectRandomOperator } from './random-operator'

const operators: Operator[] = [
  { name: '甲', names: { zh: '甲' }, stars: 5, profession: '先锋', releasedAt: null, nation: '谢拉格', race: '菲林', birthday: { raw: '', month: 12, day: 1 } },
  { name: '乙', names: { zh: '乙' }, stars: 2, profession: '术师', releasedAt: null, organization: '罗德岛', team: '岁', race: '扎拉克', birthday: { raw: '', month: 1, day: 1 } },
]

describe('random operator', () => {
  it('only accepts the exact command or whitespace-separated parameters', () => {
    expect(parseRandomOperatorMessage('随机干员')).toBe('')
    expect(parseRandomOperatorMessage(' 随机干员 谢拉格 ')).toBe('谢拉格')
    expect(parseRandomOperatorMessage('随机干员陪我聊天')).toBeNull()
    expect(parseRandomOperatorMessage('今天随机干员')).toBeNull()
  })
  it.each(['5星', '五星', '谢拉格', '菲林'] )('filters %s', parameter => {
    expect(selectRandomOperator(operators, parameter)?.name).toBe('甲')
  })
  it.each(['2星', '二星', '两星', '罗德岛', '岁', '扎拉克'])('filters %s', parameter => {
    expect(selectRandomOperator(operators, parameter)?.name).toBe('乙')
  })
  it('falls back to the full list for an unknown or empty selection', () => {
    expect(selectRandomOperator(operators, '不存在', new Date(), () => 0.9)?.name).toBe('乙')
    expect(selectRandomOperator(operators, '六星', new Date(), () => 0)?.name).toBe('甲')
    expect(selectRandomOperator([])).toBeUndefined()
  })
  it('matches the package faction hierarchy and race spelling', () => {
    const actual = [{ ...operators[1], organization: '炎-岁', team: '', race: '札拉克' }]
    const pool = [operators[0], ...actual]
    expect(selectRandomOperator(pool, '岁', new Date(), () => 0)?.name).toBe('乙')
    expect(selectRandomOperator(pool, '扎拉克', new Date(), () => 0)?.name).toBe('乙')
  })
  it('handles birthday months across the year boundary', () => {
    expect(selectRandomOperator(operators, '本月', new Date(2026, 11, 31))?.name).toBe('甲')
    expect(selectRandomOperator(operators, '下月', new Date(2026, 11, 31))?.name).toBe('乙')
  })
  it('limits each user independently with a rolling window', () => {
    const limiter = new RandomOperatorLimiter()
    for (let index = 0; index < 10; index++) expect(limiter.take('a', index)).toBe(true)
    expect(limiter.take('a', 10)).toBe(false)
    expect(limiter.take('b', 10)).toBe(true)
    expect(limiter.take('a', 300_000)).toBe(true)
    expect(limiter.take('a', 300_000)).toBe(false)
    limiter.prune(600_001)
    expect(limiter.take('a', 600_001)).toBe(true)
  })
})
