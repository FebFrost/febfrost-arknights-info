import { describe, expect, it, vi } from 'vitest'
import { apply, type PluginConfig } from './index'
import type { Context } from 'koishi'

vi.mock('koishi', async () => ({
  Schema: (await import('schemastery')).default,
  h: (await import('@satorijs/element')).default,
}))
vi.mock('./push-toggle', () => ({ loadPushToggleIntegration: () => null }))
vi.mock('ark-info', () => ({
  getOperators: vi.fn(async () => [{ name: '测试干员', names: { zh: '测试干员', en: 'Test' }, stars: 5, profession: '先锋', releasedAt: null }]),
}))

function setup() {
  let handle: ReturnType<typeof vi.fn>
  const command = { alias: () => command, action: () => command }
  const ctx = {
    logger: () => ({ warn: vi.fn(), info: vi.fn() }),
    model: { extend: vi.fn() },
    setInterval: vi.fn(),
    command: () => command,
    cron: vi.fn(),
    on: (_event: string, callback: ReturnType<typeof vi.fn>) => { handle = callback },
  }
  apply(ctx as unknown as Context, { targetGroups: [] } as PluginConfig)
  return (content: string, userId = 'user') => {
    const send = vi.fn()
    return { send, run: () => handle({ content, userId, selfId: 'bot', platform: 'onebot', send }) }
  }
}

describe('random operator message entry', () => {
  it('responds without an mention and limits the eleventh request', async () => {
    const message = setup()
    for (let index = 0; index < 10; index++) {
      const session = message('随机干员 两星')
      await session.run()
      expect(session.send).toHaveBeenCalledWith(expect.stringContaining('测试干员 (Test)'))
    }
    const limited = message('随机干员')
    await limited.run()
    expect(limited.send).toHaveBeenCalledWith(expect.stringContaining('最多抽取 10 次'))
  })
  it('ignores chatting suffixes and bot messages', async () => {
    const message = setup()
    for (const session of [message('随机干员陪我聊天'), message('随机干员', 'bot')]) {
      await session.run()
      expect(session.send).not.toHaveBeenCalled()
    }
  })
})
