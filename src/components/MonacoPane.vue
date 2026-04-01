<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { setupLatexEnhancements } from '../editor/latexMonaco'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorHost = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let disposeLatexEnhancements: (() => void) | null = null

function insertLatexAtCursor(snippet: string) {
  if (!editor) return
  const position = editor.getPosition()
  if (!position) return

  const range = new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column,
  )

  editor.executeEdits('quick-math-panel', [{ range, text: snippet, forceMoveMarkers: true }])
  editor.focus()
}

defineExpose({
  insertLatexAtCursor,
})

onMounted(() => {
  if (!editorHost.value) return

  editor = monaco.editor.create(editorHost.value, {
    value: props.modelValue,
    language: 'plaintext',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 22,
    smoothScrolling: true,
    theme: 'vs',
    fontFamily: "'Iosevka Term', 'Fira Code', Consolas, monospace",
  })

  disposeLatexEnhancements = setupLatexEnhancements(editor)

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor?.getValue() ?? '')
  })

  requestAnimationFrame(() => {
    editor?.layout()
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return
    if (value !== editor.getValue()) {
      editor.setValue(value)
    }
  }
)

onBeforeUnmount(() => {
  disposeLatexEnhancements?.()
  editor?.dispose()
})
</script>

<template>
  <section class="editor-pane">
    <div class="panel-title">LaTeX Editor</div>
    <div ref="editorHost" class="editor-host"></div>
  </section>
</template>

<style scoped>
.editor-pane {
  min-height: 0;
}

.editor-host {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
