/**
 * Host half of the Disk Janitor bundle.
 *
 * Three pieces, none of which may take the Host down when a sibling fails:
 *   1. the janitor itself (scan / clean),
 *   2. one `prefix` HTTP route the Settings page calls,
 *   3. a `disk_janitor` tool so the same operation is reachable from chat,
 *      plus an optional auto-clean timer for scratch areas only.
 *
 * No `@deepseek-ai/*` import on purpose: only `node:` built-ins, so the module
 * always evaluates and an upgrade cannot break resolution at load time.
 *
 * @module @local/dsh-disk-janitor
 */
import { createJanitor, describe, formatBytes, resolveEnv } from './lib/janitor.js'
import { createHandler } from './lib/http.js'
import { readSettings, writeSettings } from './lib/settings.js'

/** Plugin name, used by Cordis diagnostics. */
export const name = 'disk-janitor'

/** No required services: every attachment is optional and acquired late. */
export const inject = []

/** Route prefix owned by this plugin. */
const ROUTE_PREFIX = '/dsh-disk-janitor'

/** Check interval for the optional auto-clean timer. */
const AUTO_TICK_MS = 5 * 60_000

/** Human labels used by tool results and logs. */
const CATEGORY_LABELS = {
  'bash-runtime': '终端运行时副本',
  'request-image-cache': '图片预览缓存',
  'projection-cache': '会话投影缓存',
  'acl-backups': '权限修复回滚记录',
  'temp-scratch': '临时工作目录',
  'desktop-cache': '界面缓存',
}

/**
 * Mount the plugin.
 * @param {any} ctx Cordis context.
 */
export function apply(ctx) {
  const env = resolveEnv()
  const warn = (message) => {
    try {
      ctx.logger?.warn?.(`[${name}] ${message}`)
    } catch {
      /* logging must never be the failure */
    }
  }
  const info = (message) => {
    try {
      ctx.logger?.info?.(`[${name}] ${message}`)
    } catch {
      /* same */
    }
  }

  const janitor = createJanitor({
    env,
    readSettings: () => readSettings(env),
  })

  // ── ① HTTP routes for the Settings page ────────────────────────────────
  ctx.inject(['webServer'], (child) => {
    child.effect(() => child.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: createHandler({
        prefix: ROUTE_PREFIX,
        janitor,
        writeSettings: (patch) => writeSettings(env, patch),
        log: { warn },
      }),
    }))
  })

  // ── ② Agent tool: same operation, conversational caller ────────────────
  ctx.inject(['tools'], (child) => {
    child.effect(() => {
      try {
        return child.tools.register(createTool(janitor, warn))
      } catch (error) {
        warn(`tool registration failed, the Settings page still works: ${describe(error)}`)
        return () => {}
      }
    })
  })

  // ── ③ Optional auto-clean of scratch areas ─────────────────────────────
  ctx.effect(() => {
    let stopped = false
    let lastRun = Date.now()
    const timer = setInterval(() => {
      if (stopped) return
      runAutoClean({
        env,
        janitor,
        getLastRun: () => lastRun,
        setLastRun: (value) => { lastRun = value },
        info,
      }).catch((error) => warn(`auto-clean failed: ${describe(error)}`))
    }, AUTO_TICK_MS)
    timer.unref?.()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  })
}

/**
 * One auto-clean evaluation: only when enabled and the interval has elapsed.
 * @param {{ env: any, janitor: any, getLastRun: () => number, setLastRun: (value: number) => void, info: (message: string) => void }} input Wiring.
 * @returns {Promise<void>} Resolves after the check.
 */
async function runAutoClean({ env, janitor, getLastRun, setLastRun, info }) {
  const settings = await readSettings(env)
  if (!settings.autoClean.enabled) {
    setLastRun(Date.now())
    return
  }
  const interval = settings.autoClean.intervalHours * 3_600_000
  if (Date.now() - getLastRun() < interval) return
  setLastRun(Date.now())
  const result = await janitor.clean({ ids: settings.autoClean.categories })
  if (result.freedBytes > 0) {
    info(`auto-cleaned ${formatBytes(result.freedBytes)} of scratch caches`)
  }
}

/**
 * Build the `disk_janitor` tool definition.
 * @param {any} janitor Janitor instance.
 * @param {(message: string) => void} warn Logger.
 * @returns {Record<string, any>} Tool definition.
 */
function createTool(janitor, warn) {
  return {
    name: 'disk_janitor',
    description: [
      'Inspect and clean the disk space DeepSeek Harness leaves behind on this machine.',
      'action="scan" only measures; action="clean" removes the selected cache categories.',
      'Every category is either regenerable or a safe-to-drop housekeeping record: the Windows Bash sandbox copy, image preview cache, session projection cache, stale dsh-* temp directories and Electron renderer caches, plus ACL repair receipts — rollback records rather than caches, but safe to delete.',
      'Prefer action="scan" first, then a clean limited to the categories the user agreed to.',
    ].join(' '),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['scan', 'clean'],
          description: 'scan = read sizes only; clean = delete the selected categories.',
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['bash-runtime', 'request-image-cache', 'projection-cache', 'acl-backups', 'temp-scratch', 'desktop-cache'],
          },
          description: 'Category ids to clean. Omit for every safe category. Ignored by scan.',
        },
        dryRun: {
          type: 'boolean',
          description: 'With action="clean": report what would be freed without deleting anything.',
        },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: { type: 'string', description: 'Human-readable report of the scan or cleanup.' },
          totalBytes: { type: 'integer', description: 'Current data-directory size (scan) or size after cleanup (clean).' },
          freedBytes: { type: 'integer', description: 'Bytes removed by this call (0 for scan and dry runs).' },
        },
      },
      render(args, value) {
        try {
          return [{ type: 'text', text: String(value?.summary ?? '') }]
        } catch (error) {
          warn(`tool render failed: ${describe(error)}`)
          return [{ type: 'text', text: 'disk_janitor finished; see the tool result for details.' }]
        }
      },
    },
    async execute(args) {
      const action = args?.action === 'clean' ? 'clean' : 'scan'
      if (action === 'scan') {
        const state = await janitor.state({ force: true })
        return {
          summary: describeScan(state),
          totalBytes: state.overview.totalBytes,
          freedBytes: 0,
        }
      }
      const ids = Array.isArray(args?.categories) && args.categories.length > 0 ? args.categories : undefined
      const result = await janitor.clean({
        ids,
        dryRun: args?.dryRun === true,
      })
      return {
        summary: describeClean(result),
        totalBytes: result.state?.overview?.totalBytes ?? 0,
        freedBytes: result.dryRun ? 0 : result.freedBytes,
      }
    },
    isConcurrencySafe() {
      return false
    },
    timeoutMs: 120_000,
  }
}

/**
 * Render a scan into tool-result text.
 * @param {any} state Scan state.
 * @returns {string} Text.
 */
function describeScan(state) {
  const lines = [`DSH 数据目录 ${state.home} 当前占用 ${formatBytes(state.overview.totalBytes)}。`]
  const rows = state.categories.filter((entry) => entry.bytes > 0)
  if (rows.length === 0) {
    lines.push('没有发现可清理的缓存。')
  } else {
    lines.push('按类别（扫描不删除任何文件）：')
    for (const entry of rows) {
      const label = CATEGORY_LABELS[entry.id] ?? entry.id
      lines.push(`- ${entry.id}（${label}，${entry.risk === 'safe' ? '安全' : '谨慎'}）：${formatBytes(entry.bytes)} / ${entry.files} 个文件`)
    }
    const cleanable = state.categories
      .filter((entry) => entry.risk === 'safe')
      .reduce((sum, entry) => sum + entry.bytes, 0)
    lines.push(`其中安全项合计 ${formatBytes(cleanable)}。清理安全项请再调用一次 action="clean"（可带 categories 限定范围）。`)
  }
  if (state.truncated) lines.push('注意：本次扫描超出时间预算，数字是下限。')
  return lines.join('\n')
}

/**
 * Render a cleanup into tool-result text.
 * @param {any} result Clean result.
 * @returns {string} Text.
 */
function describeClean(result) {
  const head = result.dryRun
    ? `预演完成：勾选内容可释放 ${formatBytes(result.freedBytes)}，未删除任何文件。`
    : `已释放 ${formatBytes(result.freedBytes)}。`
  const lines = [head]
  for (const entry of result.results) {
    const label = CATEGORY_LABELS[entry.id] ?? entry.id
    if (entry.status === 'unknown') {
      lines.push(`- ${entry.id}：未知类别，已跳过`)
      continue
    }
    lines.push(`- ${entry.id}（${label}）：${formatBytes(entry.bytes)}，移除 ${entry.removed} 项`)
    if (Array.isArray(entry.errors) && entry.errors.length > 0) {
      lines.push(`  其中 ${entry.errors.length} 项无法删除（可能正在使用）：${entry.errors[0].path}`)
    }
  }
  const total = result.state?.overview?.totalBytes
  if (Number.isFinite(total)) lines.push(`数据目录现在占用 ${formatBytes(total)}。`)
  return lines.join('\n')
}
