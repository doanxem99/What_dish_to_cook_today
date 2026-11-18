import { ref } from 'vue'

//One list for the whole admin area; the layout renders the host.
const items = ref([])
let nextId = 0

export function notify(text, kind = 'ok') {
  if (!text) {
    return
  }
  const id = ++nextId
  items.value.push({ id, text, kind })
  setTimeout(() => dismiss(id), 6000)
}

export function dismiss(id) {
  items.value = items.value.filter(item => item.id !== id)
}

export function useToasts() {
  return { items, dismiss }
}
