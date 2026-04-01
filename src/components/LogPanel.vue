<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  logs: string[]
}>()

const logContentRef = ref<HTMLElement | null>(null)

watch(
  () => props.logs.length,
  async () => {
    await nextTick()
    const el = logContentRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  }
)
</script>

<template>
  <section class="log-panel">
    <div class="panel-title">Compiler Log</div>
    <pre ref="logContentRef" class="log-content">{{ props.logs.join('') }}</pre>
  </section>
</template>
