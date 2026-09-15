import { createServer } from 'vite'

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

await server.listen()

let stopping = false
async function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  await server.close()
  process.exit(exitCode)
}

process.once('SIGINT', () => void stop(0))
process.once('SIGTERM', () => void stop(0))
process.once('SIGHUP', () => void stop(0))

await new Promise(() => {})
