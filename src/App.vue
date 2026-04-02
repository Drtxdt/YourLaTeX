<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import FileTreePanel from './components/FileTreePanel.vue'
import MonacoPane from './components/MonacoPane.vue'
import PdfPreviewPane from './components/PdfPreviewPane.vue'
import LogPanel from './components/LogPanel.vue'
import QuickMathPanel from './components/QuickMathPanel.vue'
import type { CompileOutputEvent, CompilerInfo, DirectoryEntry } from './types/ipc'

type MonacoPaneExpose = {
  insertLatexAtCursor: (snippet: string) => void
}

const workspacePath = ref('')
const entries = ref<DirectoryEntry[]>([])
const currentFilePath = ref('')
const activeTexFilePath = ref('')
const selectedPdfPath = ref('')
const editorContent = ref('')
const logs = ref<string[]>([])
const compiling = ref(false)
const availableCompilers = ref<CompilerInfo[]>([])
const selectedCompiler = ref('')
const pdfDataUrl = ref('')
const citationKeys = ref<string[]>([])
const workspaceLabelKeys = ref<string[]>([])
const texTargets = ref<string[]>([])
const imageTargets = ref<string[]>([])
const bibTargets = ref<string[]>([])
const knownPackages = ref<string[]>([])
const activePackages = ref<string[]>([])
const packageSymbolsMap = ref<Record<string, { commands: string[]; environments: string[] }>>({})
const monacoPaneRef = ref<MonacoPaneExpose | null>(null)
const isHydratingContent = ref(false)

let compileDebounceTimer: ReturnType<typeof setTimeout> | null = null
let packageRefreshTimer: ReturnType<typeof setTimeout> | null = null

const latexCandidates = computed(() =>
  entries.value.filter((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.tex'))
)

const canSaveCurrentFile = computed(() => currentFilePath.value.toLowerCase().endsWith('.tex'))
const activeDocumentLabelKeys = computed(() => extractLabelsFromTex(editorContent.value))
const allLabelKeys = computed(() => Array.from(new Set([...workspaceLabelKeys.value, ...activeDocumentLabelKeys.value])))

const pdfPath = computed(() => {
  if (selectedPdfPath.value) {
    return selectedPdfPath.value
  }

  if (!activeTexFilePath.value.toLowerCase().endsWith('.tex')) {
    return ''
  }

  return activeTexFilePath.value.replace(/\.tex$/i, '.pdf')
})

function appendLog(message: string) {
  logs.value.push(message)
}

function extractLabelsFromTex(content: string) {
  const labels = new Set<string>()
  const pattern = /\\label\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match[1]) {
      labels.add(match[1].trim())
    }
  }
  return Array.from(labels)
}

function extractBibKeys(content: string) {
  const keys = new Set<string>()
  const pattern = /^\s*@\w+\s*\{\s*([^,\s]+)\s*,/gm
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match[1]) {
      keys.add(match[1].trim())
    }
  }
  return Array.from(keys)
}

function extractUsedPackages(content: string) {
  const packages = new Set<string>()
  const patterns = [
    /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g,
    /\\RequirePackage(?:\[[^\]]*\])?\{([^}]+)\}/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const entries = (match[1] ?? '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)

      for (const pkg of entries) {
        packages.add(pkg)
      }
    }
  }

  return Array.from(packages)
}

async function loadPackageSymbolsFor(packages: string[]) {
  const unique = Array.from(new Set(packages))
  const nextMap: Record<string, { commands: string[]; environments: string[] }> = { ...packageSymbolsMap.value }

  await Promise.all(
    unique.map(async (pkg) => {
      if (nextMap[pkg]) {
        return
      }

      try {
        nextMap[pkg] = await window.electronAPI.getLatexPackageSymbols(pkg)
      } catch {
        nextMap[pkg] = { commands: [], environments: [] }
      }
    })
  )

  packageSymbolsMap.value = nextMap
}

function schedulePackageRefresh(content: string) {
  if (packageRefreshTimer) {
    clearTimeout(packageRefreshTimer)
  }

  packageRefreshTimer = setTimeout(async () => {
    const packages = extractUsedPackages(content)
    activePackages.value = packages
    await loadPackageSymbolsFor(packages)
  }, 260)
}

async function rebuildCompletionIndex() {
  if (!workspacePath.value) {
    citationKeys.value = []
    workspaceLabelKeys.value = []
    texTargets.value = []
    imageTargets.value = []
    bibTargets.value = []
    knownPackages.value = []
    return
  }

  const files = await listWorkspaceFilesRecursively(workspacePath.value)
  const bibFiles = files.filter((entry) => entry.path.toLowerCase().endsWith('.bib'))
  const texFiles = files.filter((entry) => entry.path.toLowerCase().endsWith('.tex'))
  const imageFiles = files.filter((entry) => /\.(png|jpg|jpeg|svg|pdf)$/i.test(entry.path))

  const toRelativePath = (absolutePath: string) =>
    absolutePath
      .slice(workspacePath.value.length)
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/')

  texTargets.value = texFiles
    .map((entry) => toRelativePath(entry.path))
    .map((relativePath) => relativePath.replace(/\.tex$/i, ''))

  imageTargets.value = imageFiles
    .map((entry) => toRelativePath(entry.path))
    .filter((relativePath) => relativePath.length > 0)

  bibTargets.value = bibFiles
    .map((entry) => toRelativePath(entry.path))
    .flatMap((relativePath) => [relativePath, relativePath.replace(/\.bib$/i, '')])
    .filter((relativePath) => relativePath.length > 0)

  const bibContents = await Promise.all(
    bibFiles.map((entry) => window.electronAPI.readFile(entry.path).catch(() => ''))
  )
  const texContents = await Promise.all(
    texFiles.map((entry) => window.electronAPI.readFile(entry.path).catch(() => ''))
  )

  citationKeys.value = Array.from(new Set(bibContents.flatMap((content) => extractBibKeys(content))))
  workspaceLabelKeys.value = Array.from(new Set(texContents.flatMap((content) => extractLabelsFromTex(content))))

  try {
    knownPackages.value = await window.electronAPI.getLatexPackageList()
  } catch {
    knownPackages.value = []
  }
}

async function listWorkspaceFilesRecursively(rootPath: string, depth = 0): Promise<DirectoryEntry[]> {
  if (depth > 6) {
    return []
  }

  const currentEntries = await window.electronAPI.listDirectory(rootPath)
  const files = currentEntries.filter((entry) => entry.type === 'file')
  const directories = currentEntries
    .filter((entry) => entry.type === 'directory')
    .filter((entry) => !['.git', 'node_modules', 'dist', 'release', '.vscode'].includes(entry.name))

  const nested = await Promise.all(
    directories.map((dir) => listWorkspaceFilesRecursively(dir.path, depth + 1))
  )

  return [...files, ...nested.flat()]
}

async function refreshDirectory() {
  if (!workspacePath.value) return
  entries.value = await window.electronAPI.listDirectory(workspacePath.value)
  await rebuildCompletionIndex()
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
  isHydratingContent.value = true
  currentFilePath.value = entry.path

  const lowerName = entry.name.toLowerCase()

  if (lowerName.endsWith('.pdf')) {
    selectedPdfPath.value = entry.path
    appendLog(`[preview] ${entry.path}\n`)
    await refreshPdfPreview()
    isHydratingContent.value = false
    return
  }

  selectedPdfPath.value = ''

  if (lowerName.endsWith('.tex')) {
    activeTexFilePath.value = entry.path
    editorContent.value = await window.electronAPI.readFile(entry.path)
    schedulePackageRefresh(editorContent.value)
    await refreshPdfPreview()
    isHydratingContent.value = false
    return
  }

  appendLog(`[info] ${entry.path} is not editable in Monaco.\n`)
  await refreshPdfPreview()
  isHydratingContent.value = false
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
  if (!canSaveCurrentFile.value) return
  await window.electronAPI.writeFile(currentFilePath.value, editorContent.value)
  appendLog(`[saved] ${currentFilePath.value}\n`)
  await rebuildCompletionIndex()
}

function scheduleDebouncedCompile() {
  if (!workspacePath.value || !canSaveCurrentFile.value) {
    return
  }

  if (compileDebounceTimer) {
    clearTimeout(compileDebounceTimer)
  }

  compileDebounceTimer = setTimeout(async () => {
    if (compiling.value) return
    await saveCurrentFile()
    await compileCurrentFile({ skipSave: true })
  }, 1200)
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

  const targetTex = activeTexFilePath.value || latexCandidates.value[0]?.path
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

function insertMathSymbol(latex: string) {
  monacoPaneRef.value?.insertLatexAtCursor(latex)
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
  if (compileDebounceTimer) {
    clearTimeout(compileDebounceTimer)
  }
  if (packageRefreshTimer) {
    clearTimeout(packageRefreshTimer)
  }
  disposeOutputListener?.()
})

watch(editorContent, () => {
  if (isHydratingContent.value) return
  scheduleDebouncedCompile()
  schedulePackageRefresh(editorContent.value)
})
</script>

<template>
  <div class="app-shell">
    <AppToolbar
      :workspace-path="workspacePath"
      :current-file-path="currentFilePath"
      :compiling="compiling"
      :can-save="canSaveCurrentFile"
      :selected-compiler="selectedCompiler"
      :available-compilers="availableCompilers"
      @open-workspace="openWorkspace"
      @save-file="saveCurrentFile"
      @compile="compileCurrentFile"
      @change-compiler="changeCompiler"
    />
    <main class="workspace-grid">
      <FileTreePanel :entries="entries" :selected-file-path="currentFilePath" @select-file="selectFile" />
      <div class="editor-stack">
        <QuickMathPanel @insert="insertMathSymbol" />
        <MonacoPane
          ref="monacoPaneRef"
          v-model="editorContent"
          :citation-keys="citationKeys"
          :label-keys="allLabelKeys"
          :tex-targets="texTargets"
          :image-targets="imageTargets"
          :bib-targets="bibTargets"
          :known-packages="knownPackages"
          :active-packages="activePackages"
          :package-symbols="packageSymbolsMap"
        />
      </div>
      <PdfPreviewPane :pdf-data-url="pdfDataUrl" />
    </main>
    <LogPanel :logs="logs" />
  </div>
</template>
