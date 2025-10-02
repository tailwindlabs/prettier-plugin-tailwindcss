let seen = new Set<string>()

export function log(key: string, arg: unknown, ...args: unknown[]) {
  if (seen.has(key)) return
  seen.add(key)
  console.log(arg, ...args)
}

export function warn(key: string, arg: unknown, ...args: unknown[]) {
  if (seen.has(key)) return
  seen.add(key)
  console.warn(arg, ...args)
}

export function error(key: string, arg: unknown, ...args: unknown[]) {
  if (seen.has(key)) return
  seen.add(key)
  console.error(arg, ...args)
}
