<script setup lang="ts">
const props = defineProps<{
  workspacePath: string
  currentFilePath: string
  compiling: boolean
}>()

const emit = defineEmits<{
  openWorkspace: []
  saveFile: []
  compile: []
}>()
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
      <button class="btn btn-soft" type="button" @click="emit('openWorkspace')">Open Folder</button>
      <button class="btn btn-soft" type="button" :disabled="!props.currentFilePath" @click="emit('saveFile')">Save</button>
      <button class="btn btn-accent" type="button" :disabled="!props.workspacePath || props.compiling" @click="emit('compile')">
        {{ props.compiling ? 'Compiling...' : 'Compile PDF' }}
      </button>
    </div>
  </header>
</template>
