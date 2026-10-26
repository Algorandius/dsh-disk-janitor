/**
 * HTTP surface the Settings page calls.
 *
 * Registered as one `prefix` route under `/dsh-disk-janitor`. The browser page
 * is same-origin, so no CORS or token plumbing is involved — the host route
 * table is reachable exactly like the page's own assets.
 *
 * @module @local/dsh-disk-janitor/http
 */
import { describe, formatBytes } from './janitor.js'

/** Cap on a request body; the largest thing posted here is a list of ids. */
const BODY_LIMIT = 64 * 1024

/**
 * Build the route handler.
 * @param {{
 *   prefix: string,
 *   janitor: { state: (options?: { force?: boolean }) => Promise<any>, clean: (request: any) => Promise<any> },
 *   readSettings: () => Promise<any>,
 *   writeSettings: (patch: any) => Promise<any>,
 *   log: { warn: (message: string) => void },
 * }} options Wiring.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} Handler.
 */
export function createHandler({ prefix, janitor, writeSettings, log }) {
  let busy = false
  let lastForcedScan = 0

  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) || '/' : url.pathname
    const method = String(req.method ?? 'GET').toUpperCase()

    try {
      // Loopback-only: a DNS-rebinding page reaches this port under its own
      // Host name, and these routes sit outside the web app's auth layer.
      if (!isLoopbackHost(req.headers.host)) {
        reply(res, 403, { ok: false, error: 'this route only answers loopback hosts' })
        return
      }

      if (route === '/state' && method === 'GET') {
        const force = url.searchParams.get('force') === '1' && Date.now() - lastForcedScan > 2_000
        if (force) lastForcedScan = Date.now()
        const state = await janitor.state({ force })
        reply(res, 200, state)
        return
      }

      if (route === '/clean' && method === 'POST') {
        if (busy) {
          reply(res, 409, { ok: false, error: 'another cleanup is already running' })
          return
        }
        const body = await readJson(req)
        busy = true
        try {
          const result = await janitor.clean({
            ids: Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string') : undefined,
            dryRun: body?.dryRun === true,
          })
          reply(res, 200, {
            ok: true,
            freedBytes: result.freedBytes,
            dryRun: result.dryRun,
            results: result.results,
            state: result.state,
          })
        } finally {
          busy = false
        }
        return
      }

      if (route === '/settings' && method === 'POST') {
        const body = await readJson(req)
        const settings = await writeSettings(body ?? {})
        reply(res, 200, { ok: true, settings })
        return
      }

      if (route === '/summary' && method === 'GET') {
        const state = await janitor.state({})
        const cleanable = state.categories
          .filter((entry) => entry.risk === 'safe')
          .reduce((sum, entry) => sum + entry.bytes, 0)
        reply(res, 200, {
          ok: true,
          home: state.home,
          totalBytes: state.overview.totalBytes,
          cleanableBytes: cleanable,
          text: `${state.overview.totalBytes > 0 ? formatBytes(state.overview.totalBytes) : '0 B'} total, ${formatBytes(cleanable)} cleanable`,
        })
        return
      }

      reply(res, 404, { ok: false, error: `unknown route ${method} ${route}` })
    } catch (error) {
      const message = describe(error)
      const status = Number.isInteger(error?.status) ? error.status : 500
      if (status >= 500) log.warn(`${method} ${route} failed: ${message}`)
      reply(res, status, { ok: false, error: message })
    }
  }
}

/**
 * Whether a `Host` header names the local machine.
 * @param {string | undefined} header Raw Host header.
 * @returns {boolean} True for loopback names and addresses.
 */
function isLoopbackHost(header) {
  if (typeof header !== 'string' || header.trim() === '') return false
  let host = header.trim().toLowerCase()
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    host = end === -1 ? host : host.slice(1, end)
  } else {
    host = host.replace(/:\d+$/u, '')
  }
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1'
}

/**
 * Read and parse a JSON body, bounded.
 *
 * The content-type requirement is the CSRF barrier for this localhost route:
 * a cross-origin page cannot post `application/json` without a preflight, and
 * this route registers no CORS headers, so the browser stops it before the
 * handler runs. A `text/plain` simple request never reaches the deletion code.
 * @param {import('node:http').IncomingMessage} req Request.
 * @returns {Promise<any>} Parsed body (undefined when empty).
 */
function readJson(req) {
  const site = String(req.headers['sec-fetch-site'] ?? '')
  if (site === 'cross-site') {
    throw Object.assign(new Error('cross-site request refused'), { status: 403 })
  }
  const type = String(req.headers['content-type'] ?? '').toLowerCase()
  if (!type.startsWith('application/json')) {
    throw Object.assign(new Error('expected application/json'), { status: 415 })
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error('request body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(Object.assign(new Error(`invalid JSON body: ${describe(error)}`), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Send one JSON response.
 * @param {import('node:http').ServerResponse} res Response.
 * @param {number} status Status code.
 * @param {unknown} body Serializable body.
 */
function reply(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  res.end(text)
}
