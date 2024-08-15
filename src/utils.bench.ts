import { bench, describe } from 'vitest'
import type { StringChange } from './types'
import { spliceChangesIntoString } from './utils'

describe('spliceChangesIntoString', () => {
  // 44 bytes
  let strTemplate = 'the quick brown fox jumps over the lazy dog '
  let changesTemplate: StringChange[] = [
    { start: 10, end: 15, before: 'brown', after: 'purple' },
    { start: 4, end: 9, before: 'quick', after: 'slow' },
  ]

  function buildFixture(repeatCount: number, changeCount: number) {
    // A large set of changes across random places in the string
    let indxes = new Set(
      Array.from({ length: changeCount }, (_, i) =>
        Math.ceil(Math.random() * repeatCount),
      ),
    )

    let changes: StringChange[] = Array.from(indxes).flatMap((idx) => {
      return changesTemplate.map((change) => ({
        start: change.start + strTemplate.length * idx,
        end: change.end + strTemplate.length * idx,
        before: change.before,
        after: change.after,
      }))
    })

    return [strTemplate.repeat(repeatCount), changes] as const
  }

  let [strS, changesS] = buildFixture(5, 2)
  bench('small string', () => {
    spliceChangesIntoString(strS, changesS)
  })

  let [strM, changesM] = buildFixture(100, 5)
  bench('medium string', () => {
    spliceChangesIntoString(strM, changesM)
  })

  let [strL, changesL] = buildFixture(1_000, 50)
  bench('large string', () => {
    spliceChangesIntoString(strL, changesL)
  })

  let [strXL, changesXL] = buildFixture(100_000, 500)
  bench('extra large string', () => {
    spliceChangesIntoString(strXL, changesXL)
  })

  let [strXL2, changesXL2] = buildFixture(100_000, 5_000)
  bench('extra large string (5k changes)', () => {
    spliceChangesIntoString(strXL2, changesXL2)
  })
})
