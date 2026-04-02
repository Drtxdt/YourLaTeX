import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const ROOT_DIR = process.cwd()
const OUTPUT_DIR = path.join(ROOT_DIR, 'packages')
const CONCURRENCY = Number.parseInt(process.env.EXTRACT_CONCURRENCY ?? '6', 10)
const TLMGR_BIN = process.env.TLMGR_BIN ||
  "D:\\texlive\\texlive\\2025\\bin\\windows\\tlmgr.bat"
const KPSEWHICH_BIN =  process.env.KPSEWHICH_BIN ||
  "D:\\texlive\\texlive\\2025\\bin\\windows\\kpsewhich.exe"

async function runCommand(command, args, timeout = 15000) {
  try {
    const isBat = command.endsWith('.bat') || command.endsWith('.cmd')

    const finalCommand = isBat ? 'cmd.exe' : command
    const finalArgs = isBat
      ? ['/c', command, ...args]
      : args

    const { stdout } = await execFileAsync(finalCommand, finalArgs, {
      windowsHide: true,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    })

    return String(stdout ?? '')
  } catch (error) {
    console.error('Command failed:', command, args)
    console.error(error?.message || error)
    return null
  }
}

function parseInstalledPackages(tlmgrOutput) {
  const packages = new Set()
  const lines = tlmgrOutput.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('i ')) {
      continue
    }

    const matchWithColon = trimmed.match(/^i\s+([^:\s]+)\s*:/)
    if (matchWithColon?.[1]) {
      packages.add(matchWithColon[1])
      continue
    }

    const matchWithDash = trimmed.match(/^i\s+([^\s]+)\s+-/)
    if (matchWithDash?.[1]) {
      packages.add(matchWithDash[1])
    }
  }

  return Array.from(packages).sort((a, b) => a.localeCompare(b))
}

function normalizeCommand(command) {
  return command.startsWith('\\') ? command : `\\${command}`
}

function extractFromSty(content) {
  const commandSet = new Set()
  const environmentSet = new Set()

  const commandPatterns = [
    /\\newcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\renewcommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\providecommand\*?\s*\{\\([A-Za-z@]+)\}/g,
    /\\DeclareMathOperator\*?\s*\{\\([A-Za-z@]+)\}/g,
  ]

  for (const pattern of commandPatterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        commandSet.add(normalizeCommand(match[1].trim()))
      }
    }
  }

  const environmentPattern = /\\newenvironment\*?\s*\{([A-Za-z@*:-]+)\}/g
  let envMatch
  while ((envMatch = environmentPattern.exec(content)) !== null) {
    if (envMatch[1]) {
      environmentSet.add(envMatch[1].trim())
    }
  }

  return {
    commands: Array.from(commandSet).sort((a, b) => a.localeCompare(b)),
    environments: Array.from(environmentSet).sort((a, b) => a.localeCompare(b)),
  }
}

function sanitizePackageName(name) {
  return name.replace(/[^A-Za-z0-9._-]/g, '_')
}

async function processPackage(packageName, index, total) {
  console.log(`[${index + 1}/${total}] Processing package: ${packageName}`)

  const styPathOutput = await runCommand(KPSEWHICH_BIN, [`${packageName}.sty`], 10000)
  const styPath = styPathOutput?.trim()

  if (!styPath) {
    console.log(`  - Skip ${packageName}: .sty not found via kpsewhich`)
    return { processed: false, packageName }
  }

  let styContent = ''
  try {
    styContent = await fs.readFile(styPath, 'utf-8')
  } catch {
    console.log(`  - Skip ${packageName}: failed to read ${styPath}`)
    return { processed: false, packageName }
  }

  const extracted = extractFromSty(styContent)
  const outputPath = path.join(OUTPUT_DIR, `${sanitizePackageName(packageName)}.json`)
  await fs.writeFile(outputPath, JSON.stringify(extracted, null, 2), 'utf-8')

  console.log(`  - Done ${packageName}: ${extracted.commands.length} commands, ${extracted.environments.length} environments`)
  return { processed: true, packageName }
}

async function runWithConcurrency(packageNames, concurrency) {
  const results = []
  let cursor = 0

  async function worker() {
    while (true) {
      const current = cursor
      cursor += 1

      if (current >= packageNames.length) {
        return
      }

      const packageName = packageNames[current]
      const result = await processPackage(packageName, current, packageNames.length)
      results.push(result)
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, packageNames.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

async function main() {
  console.log(`Running: ${TLMGR_BIN} list --only-installed`)
  const tlmgrOutput = await runCommand(TLMGR_BIN, ['list', '--only-installed'], 30000)

  if (!tlmgrOutput) {
    throw new Error(`Failed to execute ${TLMGR_BIN}. Please ensure TeX Live tools are installed and set TLMGR_BIN/KPSEWHICH_BIN if needed.`)
  }

  const packageNames = parseInstalledPackages(tlmgrOutput)
  if (packageNames.length === 0) {
    throw new Error('No installed package names parsed from tlmgr output.')
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  console.log(`Found ${packageNames.length} installed packages. Concurrency=${CONCURRENCY}`)
  const results = await runWithConcurrency(packageNames, CONCURRENCY)

  const successCount = results.filter((item) => item.processed).length
  const skippedCount = results.length - successCount

  console.log('Extraction complete.')
  console.log(`  - Processed: ${successCount}`)
  console.log(`  - Skipped: ${skippedCount}`)
  console.log(`  - Output directory: ${OUTPUT_DIR}`)
}

main().catch((error) => {
  console.error('[extract:latex-packages] Failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
