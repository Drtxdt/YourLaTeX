/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    openDirectory: () => Promise<string | null>
    listDirectory: (dirPath: string) => Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>
    readFile: (filePath: string) => Promise<string>
    writeFile: (filePath: string, content: string) => Promise<boolean>
    runCommand: (payload: { command: string; args?: string[]; cwd: string }) => Promise<{ runId: string; code: number | null; signal: NodeJS.Signals | null }>
    onCommandOutput: (listener: (event: { runId: string; stream: 'stdout' | 'stderr' | 'close'; chunk: string; code?: number | null }) => void) => () => void
  }
}
