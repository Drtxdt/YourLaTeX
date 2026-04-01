<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import FileTreePanel from './components/FileTreePanel.vue'
import MonacoPane from './components/MonacoPane.vue'
import PdfPreviewPane from './components/PdfPreviewPane.vue'
import LogPanel from './components/LogPanel.vue'
import type { CommandOutputEvent, DirectoryEntry } from './types/ipc'

const workspacePath = ref('')
const entries = ref<DirectoryEntry[]>([])
const currentFilePath = ref('')
const editorContent = ref('')
const logs = ref<string[]>([])
const compiling = ref(false)

const latexCandidates = computed(() =>
  entries.value.filter((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.tex'))
)

const pdfPath = computed(() => {
  if (!currentFilePath.value.toLowerCase().endsWith('.tex')) {
    return ''
  }
  return currentFilePath.value.replace(/\.tex$/i, '.pdf')
})

function appendLog(message: string) {
  logs.value.push(message)
}

async function refreshDirectory() {
  if (!workspacePath.value) return
  entries.value = await window.electronAPI.listDirectory(workspacePath.value)
}

async function openWorkspace() {
  const dirPath = await window.electronAPI.openDirectory()
  if (!dirPath) return

  workspacePath.value = dirPath
  await refreshDirectory()

  const firstLatex = latexCandidates.value[0]
  if (firstLatex) {
    await selectFile(firstLatex)
  }
}

async function selectFile(entry: DirectoryEntry) {
  if (entry.type !== 'file') return
  currentFilePath.value = entry.path
  editorContent.value = await window.electronAPI.readFile(entry.path)
}

async function saveCurrentFile() {
  if (!currentFilePath.value) return
  await window.electronAPI.writeFile(currentFilePath.value, editorContent.value)
  appendLog(`[saved] ${currentFilePath.value}\n`)
}

async function compileCurrentFile() {
  if (!workspacePath.value) {
    appendLog('[error] Please open a workspace first.\n')
    return
  }

  const targetTex = currentFilePath.value || latexCandidates.value[0]?.path
  if (!targetTex) {
    appendLog('[error] No .tex file found in workspace root.\n')
    return
  }

  await saveCurrentFile()

  compiling.value = true
  appendLog(`\n[compile] pdflatex ${targetTex}\n`)

  try {
    await window.electronAPI.runCommand({
      command: 'pdflatex',
      args: ['-interaction=nonstopmode', '-halt-on-error', targetTex],
      cwd: workspacePath.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendLog(`[error] ${message}\n`)
    compiling.value = false
  }
}

let disposeOutputListener: (() => void) | null = null

onMounted(() => {
  disposeOutputListener = window.electronAPI.onCommandOutput((event: CommandOutputEvent) => {
    if (event.stream === 'close') {
      appendLog(`[exit] code=${event.code ?? 'unknown'}\n`)
      compiling.value = false
      return
    }
    appendLog(event.chunk)
  })
})

onUnmounted(() => {
  disposeOutputListener?.()
})
</script>

<template>
  <div class="app-shell">
    <AppToolbar
      :workspace-path="workspacePath"
      :current-file-path="currentFilePath"
      :compiling="compiling"
      @open-workspace="openWorkspace"
      @save-file="saveCurrentFile"
      @compile="compileCurrentFile"
    />
    <main class="workspace-grid">
      <FileTreePanel :entries="entries" :selected-file-path="currentFilePath" @select-file="selectFile" />
      <MonacoPane v-model="editorContent" />
      <PdfPreviewPane :pdf-path="pdfPath" />
    </main>
    <LogPanel :logs="logs" />
  </div>
</template>
