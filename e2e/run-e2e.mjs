import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = spawn(process.execPath, ['e2e/start-frontend.mjs'], {
  cwd: root,
  stdio: 'inherit',
})

function terminate(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173')
      if (response.ok) return
    } catch {
      // The Vite server may still be starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  throw new Error('Frontend E2E server did not become ready within 60 seconds.')
}

async function stop(exitCode) {
  terminate(server)
  process.exit(exitCode)
}

process.once('SIGINT', () => void stop(130))
process.once('SIGTERM', () => void stop(143))

try {
  await waitForServer()
  const playwrightCli = resolve(root, 'node_modules/@playwright/test/cli.js')
  const runner = spawn(process.execPath, [playwrightCli, 'test'], {
    cwd: root,
    env: { ...process.env, CAMPUS_PULSE_E2E_EXTERNAL_SERVER: '1' },
    stdio: 'inherit',
  })
  const exitCode = await new Promise((resolveExit) => {
    runner.once('exit', (code) => resolveExit(code ?? 1))
    runner.once('error', () => resolveExit(1))
  })
  await stop(exitCode)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  await stop(1)
}
