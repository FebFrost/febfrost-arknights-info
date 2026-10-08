import { describe, expect, it, vi } from 'vitest'
import { loadPushToggleIntegration } from './push-toggle'

describe('optional host push integration', () => {
  it('keeps birthday queries usable when host plugins are absent', () => {
    const logger = { warn: vi.fn() }
    expect(loadPushToggleIntegration(logger, () => undefined)).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledOnce()
  })

  it('exposes the installed registry, persistence and schedule formatter', () => {
    const push = {
      pushToggleRegistry: { register: vi.fn() },
      loadPushState: vi.fn(() => ({ arknightsBirthday: { targetGroups: ['group'] } })),
      savePushState: vi.fn(),
    }
    const cron = { triggerTimeSection: vi.fn(() => ({ lines: ['daily'] })) }
    const integration = loadPushToggleIntegration({ warn: vi.fn() }, name =>
      name === 'koishi-plugin-push-toggle' ? push : cron)
    expect(integration?.pushToggleRegistry).toBe(push.pushToggleRegistry)
    expect(integration?.loadPushState('base').arknightsBirthday.targetGroups).toEqual(['group'])
    integration?.savePushState('base', 'arknightsBirthday', { targetGroups: ['group'] })
    expect(push.savePushState).toHaveBeenCalledWith('base', 'arknightsBirthday', { targetGroups: ['group'] })
    expect(integration?.triggerTimeSection('daily', ['0 0 * * *']).lines).toEqual(['daily'])
  })

  it('reports broken installed plugins instead of silently disabling them', () => {
    expect(() => loadPushToggleIntegration({ warn: vi.fn() }, () => ({})))
      .toThrow('宿主推送开关插件导出不完整')
    expect(() => loadPushToggleIntegration({ warn: vi.fn() }, () => {
      throw new Error('installed plugin initialization failed')
    })).toThrow('installed plugin initialization failed')
  })
})
