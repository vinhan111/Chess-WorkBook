import { execFileSync, spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = process.cwd()
const outputArg = process.argv.find((arg) => arg.startsWith('--out='))
const outputPath = path.resolve(root, outputArg?.slice('--out='.length) || 'exports/chess-homework.pdf')
const port = Number(process.env.PORT || 5173)
const baseUrl = `http://127.0.0.1:${port}`
const exportUrl = `${baseUrl}/?export=pdf`

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/usr/bin/brave-browser',
]
const chromeCommands = [
  'google-chrome-stable',
  'google-chrome',
  'chromium-browser',
  'chromium',
  'microsoft-edge',
  'microsoft-edge-stable',
  'brave-browser',
]

function findChrome() {
  const chrome = chromeCandidates.find((candidate) => candidate && existsSync(candidate))

  if (chrome) {
    return chrome
  }

  for (const command of chromeCommands) {
    try {
      return execFileSync('which', [command], { encoding: 'utf8' }).trim()
    } catch {
      // Try next command.
    }
  }

  return null
}

async function launchChromium() {
  const executablePath = findChrome()

  try {
    return await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to launch Chrome/Chromium. Install Google Chrome/Chromium, run "npx playwright install chromium" and "npx playwright install-deps chromium", or set CHROME_PATH=/path/to/chrome.\n\n${detail}`,
    )
  }
}

async function isServerRunning() {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

function startVite() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))

  return child
}

async function waitForServer() {
  const deadline = Date.now() + 20_000

  while (Date.now() < deadline) {
    if (await isServerRunning()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting for ${baseUrl}`)
}

let serverProcess = null

if (!(await isServerRunning())) {
  serverProcess = startVite()
  await waitForServer()
}

await mkdir(path.dirname(outputPath), { recursive: true })

const browser = await launchChromium()

try {
  const page = await browser.newPage({
    viewport: { width: 1240, height: 1754 },
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[browser:${message.type()}] ${message.text()}`)
    }
  })

  await page.goto(exportUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.querySelectorAll('svg.cm-chessboard').length > 0)
  await page.waitForTimeout(800)

  await page.pdf({
    format: 'A4',
    margin: { bottom: '0mm', left: '0mm', right: '0mm', top: '0mm' },
    path: outputPath,
    preferCSSPageSize: true,
    printBackground: true,
    scale: 0.98,
  })

  console.log(`PDF written to ${outputPath}`)
} finally {
  await browser.close()

  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
}
