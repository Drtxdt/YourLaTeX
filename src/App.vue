<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import FileTreePanel from './components/FileTreePanel.vue'
import MonacoPane from './components/MonacoPane.vue'
import PdfPreviewPane from './components/PdfPreviewPane.vue'
import LogPanel from './components/LogPanel.vue'
import type { CompileOutputEvent, CompilerInfo, DirectoryEntry } from './types/ipc'

const workspacePath = ref('')
const entries = ref<DirectoryEntry[]>([])
const currentFilePath = ref('')
const editorContent = ref('')
const logs = ref<string[]>([])
const compiling = ref(false)
const availableCompilers = ref<CompilerInfo[]>([])
const selectedCompiler = ref('')
const pdfDataUrl = ref('')

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
  await refreshPdfPreview()
}

async function refreshPdfPreview() {
  if (!pdfPath.value) {
    pdfDataUrl.value = ''
    return
  }

  const dataUrl = await window.electronAPI.readPdfDataUrl(pdfPath.value)
  pdfDataUrl.value = dataUrl ?? ''
}

async function saveCurrentFile() {
  if (!currentFilePath.value) return
  await window.electronAPI.writeFile(currentFilePath.value, editorContent.value)
  appendLog(`[saved] ${currentFilePath.value}\n`)

  if (currentFilePath.value.toLowerCase().endsWith('.tex')) {
    await compileCurrentFile({ skipSave: true })
  }
}

async function compileCurrentFile(options?: { skipSave?: boolean }) {
  if (!workspacePath.value) {
    appendLog('[error] Please open a workspace first.\n')
    return
  }

  if (!selectedCompiler.value) {
    appendLog('[error] No compiler available. Please install latexmk or pdflatex.\n')
    return
  }

  const targetTex = currentFilePath.value || latexCandidates.value[0]?.path
  if (!targetTex) {
    appendLog('[error] No .tex file found in workspace root.\n')
    return
  }

  if (!options?.skipSave) {
    await saveCurrentFile()
    return
  }

  compiling.value = true
  appendLog(`\n[compile] ${selectedCompiler.value} ${targetTex}\n`)

  try {
    await window.electronAPI.runCompile({
      compilerId: selectedCompiler.value,
      texFilePath: targetTex,
      cwd: workspacePath.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendLog(`[error] ${message}\n`)
    compiling.value = false
  }
}

function changeCompiler(compilerId: string) {
  selectedCompiler.value = compilerId
  appendLog(`[compiler] switched to ${compilerId}\n`)
}

let disposeOutputListener: (() => void) | null = null

onMounted(() => {
  window.electronAPI.detectCompilers().then((result) => {
    availableCompilers.value = result.compilers
    selectedCompiler.value = result.defaultCompiler || result.compilers[0]?.id || ''

    if (!selectedCompiler.value) {
      appendLog('[warn] No TeX compiler detected.\n')
    } else {
      appendLog(`[compiler] detected ${selectedCompiler.value}\n`)
    }
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    appendLog(`[error] ${message}\n`)
  })

  disposeOutputListener = window.electronAPI.onCompileOutput((event: CompileOutputEvent) => {
    if (event.stream === 'close') {
      appendLog(`[exit] code=${event.code ?? 'unknown'}\n`)
      if (event.code === 0) {
        refreshPdfPreview().catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          appendLog(`[error] ${message}\n`)
        })
      }
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
      :selected-compiler="selectedCompiler"
      :available-compilers="availableCompilers"
      @open-workspace="openWorkspace"
      @save-file="saveCurrentFile"
      @compile="compileCurrentFile"
      @change-compiler="changeCompiler"
    />
    <main class="workspace-grid">
      <FileTreePanel :entries="entries" :selected-file-path="currentFilePath" @select-file="selectFile" />
      <MonacoPane v-model="editorContent" />
      <PdfPreviewPane :pdf-data-url="pdfDataUrl" />
    </main>
    <LogPanel :logs="logs" />
  </div>
</template>
