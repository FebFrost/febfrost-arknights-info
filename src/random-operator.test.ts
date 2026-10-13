import { describe, expect, it } from 'vitest'
import type { Operator } from 'ark-info'
import { drawRandomOperator, formatOperatorTagList, getOperatorTagList, parseRandomOperatorMessage, RandomOperatorLimiter, selectRandomOperator } from './random-operator'

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
  it('intersects profession and stars regardless of order', () => {
    const orchid = { ...operators[0], name: '梓兰', profession: '辅助', stars: 3 }
    const pool = [...operators, orchid, { ...orchid, name: '其他辅助', stars: 5 }]
    expect(drawRandomOperator(pool, '辅助 3星').operator?.name).toBe('梓兰')
    expect(drawRandomOperator(pool, '三星 辅助').operator?.name).toBe('梓兰')
    expect(drawRandomOperator(pool, '辅助 不存在 3星').operator?.name).toBe('梓兰')
  })
  it('reports recognized tags with an empty intersection', () => {
    expect(drawRandomOperator(operators, '先锋 两星', new Date(), () => 0)).toMatchObject({
      fallback: true, matchedTags: ['先锋', '两星'], operator: { name: '甲' },
    })
    expect(drawRandomOperator(operators, '不存在').fallback).toBe(false)
  })
  it('supports standalone and qualified sub-professions with spelling aliases', () => {
    const caster = { ...operators[1], name: '本源干员', subProfession: '本源术师' }
    const pool = [operators[0], caster]
    for (const query of ['本源术士', '术士-本源术士', '术师 本源术师 二星']) {
      expect(drawRandomOperator(pool, query).operator?.name).toBe('本源干员')
    }
    expect(getOperatorTagList(pool, '子职业')).toEqual(['术师-本源术师'])
  })
  it('deduplicates tag lists, omits missing fields and limits output to 50', () => {
    expect(getOperatorTagList(operators, '职业')).toHaveLength(2)
    expect(getOperatorTagList(operators, '子职业')).toEqual([])
    const pool = Array.from({ length: 52 }, (_, index) => ({ ...operators[0], race: `种族${index}` }))
    const text = formatOperatorTagList(pool, '种族')
    expect(text.split('……')[0].split('、')).toHaveLength(50)
    expect(text).toContain('其余 2 个标签暂省略')
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
