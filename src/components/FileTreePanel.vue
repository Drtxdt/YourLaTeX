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

function getFileIcon(entry: DirectoryEntry) {
  if (entry.type === 'directory') return 'DIR'

  const lower = entry.name.toLowerCase()
  if (lower.endsWith('.tex')) return 'TEX'
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.bib')) return 'BIB'
  if (lower.endsWith('.md')) return 'DOC'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg')) return 'IMG'

  return 'FILE'
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
        <span class="icon">{{ getFileIcon(entry) }}</span>
        <span class="name">{{ entry.name }}</span>
      </li>
    </ul>
  </aside>
</template>
