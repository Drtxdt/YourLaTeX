<script setup lang="ts">
const props = defineProps<{
  workspacePath: string
  currentFilePath: string
  compiling: boolean
  selectedCompiler: string
  availableCompilers: Array<{ id: string; label: string; available: boolean }>
}>()

const emit = defineEmits<{
  openWorkspace: []
  saveFile: []
  compile: []
  changeCompiler: [compilerId: string]
}>()

function handleCompilerChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('changeCompiler', target.value)
}
</script>

<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="brand">YourLaTeX</div>
      <div class="subtitle">Desktop Academic Editor</div>
    </div>
    <div class="toolbar-center">
      <div class="path-row">
        <span class="label">Workspace</span>
        <span class="value">{{ props.workspacePath || 'Not selected' }}</span>
      </div>
      <div class="path-row">
        <span class="label">File</span>
        <span class="value">{{ props.currentFilePath || 'No file opened' }}</span>
      </div>
    </div>
    <div class="toolbar-actions">
      <select class="compiler-select" :value="props.selectedCompiler" @change="handleCompilerChange">
        <option
          v-for="compiler in props.availableCompilers"
          :key="compiler.id"
          :value="compiler.id"
          :disabled="!compiler.available"
        >
          {{ compiler.label }}{{ compiler.available ? '' : ' (not found)' }}
        </option>
      </select>
      <button class="btn btn-soft" type="button" @click="emit('openWorkspace')">Open Folder</button>
      <button class="btn btn-soft" type="button" :disabled="!props.currentFilePath" @click="emit('saveFile')">Save</button>
      <button class="btn btn-accent" type="button" :disabled="!props.workspacePath || props.compiling" @click="emit('compile')">
        {{ props.compiling ? 'Compiling...' : 'Compile PDF' }}
      </button>
    </div>
  </header>
</template>
