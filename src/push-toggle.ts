import { createRequire } from 'node:module'
import { join } from 'node:path'

export interface PushToggleDefinition {
  id: string
  label: string
  state(groupId: string): boolean
  set(groupId: string, on?: boolean): Promise<{
    ok: boolean
    enabled: boolean
    message: string
    triggers: string[]
  }>
}

/** 宿主提供的推送开关联动；这些私有插件不是生日查询和定时推送的必需依赖。 */
export interface PushToggleIntegration {
  pushToggleRegistry: { register(definition: PushToggleDefinition): unknown }
  loadPushState(baseDir: string): Record<string, Record<string, unknown>>
  savePushState(baseDir: string, key: string, state: Record<string, string[]>): unknown
  triggerTimeSection(label: string, crons: string[]): { lines: string[] }
}

const requireHost = createRequire(join(__dirname, 'push-toggle-loader.cjs'))

function loadHostModule(name: string): unknown {
  let path: string
  try {
    path = requireHost.resolve(name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return
    throw error
  }
  // 已安装模块的加载错误不能伪装成“未安装”。
  return requireHost(path)
}

export function loadPushToggleIntegration(
  logger: { warn(message: string): unknown },
  loadModule: (name: string) => unknown = loadHostModule,
): PushToggleIntegration | undefined {
  const push = loadModule('koishi-plugin-push-toggle') as Partial<PushToggleIntegration> | undefined
  const cron = loadModule('koishi-plugin-cron-text') as Partial<PushToggleIntegration> | undefined
  if (!push || !cron) {
    logger.warn('未安装宿主推送开关插件 push-toggle/cron-text，跳过开关联动；配置中的定时推送继续运行。')
    return
  }
  if (typeof push.pushToggleRegistry?.register !== 'function'
    || typeof push.loadPushState !== 'function'
    || typeof push.savePushState !== 'function'
    || typeof cron.triggerTimeSection !== 'function') {
    throw new Error('宿主推送开关插件导出不完整，请检查 push-toggle/cron-text 版本。')
  }
  return {
    pushToggleRegistry: push.pushToggleRegistry,
    loadPushState: push.loadPushState,
    savePushState: push.savePushState,
    triggerTimeSection: cron.triggerTimeSection,
  }
}
