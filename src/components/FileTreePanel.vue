<script setup lang="ts">
import type { DirectoryEntry } from '../types/ipc'

const props = defineProps<{
  entries: DirectoryEntry[]
  selectedFilePath: string
}>()

const emit = defineEmits<{
  selectFile: [entry: DirectoryEntry]
}>()

function handleClick(entry: DirectoryEntry) {
  if (entry.type === 'file') {
    emit('selectFile', entry)
  }
}
</script>

<template>
  <aside class="file-tree-panel">
    <div class="panel-title">Files</div>
    <ul class="file-tree-list">
      <li
        v-for="entry in props.entries"
        :key="entry.path"
        :class="['file-item', entry.type, { selected: entry.path === props.selectedFilePath }]"
        @click="handleClick(entry)"
      >
        <span class="icon">{{ entry.type === 'directory' ? 'DIR' : 'TEX' }}</span>
        <span class="name">{{ entry.name }}</span>
      </li>
    </ul>
  </aside>
</template>
