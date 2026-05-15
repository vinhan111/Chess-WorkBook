import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

const exportStates = new Map<string, unknown>()

function readRequestBody(request: import('node:http').IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function runImagePdfExport(root: string, baseUrl: string, stateId: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        'scripts/export-image-pdf.mjs',
        `--out=${outputPath}`,
        `--base-url=${baseUrl}`,
        `--state-id=${stateId}`,
      ],
      {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
    })

    child.stdout.on('data', (chunk: Buffer) => process.stdout.write(chunk))

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr || `Image PDF export failed with code ${code}`))
    })
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-image-pdf-export',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url) {
            next()
            return
          }

          const url = new URL(request.url, 'http://local.dev')

          if (request.method === 'GET' && url.pathname.startsWith('/api/export-state/')) {
            const stateId = decodeURIComponent(url.pathname.replace('/api/export-state/', ''))
            const state = exportStates.get(stateId)

            if (!state) {
              response.statusCode = 404
              response.end('Export state not found')
              return
            }

            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(state))
            return
          }

          if (request.method !== 'POST' || url.pathname !== '/api/export-image-pdf') {
            next()
            return
          }

          const stateId = randomUUID()
          const outputPath = path.join(server.config.root, 'exports', `image-export-${stateId}.pdf`)

          try {
            const body = await readRequestBody(request)
            exportStates.set(stateId, JSON.parse(body))
            await mkdir(path.dirname(outputPath), { recursive: true })

            const host = request.headers.host || `127.0.0.1:${server.config.server.port || 5173}`
            await runImagePdfExport(server.config.root, `http://${host}`, stateId, outputPath)

            const pdf = await readFile(outputPath)
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/pdf')
            response.setHeader('Content-Disposition', 'attachment; filename="chess-homework-image.pdf"')
            response.setHeader('Content-Length', String(pdf.length))
            response.end(pdf)
          } catch (error) {
            response.statusCode = 500
            response.setHeader('Content-Type', 'text/plain')
            response.end(error instanceof Error ? error.message : 'Image PDF export failed')
          } finally {
            exportStates.delete(stateId)
            void rm(outputPath, { force: true })
          }
        })
      },
    },
  ],
})
