<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return { rows: [], loading: true, failed: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value }
  },
  mounted() { this.load() },
  methods: {
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    async load() {
      this.loading = true
      this.failed = false
      try {
        const payload = await api.get('/api/dish/selection/homemade')
        this.rows = payload && Array.isArray(payload.data) ? payload.data : []
      } catch (error) {
        this.rows = []
        this.failed = true
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <section class="board py-6">
    <h1 class="board-title">{{ t('homemade.title') }}</h1>
    <p class="board-sub">{{ t('homemade.subtitle') }}</p>

    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>
    <p v-else-if="rows.length === 0" class="state">{{ t('homemade.empty') }}</p>

    <ul v-else class="mt-4 ruled">
      <li v-for="row in rows" :key="row.id" class="row-line">
        <router-link class="flex items-center gap-4 p-2" :to="{ path: '/dish_detail', query: { dish_id: row.id } }">
          <img v-if="row.profile_image" class="w-12 h-12 object-cover rounded" :src="image(row.profile_image)" alt="" />
          <span class="flex-1">
            <span class="block font-bold">{{ localName(row) }}</span>
            <span class="block text-sm" style="color: var(--board-dim)">
              {{ locale === 'vi' && row.short_detail_vi ? row.short_detail_vi : row.short_detail }}
            </span>
          </span>
        </router-link>
      </li>
    </ul>
  </section>
</template>
