<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { rowGuard } from './admin_format.js'

const props = defineProps({
  row: { type: Object, required: true },
  me: { type: Object, default: () => ({}) },
  enabledAdmins: { type: Number, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['role', 'disabled', 'password', 'ai', 'limit'])
const { t } = useI18n()

const isAdmin = computed(() => (props.row.roles || []).includes('admin'))
const isDisabled = computed(() => props.row.is_disabled === true)
const aiDisabled = computed(() => props.row.ai_disabled === true)
const limit = ref('')

//The saved row replaces the prop after a successful call; the field follows it.
watch(
  () => props.row.ai_daily_limit,
  value => {
    limit.value = value === null || value === undefined ? '' : String(value)
  },
  { immediate: true }
)

const limitValue = computed(() => {
  const raw = String(limit.value).trim()
  if (!raw) {
    return null
  }
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= 1000 ? value : NaN
})
const limitValid = computed(() => !Number.isNaN(limitValue.value))
const limitChanged = computed(() => {
  const saved = props.row.ai_daily_limit === undefined ? null : props.row.ai_daily_limit
  return limitValid.value && limitValue.value !== saved
})
const guard = computed(() => rowGuard(props.row, {
  currentUserId: props.me.id,
  currentUsername: props.me.username,
  enabledAdmins: props.enabledAdmins
}))

//The server answers 409 with a code; its message is English, so the page names the conflict.
const note = computed(() => {
  if (props.error) {
    return props.error
  }
  if (guard.value === 'self') {
    return t('admin.users.selfNote')
  }
  if (guard.value === 'last_admin') {
    return t('admin.users.lastAdminNote')
  }
  return ''
})

const joined = computed(() => {
  if (!props.row.created_at) return '—'
  const date = new Date(props.row.created_at)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
})

function saveLimit() {
  if (props.busy || !limitChanged.value) {
    return
  }
  emit('limit', props.row, limitValue.value)
}
</script>

<template>
  <tr :class="{ 'is-disabled': isDisabled }">
    <td class="user-name" :data-label="t('admin.users.username')">{{ row.username }}</td>
    <td class="user-email" :data-label="t('admin.users.email')" :title="row.email">{{ row.email }}</td>
    <td :data-label="t('admin.users.role')">
      <span class="chip user-chip" :class="{ 'is-admin': isAdmin }">
        {{ isAdmin ? t('admin.users.admin') : t('admin.users.user') }}
      </span>
    </td>
    <td :data-label="t('admin.users.status')">
      <span v-if="isDisabled" class="chip user-chip is-off">{{ t('admin.users.disabled') }}</span>
      <span v-else class="user-state">{{ t('admin.users.active') }}</span>
    </td>
    <td class="user-joined" :data-label="t('admin.users.joined')">{{ joined }}</td>
    <td class="user-actions" :data-label="t('admin.common.actions')">
      <div class="admin-row-actions">
        <button
          class="btn"
          type="button"
          :disabled="busy || (isAdmin && Boolean(guard))"
          @click="emit('role', row, !isAdmin)"
        >{{ isAdmin ? t('admin.users.demote') : t('admin.users.promote') }}</button>
        <button
          class="btn"
          type="button"
          :disabled="busy || (!isDisabled && Boolean(guard))"
          @click="emit('disabled', row, !isDisabled)"
        >{{ isDisabled ? t('admin.users.enable') : t('admin.users.disable') }}</button>
        <button class="btn btn-quiet" type="button" :disabled="busy" @click="emit('password', row)">
          {{ t('admin.users.password') }}
        </button>
      </div>
      <div class="admin-row-ai">
        <button class="btn btn-quiet" type="button" :disabled="busy" @click="emit('ai', row, !aiDisabled)">
          {{ aiDisabled ? t('admin.ai.userEnable') : t('admin.ai.userDisable') }}
        </button>
        <label class="admin-ai-limit">
          <span class="admin-ai-limit-label">{{ t('admin.ai.dailyLimit') }}</span>
          <input
            v-model="limit"
            class="input"
            type="number"
            min="0"
            max="1000"
            step="1"
            :placeholder="t('admin.ai.dailyLimitDefault')"
            :aria-invalid="limitValid ? 'false' : 'true'"
            :disabled="busy"
          />
        </label>
        <button class="btn btn-quiet" type="button" :disabled="busy || !limitChanged" @click="saveLimit">
          {{ t('admin.common.apply') }}
        </button>
        <span v-if="aiDisabled || !limitValid" class="admin-ai-limit-state">
          {{ limitValid ? t('admin.ai.userDisabled') : t('admin.ai.limitInvalid') }}
        </span>
      </div>
      <p v-if="note" class="user-note" role="alert">{{ note }}</p>
    </td>
  </tr>
</template>

<style>
.user-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.user-email {
  max-width: 26ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--board-dim);
}

.user-chip {
  font-size: 12px;
  padding: 2px 9px;
}

.user-chip.is-admin {
  border-color: var(--board-amber);
  color: var(--board-amber);
}

.user-chip.is-off {
  border-style: dashed;
  color: var(--board-dim);
}

.user-state {
  font-size: 13px;
  color: var(--board-green);
}

.user-joined {
  white-space: nowrap;
  color: var(--board-dim);
  font-variant-numeric: tabular-nums;
}

.admin-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.admin-row-actions .btn {
  font-size: 12px;
  padding: 4px 8px;
}

.admin-row-ai {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  margin-top: var(--space-1);
}

.admin-row-ai .btn {
  font-size: 12px;
  padding: 4px 8px;
}

.admin-ai-limit {
  display: flex;
  align-items: center;
  gap: 4px;
}

.admin-ai-limit-label {
  font-size: 11px;
  color: var(--board-dim);
}

.admin-ai-limit .input {
  width: 76px;
  font-size: 12px;
  padding: 3px 6px;
}

.admin-ai-limit-state {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--board-dim);
}

.user-note {
  margin: var(--space-1) 0 0;
  font-size: 12px;
  color: var(--board-danger);
}

tr.is-disabled .user-name,
tr.is-disabled .user-email {
  color: var(--board-dim);
}

@media (max-width: 639px) {
  .user-email {
    max-width: none;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .user-actions {
    margin-top: var(--space-1);
  }
}
</style>
