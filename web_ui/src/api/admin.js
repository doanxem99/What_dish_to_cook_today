import api from './index.js'

//Builds ?a=1&b=2 and drops empty filters, so a blank select does not narrow the result.
function query(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value)
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const adminApi = {
  health: () => api.get('/api/admin/health'),
  jobs: params => api.get('/api/admin/jobs' + query(params)),
  backups: () => api.get('/api/admin/backups'),
  users: params => api.get('/api/admin/users' + query(params)),
  audit: params => api.get('/api/admin/audit' + query(params)),
  backup: () => api.post('/api/admin/backup'),
  restore: (backupId, confirm) => api.post('/api/admin/restore', { backup_id: backupId, confirm }),
  reset: confirm => api.post('/api/admin/reset', { confirm }),
  setRole: (userId, admin) => api.post(`/api/admin/users/${userId}/role`, { admin }),
  setDisabled: (userId, disabled) => api.post(`/api/admin/users/${userId}/disabled`, { disabled }),
  temporaryPassword: userId => api.post(`/api/admin/users/${userId}/password`),
  recalcBestPost: ingredientId => api.post('/api/admin/jobs/recalc-best-post', { ingredient_id: ingredientId }),
  aiUsage: () => api.get('/api/admin/ai/usage'),
  setAiEnabled: enabled => api.post('/api/admin/ai/enabled', { enabled }),
  reindexAi: () => api.post('/api/admin/ai/reindex'),
  setUserAi: (userId, patch) => api.post(`/api/admin/ai/users/${userId}`, patch)
}

export default adminApi
