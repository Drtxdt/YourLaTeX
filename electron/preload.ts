import { ipcRenderer, contextBridge } from 'electron'

const IPC_CHANNELS = {
  OPEN_DIRECTORY: 'workspace:open-directory',
  LIST_DIRECTORY: 'workspace:list-directory',
  READ_FILE: 'file:read',
  WRITE_FILE: 'file:write',
  RUN_COMMAND: 'command:run',
  COMMAND_OUTPUT: 'command:output',
} as const

interface CommandResult {
  runId: string
  code: number | null
  signal: NodeJS.Signals | null
}

interface CommandOutputEvent {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
}

const api = {
  openDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIRECTORY) as Promise<string | null>,
  listDirectory: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.LIST_DIRECTORY, dirPath) as Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>,
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath) as Promise<string>,
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, { filePath, content }) as Promise<boolean>,
  runCommand: (payload: { command: string; args?: string[]; cwd: string }) => ipcRenderer.invoke(IPC_CHANNELS.RUN_COMMAND, payload) as Promise<CommandResult>,
  onCommandOutput: (listener: (event: CommandOutputEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: CommandOutputEvent) => listener(payload)
    ipcRenderer.on(IPC_CHANNELS.COMMAND_OUTPUT, wrapped)
    return () => ipcRenderer.off(IPC_CHANNELS.COMMAND_OUTPUT, wrapped)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
