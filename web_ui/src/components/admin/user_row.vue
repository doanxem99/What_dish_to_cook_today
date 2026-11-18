<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { rowGuard } from './admin_format.js'

const props = defineProps({
  row: { type: Object, required: true },
  me: { type: Object, default: () => ({}) },
  enabledAdmins: { type: Number, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['role', 'disabled', 'password'])
const { t } = useI18n()

const isAdmin = computed(() => (props.row.roles || []).includes('admin'))
const isDisabled = computed(() => props.row.is_disabled === true)
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
