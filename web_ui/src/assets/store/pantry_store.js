import { defineStore } from 'pinia'

const STORAGE_KEY = 'pantry'

function read() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
    } catch (error) {
        return []
    }
}

//The chosen ingredients survive navigation and reloads; the board depends on them.
export const usePantryStore = defineStore('pantry', {
    state: () => ({ items: read() }),
    getters: {
        ids: state => state.items.map(item => item.id),
        total: state => state.items.length
    },
    actions: {
        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items))
            } catch (error) {
                //Storage can be full or blocked; the session still works
            }
        },
        add(item) {
            if (!this.items.find(entry => entry.id === item.id)) {
                this.items.push({ id: item.id, name: item.name, name_vi: item.name_vi || null })
                this.save()
            }
        },
        remove(id) {
            this.items = this.items.filter(entry => entry.id !== id)
            this.save()
        },
        toggle(item) {
            if (this.items.find(entry => entry.id === item.id)) {
                this.remove(item.id)
            } else {
                this.add(item)
            }
        },
        clear() {
            this.items = []
            this.save()
        }
    }
})
