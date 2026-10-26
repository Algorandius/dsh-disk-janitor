/**
 * Disk Janitor core: category discovery, measurement, deletion.
 *
 * Node built-ins only. The Host half of this bundle deliberately imports no
 * `@deepseek-ai/*` package: a plugin that throws at module evaluation takes
 * its whole fiber down, and this one must keep working across DSH upgrades.
 *
 * @module @local/dsh-disk-janitor/janitor
 */
import { promises as fsp } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

/** Risk label the page renders. */
export const SAFE = 'safe'

const HOUR = 3_600_000

/** A cached scan older than this is recomputed on demand. */
export const SCAN_TTL_MS = 30_000
/** Hard cap for one full scan; a slow disk yields partial numbers, never a hang. */
export const SCAN_BUDGET_MS = 25_000

/** Electron cache folders that only ever hold renderer artifacts. */
const DESKTOP_CACHES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'GPUPersistentCache',
  'GrShaderCache',
  'ShaderCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
]

/**
 * Resolve the directories this plugin works on.
 * @returns {{ home: string, tmp: string, desktopData: string, appData: string }} Absolute paths.
 */
export function resolveEnv() {
  const home = (process.env.DSH_HOME || '').trim() || path.join(homedir(), '.dsh')
  const appData = (process.env.APPDATA || '').trim() || path.join(homedir(), 'AppData', 'Roaming')
  return {
    home,
    tmp: process.env.DSH_JANITOR_TMP?.trim() || tmpdir(),
    appData,
    desktopData: path.join(appData, '@deepseek-ai', 'dsh-desktop'),
  }
}

/**
 * Build the category plan for one scan.
 * @param {ReturnType<typeof resolveEnv>} env Resolved directories.
 * @param {{ oldSessionDays?: number }} settings Current settings.
 * @returns {Array<Record<string, any>>} Category definitions with concrete roots.
 */
export function categoryPlan(env) {
  return [
    {
      id: 'bash-runtime',
      risk: SAFE,
      kind: 'children',
      root: path.join(env.home, 'dsh-ops', 'bash-ipc'),
    },
    {
      id: 'request-image-cache',
      risk: SAFE,
      kind: 'tree',
      root: path.join(env.home, 'cache', 'attachments'),
    },
    {
      id: 'projection-cache',
      risk: SAFE,
      kind: 'tree',
      root: path.join(env.home, 'storages', 'session_projcache'),
    },
    {
      id: 'acl-backups',
      risk: SAFE,
      kind: 'tree',
      root: path.join(env.home, 'dsh-ops', 'acl-backups'),
    },
    {
      id: 'temp-scratch',
      risk: SAFE,
      kind: 'temp',
      root: env.tmp,
      minAgeMs: 6 * HOUR,
    },
    {
      id: 'desktop-cache',
      risk: SAFE,
      kind: 'paths',
      roots: DESKTOP_CACHES.map((name) => path.join(env.desktopData, name)),
    },
  ]
}

/**
 * Create the cached janitor used by both the HTTP routes and the agent tool.
 * @param {{
 *   env: ReturnType<typeof resolveEnv>,
 *   readSettings: () => Promise<{ oldSessionDays?: number }>,
 * }} options Wiring.
 * @returns {{ state: (options?: { force?: boolean }) => Promise<any>, clean: (request: any) => Promise<any> }} The janitor.
 */
export function createJanitor({ env, readSettings }) {
  /** @type {{ at: number, value: any }} */
  let cache = { at: 0, value: null }

  const state = async ({ force = false } = {}) => {
    if (!force && cache.value && Date.now() - cache.at < SCAN_TTL_MS) return cache.value
    const settings = await readSettings()
    const value = await buildState({ env, settings })
    cache = { at: Date.now(), value }
    return value
  }

  const clean = async ({ ids, dryRun = false } = {}) => {
    const settings = await readSettings()
    const plan = categoryPlan(env)
    // An explicit list is honored as given (an empty list cleans nothing);
    // omitting it means "every safe category".
    const requested = Array.isArray(ids)
      ? ids.filter((id) => typeof id === 'string')
      : plan.filter((entry) => entry.risk === SAFE).map((entry) => entry.id)
    const results = []
    for (const id of requested) {
      const def = plan.find((entry) => entry.id === id)
      if (def === undefined) {
        results.push({ id: String(id), status: 'unknown', bytes: 0, files: 0, removed: 0, errors: [] })
        continue
      }
      const entries = await collectEntries(def, { now: Date.now() })
      let bytes = 0
      let files = 0
      let removed = 0
      const errors = []
      for (const entry of entries) {
        if (dryRun) {
          bytes += entry.bytes
          files += entry.files
          removed += 1
          continue
        }
        try {
          await fsp.rm(entry.path, { recursive: true, force: true })
          bytes += entry.bytes
          files += entry.files
          removed += 1
        } catch (error) {
          errors.push({ path: entry.path, message: describe(error) })
        }
      }
      results.push({ id: def.id, status: 'ok', bytes, files, removed, errors, ageDays: def.ageDays })
    }
    const freedBytes = results.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0)
    if (!dryRun) {
      cache = { at: 0, value: null }
    }
    const next = dryRun ? await state({ force: false }) : await state({ force: true })
    return { freedBytes, dryRun, results, state: next }
  }

  return { state, clean }
}

/**
 * Measure every category and the whole data directory.
 * @param {{ env: any, settings: any }} input Scan input.
 * @returns {Promise<any>} The client-facing state.
 */
async function buildState({ env, settings }) {
  const startedAt = Date.now()
  const deadline = startedAt + SCAN_BUDGET_MS
  const plan = categoryPlan(env)
  const categories = []
  for (const def of plan) {
    const entries = await collectEntries(def, { now: Date.now(), deadline })
    const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0)
    const files = entries.reduce((sum, entry) => sum + entry.files, 0)
    categories.push({
      id: def.id,
      risk: def.risk,
      bytes,
      files,
      count: entries.length,
      ok: true,
    })
  }
  const overview = await overviewOf(env.home, deadline)
  return {
    home: env.home,
    categories,
    overview,
    settings,
    scannedAt: Date.now(),
    tookMs: Date.now() - startedAt,
    truncated: Date.now() > deadline,
  }
}

/**
 * List one category's removable entries, measured.
 * @param {Record<string, any>} def Category definition.
 * @param {{ now: number, deadline?: number }} context Scan context.
 * @returns {Promise<Array<{ path: string, bytes: number, files: number }>>} Entries.
 */
async function collectEntries(def, context) {
  const deadline = context.deadline ?? Date.now() + SCAN_BUDGET_MS
  const out = []
  const push = async (target) => {
    const measured = await measure(target, deadline)
    if (measured === null) return
    out.push({ path: target, bytes: measured.bytes, files: measured.files })
  }

  if (def.kind === 'tree') {
    if (await statSafe(def.root)) await push(def.root)
    return out
  }
  if (def.kind === 'paths') {
    for (const root of def.roots ?? []) {
      if (await statSafe(root)) await push(root)
    }
    return out
  }
  if (def.kind === 'children') {
    for (const child of await listDir(def.root)) {
      await push(path.join(def.root, child.name))
    }
    return out
  }
  if (def.kind === 'temp') {
    for (const child of await listDir(def.root)) {
      if (!/^dsh[-.]/iu.test(child.name)) continue
      const target = path.join(def.root, child.name)
      const stat = await statSafe(target)
      if (stat === null) continue
      if (context.now - stat.mtimeMs < def.minAgeMs) continue
      await push(target)
    }
    return out
  }
  return out
}

/**
 * Recursively total one file or directory. Symbolic links are not followed.
 * @param {string} target Absolute path.
 * @param {number} deadline Epoch ms after which the walk stops early.
 * @returns {Promise<{ bytes: number, files: number } | null>} Totals, or null when absent.
 */
async function measure(target, deadline) {
  const root = await statSafe(target)
  if (root === null) return null
  if (root.isFile()) return { bytes: root.size, files: 1 }
  if (!root.isDirectory()) return { bytes: 0, files: 0 }
  let bytes = 0
  let files = 0
  const stack = [target]
  while (stack.length > 0) {
    if (Date.now() > deadline) break
    const dir = stack.pop()
    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const child = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(child)
        continue
      }
      if (!entry.isFile()) continue
      const stat = await statSafe(child)
      if (stat === null) continue
      bytes += stat.size
      files += 1
    }
  }
  return { bytes, files }
}

/**
 * Top-level composition of the data directory.
 * @param {string} home DSH home.
 * @param {number} deadline Epoch ms budget.
 * @returns {Promise<{ totalBytes: number, top: Array<{ name: string, bytes: number }> }>} Overview.
 */
async function overviewOf(home, deadline) {
  const rows = []
  for (const entry of await listDir(home)) {
    if (!entry.isDirectory() && !entry.isFile()) continue
    const measured = await measure(path.join(home, entry.name), deadline)
    if (measured === null) continue
    rows.push({ name: entry.name, bytes: measured.bytes })
  }
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0)
  rows.sort((left, right) => right.bytes - left.bytes)
  return { totalBytes, top: rows.slice(0, 5) }
}

/**
 * Read a directory, tolerating absence and permission errors.
 * @param {string} dir Absolute path.
 * @returns {Promise<import('node:fs').Dirent[]>} Entries (empty on failure).
 */
async function listDir(dir) {
  try {
    return await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/**
 * `stat`, tolerating absence.
 * @param {string} target Absolute path.
 * @returns {Promise<import('node:fs').Stats | null>} Stats or null.
 */
async function statSafe(target) {
  try {
    return await fsp.stat(target)
  } catch {
    return null
  }
}

/**
 * Clamp a possibly dirty number.
 * @param {unknown} value Candidate.
 * @param {number} fallback Used when not a finite number.
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 * @returns {number} A finite number inside the bounds.
 */
export function clampNumber(value, fallback, min, max) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

/**
 * One-line error text.
 * @param {unknown} error Thrown value.
 * @returns {string} Message.
 */
export function describe(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Human byte size.
 * @param {number} bytes Byte count.
 * @returns {string} Rendered size.
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
