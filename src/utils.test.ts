import { bench, describe, test } from 'vitest'
import type { StringChange } from './types'
import { spliceChangesIntoString } from './utils'

describe('spliceChangesIntoString', () => {
  test('can apply changes to a string', ({ expect }) => {
    let str = 'the quick brown fox jumps over the lazy dog'
    let changes: StringChange[] = [
      //
      { start: 10, end: 15, before: 'brown', after: 'purple' },
    ]

    expect(spliceChangesIntoString(str, changes)).toBe(
      'the quick purple fox jumps over the lazy dog',
    )
  })

  test('changes are applied in order', ({ expect }) => {
    let str = 'the quick brown fox jumps over the lazy dog'
    let changes: StringChange[] = [
      //
      { start: 10, end: 15, before: 'brown', after: 'purple' },
      { start: 4, end: 9, before: 'quick', after: 'slow' },
    ]

    expect(spliceChangesIntoString(str, changes)).toBe(
      'the slow purple fox jumps over the lazy dog',
    )
  })
})
