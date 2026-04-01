export type EntryType = 'file' | 'directory'

export interface DirectoryEntry {
  name: string
  path: string
  type: EntryType
}

export interface CommandRunPayload {
  command: string
  args?: string[]
  cwd: string
}

export interface CommandResult {
  runId: string
  code: number | null
  signal: string | null
}

export interface CommandOutputEvent {
  runId: string
  stream: 'stdout' | 'stderr' | 'close'
  chunk: string
  code?: number | null
}
