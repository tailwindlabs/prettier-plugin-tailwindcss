interface ExpiringMap<K, V> {
  get(key: K): V | undefined
  set(key: K, value: V): void
}

export function expiringMap<K, V>(duration: number): ExpiringMap<K, V> {
  let map = new Map<K, { value: V; expiration: Date }>()

  return {
    get(key: K) {
      let result = map.get(key)

      if (result && result.expiration > new Date()) {
        return result.value
      }

      map.delete(key)

      return undefined
    },

    set(key: K, value: V) {
      let expiration = new Date()
      expiration.setMilliseconds(expiration.getMilliseconds() + duration)

      map.set(key, {
        value,
        expiration,
      })
    },
  }
}
