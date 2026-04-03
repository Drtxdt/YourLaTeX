import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const ROOT_DIR = process.cwd()
const OUTPUT_DIR = path.join(ROOT_DIR, 'packages')
const CONCURRENCY = Number.parseInt(process.env.EXTRACT_CONCURRENCY ?? '6', 10)

const TLMGR_BIN =
  process.env.TLMGR_BIN ||
  'D:\\texlive\\texlive\\2025\\bin\\windows\\tlmgr.bat'

const KPSEWHICH_BIN =
  process.env.KPSEWHICH_BIN ||
  'D:\\texlive\\texlive\\2025\\bin\\windows\\kpsewhich.exe'

/* ------------------ 工具函数 ------------------ */

async function runCommand(command, args, timeout = 15000) {
  try {
    const isBat = command.endsWith('.bat') || command.endsWith('.cmd')

    const finalCommand = isBat ? 'cmd.exe' : command
    const finalArgs = isBat ? ['/c', command, ...args] : args

    const { stdout } = await execFileAsync(finalCommand, finalArgs, {
      windowsHide: true,
      timeout,
      maxBuffer: 20 * 1024 * 1024,
    })

    return String(stdout ?? '')
  } catch (error) {
    console.error('Command failed:', command, args)
    console.error(error?.message || error)
    return null
  }
}

function parseInstalledPackages(output) {
  const set = new Set()
  const lines = output.split(/\r?\n/)

  for (const line of lines) {
    const t = line.trim()
    if (!t.startsWith('i ')) continue

    const m1 = t.match(/^i\s+([^:\s]+)\s*:/)
    const m2 = t.match(/^i\s+([^\s]+)\s+-/)

    if (m1?.[1]) set.add(m1[1])
    else if (m2?.[1]) set.add(m2[1])
  }

  return [...set].sort()
}

function normalizeCommand(name) {
  return name.startsWith('\\') ? name : `\\${name}`
}

function isValidCommand(name) {
  return !name.includes('@')
}

/* ------------------ 核心解析 ------------------ */

function extractFromContent(content) {
  const commands = new Set()
  const environments = new Set()

  const commandPatterns = [
    /\\newcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\renewcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\providecommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\DeclareMathOperator\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\DeclareRobustCommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\DeclarePairedDelimiter\*?\s*\{\\([A-Za-z@]+)\}/g,

    /\\def\s*\\([A-Za-z@]+)/g,
    /\\let\s*\\([A-Za-z@]+)\s*=/g,
  ]

  for (const pattern of commandPatterns) {
    let m
    while ((m = pattern.exec(content)) !== null) {
      const name = m[1]?.trim()
      if (name && isValidCommand(name)) {
        commands.add(normalizeCommand(name))
      }
    }
  }

  const envPatterns = [
    /\\newenvironment\*?\s*\{([A-Za-z@*:-]+)\}/g,
    /\\RenewDocumentEnvironment\s*\{([A-Za-z@*:-]+)\}/g,
    /\\NewDocumentEnvironment\s*\{([A-Za-z@*:-]+)\}/g,
  ]

  for (const pattern of envPatterns) {
    let m
    while ((m = pattern.exec(content)) !== null) {
      const name = m[1]?.trim()
      if (name && !name.includes('@')) {
        environments.add(name)
      }
    }
  }

  return {
    commands: [...commands].sort(),
    environments: [...environments].sort(),
  }
}

/* ------------------ 找文件（增强版） ------------------ */

async function findPackageFile(packageName) {
  const exts = ['.sty', '.cls', '.tex']

  for (const ext of exts) {
    const result = await runCommand(KPSEWHICH_BIN, [`${packageName}${ext}`])
    if (result && result.trim()) {
      return result.trim()
    }
  }

  return null
}

/* ------------------ 主处理 ------------------ */

function sanitize(name) {
  return name.replace(/[^A-Za-z0-9._-]/g, '_')
}

async function processPackage(name, index, total) {
  console.log(`[${index + 1}/${total}] ${name}`)

  const filePath = await findPackageFile(name)

  if (!filePath) {
    console.log(`  - skip: file not found`)
    return { processed: false }
  }

  let content = ''
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch {
    console.log(`  - skip: read failed`)
    return { processed: false }
  }

  const extracted = extractFromContent(content)

  const outputPath = path.join(OUTPUT_DIR, `${sanitize(name)}.json`)
  await fs.writeFile(outputPath, JSON.stringify(extracted, null, 2))

  console.log(
    `  - ok: ${extracted.commands.length} cmd, ${extracted.environments.length} env`
  )

  return { processed: true }
}

/* ------------------ 并发控制 ------------------ */

async function runPool(list, concurrency) {
  let cursor = 0
  const results = []

  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= list.length) return
      const res = await processPackage(list[i], i, list.length)
      results.push(res)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, worker)
  )

  return results
}

/* ------------------ 入口 ------------------ */

async function main() {
  console.log('Running tlmgr...')

  const output = await runCommand(TLMGR_BIN, ['list', '--only-installed'], 30000)

  if (!output) {
    throw new Error('tlmgr failed')
  }

  const packages = parseInstalledPackages(output)

  console.log(`Found ${packages.length} packages`)

  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const results = await runPool(packages, CONCURRENCY)

  const ok = results.filter(r => r.processed).length

  console.log('Done.')
  console.log(`Success: ${ok}`)
  console.log(`Skip: ${results.length - ok}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})