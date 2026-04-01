<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorHost = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorHost.value) return

  editor = monaco.editor.create(editorHost.value, {
    value: props.modelValue,
    language: 'latex',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 22,
    theme: 'vs',
    fontFamily: "'Iosevka Term', 'Fira Code', Consolas, monospace",
  })

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor?.getValue() ?? '')
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
  editor?.dispose()
})
</script>

<template>
  <section class="editor-pane">
    <div class="panel-title">LaTeX Editor</div>
    <div ref="editorHost" class="editor-host"></div>
  </section>
</template>
