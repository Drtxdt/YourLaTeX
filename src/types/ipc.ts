export type EntryType = 'file' | 'directory'

export interface DirectoryEntry {
  name: string
  path: string
  type: EntryType
}

export interface CompilerInfo {
  id: string
  label: string
  available: boolean
}

export interface CompileRequest {
  compilerId: string
  texFilePath: string
  cwd: string
}

export interface CompileResult {
  runId: string
  code: number | null
  signal: string | null
}

export interface CompileOutputEvent {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
  compilerId: string
}

export interface PackageSymbols {
  commands: string[]
  environments: string[]
}
