<script setup lang="ts">
const props = defineProps<{
  pdfPath: string
}>()

function toFileUrl(filePath: string) {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  return `file:///${normalized}`
}
</script>

<template>
  <section class="pdf-pane">
    <div class="panel-title">PDF Preview</div>
    <div class="pdf-frame-wrap">
      <iframe v-if="props.pdfPath" :src="toFileUrl(props.pdfPath)" class="pdf-frame" title="PDF Preview"></iframe>
      <div v-else class="pdf-placeholder">Compile to generate and preview a PDF file.</div>
    </div>
  </section>
</template>
