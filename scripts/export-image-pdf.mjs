import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { chromium } from 'playwright-core'

const root = process.cwd()
const outputArg = process.argv.find((arg) => arg.startsWith('--out='))
const scaleArg = process.argv.find((arg) => arg.startsWith('--scale='))
const debugPngArg = process.argv.find((arg) => arg.startsWith('--debug-png='))
const baseUrlArg = process.argv.find((arg) => arg.startsWith('--base-url='))
const stateIdArg = process.argv.find((arg) => arg.startsWith('--state-id='))
const outputPath = path.resolve(root, outputArg?.slice('--out='.length) || 'exports/chess-homework-image.pdf')
const deviceScaleFactor = Math.max(1, Math.min(4, Number(scaleArg?.slice('--scale='.length) || 2)))
const debugPngDir = debugPngArg ? path.resolve(root, debugPngArg.slice('--debug-png='.length)) : null
const port = Number(process.env.PORT || 5173)
const baseUrl = baseUrlArg?.slice('--base-url='.length) || `http://127.0.0.1:${port}`
const stateId = stateIdArg?.slice('--state-id='.length)
const exportUrl = `${baseUrl}/?export=pdf${stateId ? `&stateId=${encodeURIComponent(stateId)}` : ''}`

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

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

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

if (debugPngDir) {
  await mkdir(debugPngDir, { recursive: true })
}

const browser = await launchChromium()

try {
  const page = await browser.newPage({
    deviceScaleFactor,
    viewport: { width: 1240, height: 1754 },
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[browser:${message.type()}] ${message.text()}`)
    }
  })

  await page.emulateMedia({ media: 'screen' })
  await page.goto(exportUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => window.__WORKSHEET_EXPORT_READY === true)
  await page.waitForFunction(() => document.querySelectorAll('svg.cm-chessboard').length > 0)
  await page.waitForTimeout(800)

  const pageHandles = await page.$$('.cover-page, .worksheet')

  if (pageHandles.length === 0) {
    throw new Error('No printable pages found. Expected .cover-page or .worksheet elements.')
  }

  const pdf = await PDFDocument.create()

  for (const [index, pageHandle] of pageHandles.entries()) {
    await pageHandle.evaluate((element) => element.scrollIntoView({ block: 'start', inline: 'start' }))

    const png = await pageHandle.screenshot({
      animations: 'disabled',
      omitBackground: false,
      type: 'png',
    })

    if (debugPngDir) {
      await writeFile(path.join(debugPngDir, `page-${String(index + 1).padStart(3, '0')}.png`), png)
    }

    const embeddedPage = await pdf.embedPng(png)
    const pdfPage = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    const imageHeight = A4_WIDTH_PT * (embeddedPage.height / embeddedPage.width)
    const imageY = A4_HEIGHT_PT - imageHeight

    pdfPage.drawImage(embeddedPage, {
      height: imageHeight,
      width: A4_WIDTH_PT,
      x: 0,
      y: imageY,
    })
  }

  const bytes = await pdf.save()
  await writeFile(outputPath, bytes)

  console.log(`Image PDF written to ${outputPath}`)
  console.log(`Rendered ${pageHandles.length} page(s) at ${deviceScaleFactor}x screenshot scale`)
} finally {
  await browser.close()

  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
}
