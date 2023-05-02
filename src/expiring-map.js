/**
 * @template K
 * @template V
 * @typedef {object} ExpiringMap
 * @property {(key: K) => V | undefined} get
 * @property {(key: K, value: V) => void} set
 */

/**
 * @template K
 * @template V
 * @param {number} duration
 * @returns {ExpiringMap<K, V>}
 */
export function expiringMap(duration) {
  /** @type {Map<K, {value: V, expiration: number}>} */
  let map = new Map()

  return {
    get(key) {
      if (map.has(key)) {
        let result = map.get(key)
        if (result.expiration > new Date()) {
          return result.value
        }
      }
    },
    set(key, value) {
      let expiration = new Date()
      expiration.setMilliseconds(expiration.getMilliseconds() + duration)

      map.set(key, {
        value,
        expiration,
      })
    },
  }
}
