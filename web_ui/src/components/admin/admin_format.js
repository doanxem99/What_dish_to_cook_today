//Pure helpers for the admin views. No Vue, no i18n singleton: the tests call these directly.

export const JOB_TYPES = ['reset', 'backup', 'restore', 'recalc_best_post']
export const JOB_STATUSES = ['queued', 'running', 'done', 'failed']
//Restore and reset are never retried from the page: they rewrite the catalog.
export const RETRYABLE_TYPES = ['recalc_best_post']

const TYPE_KEYS = {
  backup: 'admin.job.type.backup',
  reset: 'admin.job.type.reset',
  restore: 'admin.job.type.restore',
  recalc_best_post: 'admin.job.type.recalc_best_post'
}

const STATUS_KEYS = {
  queued: 'admin.job.status.queued',
  running: 'admin.job.status.running',
  done: 'admin.job.status.done',
  failed: 'admin.job.status.failed'
}

const label = function(value, keys, translate) {
  if (!value) {
    return translate('common.unknown')
  }
  return keys[value] ? translate(keys[value]) : String(value)
}

export const jobTypeLabel = (value, translate) => label(value, TYPE_KEYS, translate)
export const jobStatusLabel = (value, translate) => label(value, STATUS_KEYS, translate)

const BYTE_UNITS = ['KB', 'MB', 'GB']

//Binary units, one decimal below ten so a 1.5 MB archive does not read as 1 MB.
export function formatBytes(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size < 0) {
    return '—'
  }
  if (size < 1024) {
    return `${size} B`
  }
  let value = size
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < BYTE_UNITS.length - 1)
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`
}

//AI costs are fractions of a cent; four decimals keeps them readable.
export function formatCost(value) {
  const cost = Number(value)
  return Number.isFinite(cost) && value !== null && value !== '' ? `$${cost.toFixed(4)}` : '—'
}

export function formatTokens(value) {
  const tokens = Number(value)
  return Number.isFinite(tokens) && value !== null && value !== '' ? tokens.toLocaleString('en') : '—'
}

//The server compares the word exactly, so the page compares case-insensitively and sends the
//canonical word. Padding from a paste must not block the confirm.
export function typedWordMatches(typed, word) {
  const expected = String(word || '').trim().toUpperCase()
  if (!expected) {
    return false
  }
  return String(typed || '').trim().toUpperCase() === expected
}

//Only values the endpoint can use; a blank select must not narrow the result.
export function filterQuery(source) {
  const out = {}
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value
    }
  })
  return out
}

export function hasActiveJobs(rows) {
  return (rows || []).some(row => row && (row.status === 'queued' || row.status === 'running'))
}

//The server writes an English sentence; known ones get a catalogue key, unknown ones stay readable.
const MAINTENANCE_REASON_KEYS = {
  'catalog reset': 'admin.maintenance.reason.catalogReset',
  'catalog restore': 'admin.maintenance.reason.catalogRestore'
}

export function maintenanceReason(reason, translate) {
  const text = String(reason || '')
  const key = MAINTENANCE_REASON_KEYS[text]
  return key ? translate(key) : text
}

const isAdminRow = row => Boolean(row && Array.isArray(row.roles) && row.roles.includes('admin'))

//The server owns the real guard; this only stops the page from offering a request it must reject.
//enabledAdmins is the count of unlocked admins, known only when the whole listing fits one page.
export function rowGuard(row, options) {
  const source = options || {}
  if (!row) {
    return ''
  }
  if (source.currentUserId && row.id === source.currentUserId) {
    return 'self'
  }
  if (source.currentUsername && row.username === source.currentUsername) {
    return 'self'
  }
  if (isAdminRow(row) && row.is_disabled !== true && source.enabledAdmins === 1) {
    return 'last_admin'
  }
  return ''
}

//api/index.js throws {status, message, data}; the views render one panel per kind.
export function errorKind(error) {
  const status = Number(error && error.status)
  if (status === 401) {
    return 'unauthorized'
  }
  if (status === 403) {
    return 'forbidden'
  }
  if (status === 409) {
    return 'conflict'
  }
  if (status >= 500) {
    return 'server'
  }
  return status ? 'request' : 'network'
}
