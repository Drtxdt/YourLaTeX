import { ipcRenderer, contextBridge } from 'electron'

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

interface CompileResult {
  runId: string
  code: number | null
  signal: NodeJS.Signals | null
}

interface CompilerInfo {
  id: string
  label: string
  available: boolean
}

interface CompileOutputEvent {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
  compilerId: string
}

const api = {
  openDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIRECTORY) as Promise<string | null>,
  listDirectory: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.LIST_DIRECTORY, dirPath) as Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>,
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath) as Promise<string>,
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, { filePath, content }) as Promise<boolean>,
  getLatexPackageList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.LATEX_PACKAGE_LIST) as Promise<string[]>,
  getLatexPackageSymbols: (packageName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LATEX_PACKAGE_SYMBOLS, packageName) as Promise<{ commands: string[]; environments: string[] }>,
  readPdfDataUrl: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_PDF_DATA_URL, filePath) as Promise<string | null>,
  detectCompilers: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DETECT_COMPILERS) as Promise<{
      compilers: CompilerInfo[]
      defaultCompiler: string | null
    }>,
  runCompile: (payload: { compilerId: string; texFilePath: string; cwd: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.RUN_COMPILE, payload) as Promise<CompileResult>,
  onCompileOutput: (listener: (event: CompileOutputEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: CompileOutputEvent) => listener(payload)
    ipcRenderer.on(IPC_CHANNELS.COMPILE_OUTPUT, wrapped)
    return () => ipcRenderer.off(IPC_CHANNELS.COMPILE_OUTPUT, wrapped)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
