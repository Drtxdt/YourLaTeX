import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

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
  RUN_COMMAND: 'command:run',
  COMMAND_OUTPUT: 'command:output',
} as const

type EntryType = 'file' | 'directory'

interface DirectoryEntry {
  name: string
  path: string
  type: EntryType
}

interface CommandPayload {
  command: string
  args?: string[]
  cwd: string
}

const COMMAND_ALLOWLIST = new Set(['pdflatex', 'xelatex', 'lualatex'])

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

function sendCommandOutput(payload: {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
}) {
  win?.webContents.send(IPC_CHANNELS.COMMAND_OUTPUT, payload)
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

  ipcMain.handle(IPC_CHANNELS.RUN_COMMAND, async (_event, payload: CommandPayload) => {
    const { command, args = [], cwd } = payload

    if (!COMMAND_ALLOWLIST.has(command)) {
      throw new Error(`Command not allowed: ${command}`)
    }

    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

    return await new Promise<{ runId: string; code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
      })

      child.stdout.on('data', (chunk) => {
        sendCommandOutput({
          runId,
          stream: 'stdout',
          chunk: String(chunk),
        })
      })

      child.stderr.on('data', (chunk) => {
        sendCommandOutput({
          runId,
          stream: 'stderr',
          chunk: String(chunk),
        })
      })

      child.on('error', (error) => {
        sendCommandOutput({
          runId,
          stream: 'stderr',
          chunk: error.message,
        })
        reject(error)
      })

      child.on('close', (code, signal) => {
        sendCommandOutput({
          runId,
          stream: 'close',
          chunk: '',
          code,
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
