import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import iconv from 'iconv-lite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const IPC_CHANNELS = {
  OPEN_DIRECTORY: 'workspace:open-directory',
  LIST_DIRECTORY: 'workspace:list-directory',
  READ_FILE: 'file:read',
  WRITE_FILE: 'file:write',
  LATEX_PACKAGE_LIST: 'latex:package-list',
  LATEX_PACKAGE_SYMBOLS: 'latex:package-symbols',
  READ_PDF_DATA_URL: 'pdf:read-data-url',
  DETECT_COMPILERS: 'compile:detect-compilers',
  RUN_COMPILE: 'compile:run',
  COMPILE_OUTPUT: 'compile:output',
} as const

type EntryType = 'file' | 'directory'

interface DirectoryEntry {
  name: string
  path: string
  type: EntryType
}

interface CompilerInfo {
  id: string
  label: string
  available: boolean
}

interface CompilePayload {
  compilerId: string
  texFilePath: string
  cwd: string
}

interface PackageSymbols {
  commands: string[]
  environments: string[]
}

const COMPILER_CANDIDATES = [
  { id: 'latexmk', label: 'latexmk', command: 'latexmk' },
  { id: 'pdflatex', label: 'pdflatex', command: 'pdflatex' },
] as const

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function sendCompileOutput(payload: {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
  compilerId: string
}) {
  win?.webContents.send(IPC_CHANNELS.COMPILE_OUTPUT, payload)
}

function runProbe(command: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, {
      shell: true,
      windowsHide: true,
      stdio: 'ignore',
    })

    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, 2500)

    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

async function detectAvailableCompilers() {
  const results = await Promise.all(
    COMPILER_CANDIDATES.map(async (compiler): Promise<CompilerInfo> => {
      const available = await runProbe(compiler.command, ['--version'])
      return {
        id: compiler.id,
        label: compiler.label,
        available,
      }
    })
  )

  return results
}

function getCompilerCommand(compilerId: string) {
  return COMPILER_CANDIDATES.find((compiler) => compiler.id === compilerId) ?? null
}

function decodeCompilerChunk(chunk: unknown) {
  if (Buffer.isBuffer(chunk)) {
    if (process.platform === 'win32') {
      return iconv.decode(chunk, 'gbk')
    }
    return chunk.toString('utf-8')
  }

  return String(chunk)
}

function buildCompilerArgs(compilerId: string, texFilePath: string) {
  if (compilerId === 'latexmk') {
    return ['-pdf', '-interaction=nonstopmode', '-halt-on-error', texFilePath]
  }
  return ['-interaction=nonstopmode', '-halt-on-error', texFilePath]
}

function sanitizePackageName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, '_')
}

function normalizeCommand(command: string) {
  return command.startsWith('\\') ? command : `\\${command}`
}

async function runCommandGetStdout(command: string, args: string[], timeout = 10000) {
  return await new Promise<string | null>((resolve) => {
    const child = spawn(command, args, {
      shell: true,
      windowsHide: true,
    })

    const chunks: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill()
      resolve(null)
    }, timeout)

    child.stdout.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    })

    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        resolve(null)
        return
      }

      const buffer = Buffer.concat(chunks)
      if (process.platform === 'win32') {
        resolve(iconv.decode(buffer, 'gbk'))
        return
      }
      resolve(buffer.toString('utf-8'))
    })
  })
}

function extractSymbolsFromSty(content: string): PackageSymbols {
  const commandSet = new Set<string>()
  const environmentSet = new Set<string>()

  const commandPatterns = [
    /\\newcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\renewcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\providecommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\DeclareMathOperator\*?\s*\{\\([A-Za-z@]+)\}/g,
  ]

  for (const pattern of commandPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        commandSet.add(normalizeCommand(match[1].trim()))
      }
    }
  }

  const envPattern = /\\newenvironment\*?\s*\{([A-Za-z@*:-]+)\}/g
  let envMatch: RegExpExecArray | null
  while ((envMatch = envPattern.exec(content)) !== null) {
    if (envMatch[1]) {
      environmentSet.add(envMatch[1].trim())
    }
  }

  return {
    commands: Array.from(commandSet).sort((a, b) => a.localeCompare(b)),
    environments: Array.from(environmentSet).sort((a, b) => a.localeCompare(b)),
  }
}

async function getPackageSymbols(packageName: string): Promise<PackageSymbols> {
  const safeName = sanitizePackageName(packageName)
  const localJsonPath = path.join(process.env.APP_ROOT, 'packages', `${safeName}.json`)

  try {
    const localContent = await fs.readFile(localJsonPath, 'utf-8')
    const parsed = JSON.parse(localContent) as PackageSymbols
    return {
      commands: Array.isArray(parsed.commands) ? parsed.commands : [],
      environments: Array.isArray(parsed.environments) ? parsed.environments : [],
    }
  } catch {
    // Fallback to local system parsing.
  }

  const styPathOutput = await runCommandGetStdout('kpsewhich', [`${packageName}.sty`], 8000)
  const styPath = styPathOutput?.trim()
  if (!styPath) {
    return { commands: [], environments: [] }
  }

  try {
    const styContent = await fs.readFile(styPath, 'utf-8')
    return extractSymbolsFromSty(styContent)
  } catch {
    return { commands: [], environments: [] }
  }
}

async function getKnownPackageList(): Promise<string[]> {
  const packagesDir = path.join(process.env.APP_ROOT, 'packages')

  try {
    const entries = await fs.readdir(packagesDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => path.basename(entry.name, '.json').toLowerCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.LIST_DIRECTORY, async (_event, dirPath: string): Promise<DirectoryEntry[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: (entry.isDirectory() ? 'directory' : 'file') as EntryType,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
  })

  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, payload: { filePath: string; content: string }) => {
    await fs.writeFile(payload.filePath, payload.content, 'utf-8')
    return true
  })

  ipcMain.handle(IPC_CHANNELS.LATEX_PACKAGE_LIST, async () => {
    return getKnownPackageList()
  })

  ipcMain.handle(IPC_CHANNELS.LATEX_PACKAGE_SYMBOLS, async (_event, packageName: string) => {
    return getPackageSymbols(packageName)
  })

  ipcMain.handle(IPC_CHANNELS.READ_PDF_DATA_URL, async (_event, filePath: string) => {
    try {
      const pdfBuffer = await fs.readFile(filePath)
      const base64 = pdfBuffer.toString('base64')
      return `data:application/pdf;base64,${base64}`
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.DETECT_COMPILERS, async () => {
    const compilers = await detectAvailableCompilers()
    const defaultCompiler = compilers.find((compiler) => compiler.available)?.id ?? null
    return {
      compilers,
      defaultCompiler,
    }
  })

  ipcMain.handle(IPC_CHANNELS.RUN_COMPILE, async (_event, payload: CompilePayload) => {
    const { compilerId, texFilePath, cwd } = payload

    const compiler = getCompilerCommand(compilerId)
    if (!compiler) {
      throw new Error(`Unknown compiler: ${compilerId}`)
    }

    const isAvailable = await runProbe(compiler.command, ['--version'])
    if (!isAvailable) {
      throw new Error(`Compiler not available: ${compiler.label}`)
    }

    const args = buildCompilerArgs(compilerId, texFilePath)

    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

    sendCompileOutput({
      runId,
      stream: 'stdout',
      chunk: `[compile:start] ${compiler.label} ${args.join(' ')}\n`,
      compilerId,
    })

    return await new Promise<{ runId: string; code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const child = spawn(compiler.command, args, {
        cwd,
        shell: true,
        windowsHide: true,
      })

      child.stdout.on('data', (chunk) => {
        sendCompileOutput({
          runId,
          stream: 'stdout',
          chunk: decodeCompilerChunk(chunk),
          compilerId,
        })
      })

      child.stderr.on('data', (chunk) => {
        sendCompileOutput({
          runId,
          stream: 'stderr',
          chunk: decodeCompilerChunk(chunk),
          compilerId,
        })
      })

      child.on('error', (error) => {
        sendCompileOutput({
          runId,
          stream: 'stderr',
          chunk: `${error.message}\n`,
          compilerId,
        })
        reject(error)
      })

      child.on('close', (code, signal) => {
        sendCompileOutput({
          runId,
          stream: 'close',
          chunk: '',
          code,
          compilerId,
        })
        resolve({ runId, code, signal })
      })
    })
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
