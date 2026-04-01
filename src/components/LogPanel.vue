<script setup lang="ts">
const props = defineProps<{
  logs: string[]
}>()
</script>

<template>
  <section class="log-panel">
    <div class="panel-title">Compiler Log</div>
    <pre class="log-content">{{ props.logs.join('') }}</pre>
  </section>
</template>
