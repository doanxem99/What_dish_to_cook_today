import { describe, expect, it } from 'vitest'
import {
  errorKind,
  filterQuery,
  formatBytes,
  formatCost,
  formatTokens,
  hasActiveJobs,
  jobStatusLabel,
  jobTypeLabel,
  maintenanceReason,
  rowGuard,
  typedWordMatches
} from './admin_format.js'

//A translator that only knows the admin keys used below keeps the test readable.
const catalogue = {
  'admin.job.status.queued': 'Queued',
  'admin.job.status.running': 'Running',
  'admin.job.status.done': 'Done',
  'admin.job.status.failed': 'Failed',
  'admin.job.type.backup': 'Backup',
  'admin.job.type.reset': 'Reset',
  'common.unknown': 'Unknown'
}
const t = key => catalogue[key] || key

describe('job labels', () => {
  it('translates a known status and type', () => {
    expect(jobStatusLabel('running', t)).toBe('Running')
    expect(jobTypeLabel('backup', t)).toBe('Backup')
  })

  it('keeps an unknown server value readable', () => {
    expect(jobStatusLabel('paused', t)).toBe('paused')
    expect(jobTypeLabel('ai', t)).toBe('ai')
  })

  it('falls back to unknown for an empty value', () => {
    expect(jobStatusLabel('', t)).toBe('Unknown')
    expect(jobTypeLabel(null, t)).toBe('Unknown')
  })
})

describe('formatBytes', () => {
  it('renders a raw byte count under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(900)).toBe('900 B')
  })

  it('scales to KB and MB with one decimal below ten', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(12 * 1024)).toBe('12 KB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })

  it('refuses an unusable value instead of printing NaN', () => {
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes('abc')).toBe('—')
  })
})

describe('formatCost and formatTokens', () => {
  it('keeps four decimals for a tiny cost', () => {
    expect(formatCost(0.0042)).toBe('$0.0042')
    expect(formatCost(1.5)).toBe('$1.5000')
  })

  it('groups token counts', () => {
    expect(formatTokens(12400)).toBe('12,400')
  })

  it('shows an em dash when the server sent nothing', () => {
    expect(formatCost(null)).toBe('—')
    expect(formatTokens(undefined)).toBe('—')
  })
})

describe('typedWordMatches', () => {
  it('accepts the word in any case and with padding', () => {
    expect(typedWordMatches('RESTORE', 'RESTORE')).toBe(true)
    expect(typedWordMatches('  restore ', 'RESTORE')).toBe(true)
  })

  it('rejects a partial, empty or wrong word', () => {
    expect(typedWordMatches('REST', 'RESTORE')).toBe(false)
    expect(typedWordMatches('', 'RESTORE')).toBe(false)
    expect(typedWordMatches('reset', 'RESTORE')).toBe(false)
    expect(typedWordMatches(null, 'RESTORE')).toBe(false)
  })
})

describe('filterQuery', () => {
  it('keeps only the filters the server can use', () => {
    expect(filterQuery({ type: 'backup', status: '', page: 2, q: undefined, actor: null, action: 'user.role' }))
      .toEqual({ type: 'backup', page: 2, action: 'user.role' })
  })

  it('returns an empty object when nothing is set', () => {
    expect(filterQuery({})).toEqual({})
    expect(filterQuery()).toEqual({})
  })
})

describe('rowGuard', () => {
  const other = { id: 'u2', username: 'cook', roles: ['user'], is_disabled: false }
  const boss = { id: 'u1', username: 'boss', roles: ['user', 'admin'], is_disabled: false }

  it('blocks a self demote by id', () => {
    expect(rowGuard(boss, { currentUserId: 'u1' })).toBe('self')
  })

  it('blocks a self demote by username when the stored session has no id', () => {
    expect(rowGuard(boss, { currentUsername: 'boss' })).toBe('self')
  })

  it('blocks the last enabled admin from being demoted', () => {
    expect(rowGuard(boss, { currentUserId: 'u9', enabledAdmins: 1 })).toBe('last_admin')
  })

  it('allows an ordinary account and a non-last admin', () => {
    expect(rowGuard(other, { currentUserId: 'u1', enabledAdmins: 3 })).toBe('')
    expect(rowGuard(boss, { currentUserId: 'u9', enabledAdmins: 2 })).toBe('')
  })

  it('does not guard a row before the admin count is known', () => {
    expect(rowGuard(boss, { currentUserId: 'u9' })).toBe('')
  })
})

describe('errorKind', () => {
  it('maps the statuses the views render explicitly', () => {
    expect(errorKind({ status: 401 })).toBe('unauthorized')
    expect(errorKind({ status: 403 })).toBe('forbidden')
    expect(errorKind({ status: 409 })).toBe('conflict')
    expect(errorKind({ status: 502 })).toBe('server')
    expect(errorKind({ status: 400 })).toBe('request')
    expect(errorKind({})).toBe('network')
  })
})

describe('hasActiveJobs', () => {
  it('is true only while a queued or running row is on screen', () => {
    expect(hasActiveJobs([{ status: 'done' }, { status: 'running' }])).toBe(true)
    expect(hasActiveJobs([{ status: 'queued' }])).toBe(true)
    expect(hasActiveJobs([{ status: 'done' }, { status: 'failed' }])).toBe(false)
    expect(hasActiveJobs([])).toBe(false)
  })
})

describe('maintenanceReason', () => {
  const reasons = {
    'admin.maintenance.reason.catalogReset': 'Reset in progress',
    'admin.maintenance.reason.catalogRestore': 'Restore in progress'
  }
  const translate = key => reasons[key] || key

  it('translates the reasons the server writes', () => {
    expect(maintenanceReason('catalog reset', translate)).toBe('Reset in progress')
    expect(maintenanceReason('catalog restore', translate)).toBe('Restore in progress')
  })

  it('keeps an unknown sentence and an empty value readable', () => {
    expect(maintenanceReason('some new job', translate)).toBe('some new job')
    expect(maintenanceReason('', translate)).toBe('')
    expect(maintenanceReason(null, translate)).toBe('')
  })
})
