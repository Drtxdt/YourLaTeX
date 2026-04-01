<script setup lang="ts">
const props = defineProps<{
  pdfDataUrl: string
}>()
</script>

<template>
  <section class="pdf-pane">
    <div class="panel-title">PDF Preview</div>
    <div class="pdf-frame-wrap">
      <embed
        v-if="props.pdfDataUrl"
        :src="props.pdfDataUrl"
        type="application/pdf"
        class="pdf-frame"
      />
      <div v-else class="pdf-placeholder">Compile to generate and preview a PDF file.</div>
    </div>
  </section>
</template>
