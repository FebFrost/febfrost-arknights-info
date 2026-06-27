import type { BirthdayEntry, getOperatorAssets } from 'ark-info'

export type OperatorAvatarMap = Record<string, string>
type GetOperatorAssetsFn = typeof getOperatorAssets

export async function resolveOperatorAvatars(
  getOperatorAssets: GetOperatorAssetsFn,
  entries: BirthdayEntry[],
  options: {
    endpoint?: string
  } = {}
): Promise<OperatorAvatarMap> {
  const names = [...new Set(entries.map((entry) => entry.name))]
  if (!names.length) return {}

  const assets = await getOperatorAssets({
    names,
    skinLimit: 0,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
  })

  return assets.reduce<OperatorAvatarMap>((result, item) => {
    if (item.avatar?.url) result[item.name] = item.avatar.url
    return result
  }, {})
}
