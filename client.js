window.__ModuleLoader__.load({
  id: 'dsh-disk-janitor',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace. */
    const NS = 'disk-janitor'
    /** Host route prefix. */
    const BASE = '/dsh-disk-janitor'

    // Flat keys on purpose: the locale service treats `.` as a namespace
    // separator, so a key like `cat.bash-runtime.name` never hits the dict.
    const DICT = {
      zh: {
        nav: '磁盘清理',
        title: '磁盘清理',
        intro: '查看 DeepSeek Harness 在磁盘上的占用，并清理可以安全再生的缓存。',
        rescan: '重新扫描',
        scanning: '扫描中…',
        loading: '正在读取…',
        totalLabel: '数据目录总占用',
        totalNote: '含插件、运行时与会话数据',
        cleanable: '其中可清理 {size}',
        categories: '可清理项',
        selectedLabel: '已选 {size}',
        pickAll: '全选安全项',
        clean: '清理选中项',
        cleaning: '清理中…',
        cleanHint: '只删除勾选的缓存，不会触碰缓存以外的文件。',
        safe: '安全',
        caution: '谨慎',
        empty: '没有发现可清理的缓存。',
        confirmTitle: '确认删除旧会话？',
        confirmBody: '勾选项包含「旧会话日志」。删除后这些会话会从历史中永久消失，无法恢复。',
        confirmOk: '继续清理',
        cancel: '取消',
        done: '已释放 {size}',
        doneHint: '界面缓存重启 DSH 后才会完全释放。',
        dismiss: '知道了',
        skippedHint: '另有 {count} 项正被占用，未能删除。',
        failed: '操作失败',
        autoTitle: '自动清理临时缓存',
        autoDesc: '开启后，DSH 运行期间会按间隔自动删除超过 6 小时的临时目录和图片预览缓存。',
        autoOn: '已开启',
        autoOff: '已关闭',
        files: '个文件',
        unknown: '未知',
        catBashRuntimeName: '终端运行时副本',
        catBashRuntimeDesc: 'Windows 沙箱里的 Bash 运行时副本；删除后下一次终端调用会自动解压，首次略慢，不影响任何数据。',
        catRequestImageCacheName: '图片预览缓存',
        catRequestImageCacheDesc: '为模型请求生成的图片副本，可按需重建。',
        catProjectionCacheName: '会话投影缓存',
        catProjectionCacheDesc: '会话视图的派生缓存；清理后首次打开会话稍慢，随后恢复。',
        catAclBackupsName: '权限修复回滚记录',
        catAclBackupsDesc: '修复文件权限时留下的回滚记录——不是缓存，但删掉不影响使用。',
        catTempScratchName: '临时工作目录',
        catTempScratchDesc: '系统临时目录中的 dsh-* 目录，只清理 6 小时前未改动过的。',
        catDesktopCacheName: '界面缓存',
        catDesktopCacheDesc: '界面渲染与着色器缓存；重启 DSH 后会重新生成。',
      },
      en: {
        nav: 'Disk Cleanup',
        title: 'Disk cleanup',
        intro: 'See how much disk DeepSeek Harness uses, and clear caches that are safe to rebuild.',
        rescan: 'Rescan',
        scanning: 'Scanning…',
        loading: 'Loading…',
        totalLabel: 'Data directory',
        totalNote: 'plugins, runtimes and session data included',
        cleanable: '{size} cleanable',
        categories: 'Cleanable caches',
        selectedLabel: '{size} selected',
        pickAll: 'Select safe items',
        clean: 'Clean selected',
        cleaning: 'Cleaning…',
        cleanHint: 'Only the checked caches are deleted; nothing outside them is touched.',
        safe: 'Safe',
        caution: 'Caution',
        empty: 'No cleanable cache found.',
        confirmTitle: 'Delete old conversations?',
        confirmBody: 'The selection includes session logs. Those conversations disappear from history permanently.',
        confirmOk: 'Delete anyway',
        cancel: 'Cancel',
        done: 'Freed {size}',
        doneHint: 'Interface caches are fully released after a DSH restart.',
        dismiss: 'Dismiss',
        skippedHint: '{count} items were in use and could not be removed.',
        failed: 'Something went wrong',
        autoTitle: 'Auto-clean scratch caches',
        autoDesc: 'While DSH runs, periodically deletes dsh-* temp folders older than six hours and the image preview cache.',
        autoOn: 'On',
        autoOff: 'Off',
        files: 'files',
        unknown: 'Unknown',
        catBashRuntimeName: 'Bash runtime copy',
        catBashRuntimeDesc: "The Windows sandbox's extracted Bash runtime. Re-extracted on the next terminal call (a slow first call); no data is lost.",
        catRequestImageCacheName: 'Image preview cache',
        catRequestImageCacheDesc: 'Image copies generated for model requests; rebuilt on demand.',
        catProjectionCacheName: 'Session projection cache',
        catProjectionCacheDesc: 'Derived session-view cache; the first open of a conversation is slower afterwards.',
        catAclBackupsName: 'Permission repair receipts',
        catAclBackupsDesc: 'Rollback receipts from file-permission repairs — not caches, but safe to drop.',
        catTempScratchName: 'Scratch directories',
        catTempScratchDesc: 'dsh-* folders in the system temp directory, only those untouched for 6 hours.',
        catDesktopCacheName: 'Renderer caches',
        catDesktopCacheDesc: 'Renderer and shader caches; rebuilt after a DSH restart.',
      },
    }

    /** Category id -> dictionary suffix. */
    const SLUG = {
      'bash-runtime': 'BashRuntime',
      'request-image-cache': 'RequestImageCache',
      'projection-cache': 'ProjectionCache',
      'acl-backups': 'AclBackups',
      'temp-scratch': 'TempScratch',
      'desktop-cache': 'DesktopCache',
    }

    // Every theme variable carries a literal fallback: the settings panel can
    // render in a nested theme scope that does not define the whole token set,
    // and an unresolved var() on `background` silently falls back to the
    // browser's grey button face, which made the primary button's white label
    // disappear.
    const CSS = `
      .dsj-page { display: flex; flex-direction: column; gap: 18px; padding: 2px 0 28px; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary, inherit); }
      .dsj-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .dsj-title { margin: 0; font-size: 16px; font-weight: 600; }
      .dsj-sub { margin: 6px 0 0; color: var(--dsw-alias-label-secondary, #8a8f98); max-width: 64ch; }
      .dsj-card { background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.10)); border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); border-radius: 12px; overflow: hidden; backdrop-filter: blur(14px); }
      .dsj-summary { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 18px; }
      .dsj-total { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.15; }
      .dsj-caption { color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 12px; margin-top: 4px; word-break: break-all; }
      .dsj-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 54%; }
      .dsj-chip { font-size: 11px; color: var(--dsw-alias-label-secondary, #8a8f98); background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.14)); border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); border-radius: 999px; padding: 3px 8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dsj-listhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); font-size: 12px; color: var(--dsw-alias-label-secondary, #8a8f98); background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.14)); }
      .dsj-link { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-brand-primary, #4d6bfe); font: inherit; font-size: 12px; padding: 0; cursor: pointer; }
      .dsj-link:disabled { color: var(--dsw-alias-label-secondary, #8a8f98); cursor: default; }
      .dsj-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.22)); cursor: pointer; }
      .dsj-row:last-child { border-bottom: 0; }
      .dsj-row:hover { background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.10)); }
      .dsj-check { margin: 2px 0 0; width: 15px; height: 15px; flex: none; accent-color: var(--dsw-alias-brand-primary, #4d6bfe); cursor: pointer; }
      .dsj-main { flex: 1; min-width: 0; }
      .dsj-name { display: flex; align-items: center; gap: 8px; font-weight: 500; flex-wrap: wrap; }
      .dsj-desc { color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 12px; margin-top: 3px; }
      .dsj-size { flex: none; min-width: 82px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
      .dsj-count { display: block; color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 11px; font-weight: 400; margin-top: 2px; }
      .dsj-badge { font-size: 10px; line-height: 1; padding: 3px 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.14)); border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); font-weight: 500; }
      .dsj-badge-safe { color: var(--dsw-alias-state-success-primary, #2bb673); }
      .dsj-badge-caution { color: var(--dsw-alias-state-warn-primary, #e0a33a); }
      .dsj-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.35)); background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.10)); color: var(--dsw-alias-label-primary, inherit); height: 30px; padding: 0 12px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
      .dsj-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.18)); }
      .dsj-btn-primary { background: #2563eb; border-color: transparent; color: #ffffff; font-weight: 600; }
      .dsj-btn-primary:hover:not(:disabled) { background: #1d4ed8; filter: none; }
      .dsj-btn:disabled { opacity: 1; color: var(--dsw-alias-label-secondary, #8a8f98); background: transparent; border-color: var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); }
      .dsj-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .dsj-footnote { color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 12px; max-width: 54ch; }
      .dsj-banner { border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.28)); border-radius: 12px; padding: 12px 14px; background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.10)); backdrop-filter: blur(14px); display: flex; flex-direction: column; gap: 8px; }
      .dsj-banner-warn { border-color: var(--dsw-alias-state-warn-primary, #e0a33a); }
      .dsj-banner-error { border-color: var(--dsw-alias-state-error-primary, #e04c4c); }
      .dsj-banner-ok { border-color: var(--dsw-alias-state-success-primary, #2bb673); }
      .dsj-banner-title { font-weight: 600; }
      .dsj-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .dsj-auto { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 14px 16px; }
      .dsj-switch { position: relative; flex: none; width: 36px; height: 20px; padding: 0; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.35)); background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.18)); cursor: pointer; }
      .dsj-switch[aria-checked="true"] { background: var(--dsw-alias-state-success-primary, #2bb673); border-color: transparent; }
      .dsj-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-secondary, #9aa0a6); display: block; transition: transform 0.16s ease; }
      .dsj-switch[aria-checked="true"] .dsj-knob { transform: translateX(16px); background: #ffffff; }
      .dsj-select { height: 26px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.35)); background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.10)); color: var(--dsw-alias-label-primary, inherit); font: inherit; font-size: 12px; padding: 0 4px; }
      .dsj-inline { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dsj-muted { color: var(--dsw-alias-label-secondary, #8a8f98); }
    `

    /**
     * Resolve the active locale id.
     * @param {any} ctx Client context.
     * @returns {'zh' | 'en'} Two-letter locale this panel speaks.
     */
    function activeLocale(ctx) {
      try {
        const active = String(ctx.locale.getLocale().active ?? '').toLowerCase()
        return active.startsWith('zh') ? 'zh' : 'en'
      } catch {
        const language = typeof navigator === 'undefined' ? '' : String(navigator.language ?? '')
        return language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
      }
    }

    /**
     * Build the translator: the locale service when it answers, local
     * dictionaries otherwise. Reads the active locale at call time, so a
     * re-render after `locale/change` shows fresh text.
     * @param {any} ctx Client context.
     * @returns {(key: string, values?: Record<string, string>) => string} Translate.
     */
    function createTranslator(ctx) {
      let bound = null
      try {
        bound = ctx.locale.bind(NS)
      } catch {
        bound = null
      }
      return (key, values) => {
        let text
        try {
          const fromService = bound === null ? key : bound(key)
          text = fromService === key ? undefined : fromService
        } catch {
          text = undefined
        }
        if (typeof text !== 'string') {
          const dict = DICT[activeLocale(ctx)] ?? DICT.en
          text = dict[key] ?? DICT.en[key] ?? key
        }
        if (values) {
          for (const [name, value] of Object.entries(values)) text = text.split(`{${name}}`).join(String(value))
        }
        return text
      }
    }

    /**
     * Re-render on locale changes.
     * @param {any} ctx Client context.
     */
    function useLocaleTick(ctx) {
      const [, setRevision] = React.useState(0)
      React.useEffect(() => {
        let off
        try {
          off = ctx.locale.subscribe(() => setRevision((value) => value + 1))
        } catch {
          off = undefined
        }
        return () => {
          try {
            off?.()
          } catch {
            /* unsubscribe must not throw during unmount */
          }
        }
      }, [ctx])
    }

    /**
     * Human byte size.
     * @param {number} bytes Byte count.
     * @returns {string} Rendered size.
     */
    function formatBytes(bytes) {
      const value0 = Number(bytes)
      if (!Number.isFinite(value0) || value0 <= 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let value = value0
      let unit = 0
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
      }
      return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
    }

    /**
     * @param {string} suffix Route suffix.
     * @returns {string} Absolute same-origin URL.
     */
    function endpoint(suffix) {
      const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
      try {
        return new URL(`${BASE}${suffix}`, base).toString()
      } catch {
        return `${BASE}${suffix}`
      }
    }

    /**
     * JSON call against the Host route.
     * @param {string} suffix Route suffix.
     * @param {RequestInit} [init] Fetch options.
     * @returns {Promise<any>} Parsed body.
     */
    async function callHost(suffix, init) {
      const response = await fetch(endpoint(suffix), {
        cache: 'no-store',
        ...init,
        headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) },
      })
      const text = await response.text()
      let body
      try {
        body = text === '' ? null : JSON.parse(text)
      } catch {
        throw new Error(text.trim().slice(0, 180) || `HTTP ${response.status}`)
      }
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || `HTTP ${response.status}`)
      }
      return body
    }

    /**
     * Panel state: one scan, one cleanup, one settings write at a time.
     * @returns {{ data: any, error: string | null, busy: boolean, scanning: boolean, scan: (force?: boolean) => Promise<void>, clean: (ids: string[]) => Promise<any>, save: (patch: any) => Promise<any> }} Panel API.
     */
    function useJanitor() {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [scanning, setScanning] = React.useState(true)

      const scan = React.useCallback(async (force) => {
        setBusy(true)
        setScanning(true)
        setError(null)
        try {
          const next = await callHost(`/state${force ? '?force=1' : ''}`, { method: 'GET' })
          setData(next)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          setBusy(false)
          setScanning(false)
        }
      }, [])

      const clean = React.useCallback(async (ids) => {
        setBusy(true)
        setError(null)
        try {
          const next = await callHost('/clean', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          })
          if (next?.state) setData(next.state)
          return next
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          return null
        } finally {
          setBusy(false)
        }
      }, [])

      const save = React.useCallback(async (patch) => {
        setError(null)
        try {
          const next = await callHost('/settings', { method: 'POST', body: JSON.stringify(patch) })
          if (next?.settings) setData((previous) => (previous ? { ...previous, settings: next.settings } : previous))
          return next?.settings ?? null
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          return null
        }
      }, [])

      React.useEffect(() => {
        scan(false)
      }, [scan])

      return { data, error, busy, scanning, scan, clean, save }
    }

    /**
     * One cache category row.
     * @param {any} props Row props.
     * @returns {any} Element.
     */
    function CategoryRow({ category, t, checked, disabled, onToggle }) {
      const id = category.id
      const slug = SLUG[id] ?? 'Unknown'
      const riskLabel = category.risk === 'safe' ? t('safe') : t('caution')
      // The row is a div, not a label: a nested control inside a label would
      // toggle the checkbox when that control is clicked.
      const onRowClick = (event) => {
        if (disabled) return
        if (event.target?.closest?.('input, select, button, a')) return
        onToggle(id)
      }
      return h('div', { className: 'dsj-row', onClick: onRowClick },
        h('input', {
          className: 'dsj-check',
          type: 'checkbox',
          checked: checked,
          disabled: disabled,
          onChange: () => onToggle(id),
          'aria-label': t(`cat${slug}Name`),
        }),
        h('div', { className: 'dsj-main' },
          h('div', { className: 'dsj-name' },
            h('span', null, t(`cat${slug}Name`)),
            h('span', { className: `dsj-badge ${category.risk === 'safe' ? 'dsj-badge-safe' : 'dsj-badge-caution'}` }, riskLabel),
          ),
          h('div', { className: 'dsj-desc' }, t(`cat${slug}Desc`)),
        ),
        h('div', { className: 'dsj-size' },
          formatBytes(category.bytes),
          h('span', { className: 'dsj-count' }, `${category.files ?? 0} ${t('files')}`),
        ),
      )
    }

    /**
     * The Settings page.
     * @param {{ t: (key: string, values?: Record<string, string>) => string, ctx: any }} props Panel props.
     * @returns {any} Element.
     */
    function JanitorPage({ t, ctx }) {
      useLocaleTick(ctx)
      const remote = useJanitor()
      const [picked, setPicked] = React.useState(null)
      const [confirming, setConfirming] = React.useState(false)
      const [result, setResult] = React.useState(null)

      const data = remote.data
      const categories = data?.categories ?? []

      React.useEffect(() => {
        if (data === null || picked !== null) return
        setPicked(new Set(data.categories.filter((entry) => entry.risk === 'safe' && entry.bytes > 0).map((entry) => entry.id)))
      }, [data, picked])

      const toggle = (id) => {
        setPicked((previous) => {
          const next = new Set(previous ?? [])
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        setConfirming(false)
      }

      const selected = categories.filter((entry) => picked?.has(entry.id))
      const selectedBytes = selected.reduce((sum, entry) => sum + entry.bytes, 0)
      const selectableSafe = categories.filter((entry) => entry.risk === 'safe' && entry.bytes > 0).length
      const needsConfirm = selected.some((entry) => entry.risk === 'caution')
      const autoEnabled = data?.settings?.autoClean?.enabled === true

      const runClean = async () => {
        if (selected.length === 0) return
        if (needsConfirm && !confirming) {
          setConfirming(true)
          return
        }
        const ids = selected.map((entry) => entry.id)
        const outcome = await remote.clean(ids)
        setConfirming(false)
        if (outcome) {
          const skipped = (outcome.results ?? []).reduce((sum, entry) => sum + (entry.errors?.length ?? 0), 0)
          setResult({ bytes: outcome.freedBytes, count: ids.length, skipped })
          setPicked(new Set())
        }
      }

      const header = h('header', { className: 'dsj-head' },
        h('div', null,
          h('h2', { className: 'dsj-title' }, t('title')),
          h('p', { className: 'dsj-sub' }, t('intro')),
        ),
        h('button', {
          className: 'dsj-btn',
          type: 'button',
          disabled: remote.busy,
          onClick: () => remote.scan(true),
        }, remote.scanning ? t('scanning') : t('rescan')),
      )

      if (data === null) {
        return h('div', { className: 'dsj-page' },
          h('style', null, CSS),
          header,
          remote.error
            ? h('div', { className: 'dsj-banner dsj-banner-error' },
                h('div', { className: 'dsj-banner-title' }, t('failed')),
                h('div', { className: 'dsj-muted' }, remote.error),
              )
            : h('div', { className: 'dsj-muted' }, t('loading')),
        )
      }

      const cleanable = categories.filter((entry) => entry.risk === 'safe').reduce((sum, entry) => sum + entry.bytes, 0)

      const summary = h('section', { className: 'dsj-card' },
        h('div', { className: 'dsj-summary' },
          h('div', null,
            h('div', { className: 'dsj-caption' }, t('totalLabel')),
            h('div', { className: 'dsj-total' }, formatBytes(data.overview?.totalBytes ?? 0)),
            h('div', { className: 'dsj-caption' }, `${t('cleanable', { size: formatBytes(cleanable) })} · ${data.home ?? ''}`),
          ),
          h('div', { className: 'dsj-chips' },
            (data.overview?.top ?? []).map((row) => h('span', { key: row.name, className: 'dsj-chip' }, `${row.name} ${formatBytes(row.bytes)}`)),
          ),
        ),
      )

      const list = h('section', { className: 'dsj-card' },
        h('div', { className: 'dsj-listhead' },
          h('span', null, t('categories')),
          h('div', { className: 'dsj-inline' },
            h('span', null, t('selectedLabel', { size: formatBytes(selectedBytes) })),
            h('button', {
              className: 'dsj-link',
              type: 'button',
              disabled: remote.busy || selectableSafe === 0,
              onClick: () => {
                setPicked(new Set(categories.filter((entry) => entry.risk === 'safe' && entry.bytes > 0).map((entry) => entry.id)))
                setConfirming(false)
              },
            }, t('pickAll')),
          ),
        ),
        categories.length === 0
          ? h('div', { className: 'dsj-row dsj-muted' }, t('empty'))
          : categories.map((entry) => h(CategoryRow, {
              key: entry.id,
              category: entry,
              t,
              checked: picked?.has(entry.id) === true,
              disabled: remote.busy,
              onToggle: toggle,
            })),
      )

      const cleanLabel = selectedBytes > 0
        ? `${t('clean')} · ${formatBytes(selectedBytes)}`
        : t('clean')

      const footer = h('footer', { className: 'dsj-foot' },
        h('button', {
          className: 'dsj-btn dsj-btn-primary',
          type: 'button',
          disabled: remote.busy || selected.length === 0,
          onClick: runClean,
        }, remote.busy ? t('cleaning') : cleanLabel),
        h('span', { className: 'dsj-footnote' }, t('cleanHint')),
      )

      const confirmBanner = confirming
        ? h('div', { className: 'dsj-banner dsj-banner-warn' },
            h('div', { className: 'dsj-banner-title' }, t('confirmTitle')),
            h('div', { className: 'dsj-muted' }, t('confirmBody')),
            h('div', { className: 'dsj-actions' },
              h('button', { className: 'dsj-btn', type: 'button', onClick: () => setConfirming(false) }, t('cancel')),
              h('button', { className: 'dsj-btn dsj-btn-primary', type: 'button', onClick: runClean }, t('confirmOk')),
            ),
          )
        : null

      const resultBanner = result
        ? h('div', { className: 'dsj-banner dsj-banner-ok' },
            h('div', { className: 'dsj-banner-title' }, t('done', { size: formatBytes(result.bytes) })),
            h('div', { className: 'dsj-muted' }, t('doneHint')),
            result.skipped > 0 ? h('div', { className: 'dsj-muted' }, t('skippedHint', { count: String(result.skipped) })) : null,
            h('div', { className: 'dsj-actions' },
              h('button', { className: 'dsj-btn', type: 'button', onClick: () => setResult(null) }, t('dismiss')),
            ),
          )
        : null

      const errorBanner = remote.error
        ? h('div', { className: 'dsj-banner dsj-banner-error' },
            h('div', { className: 'dsj-banner-title' }, t('failed')),
            h('div', { className: 'dsj-muted' }, remote.error),
          )
        : null

      const autoCard = h('section', { className: 'dsj-card' },
        h('div', { className: 'dsj-auto' },
          h('div', null,
            h('div', { className: 'dsj-name' }, t('autoTitle')),
            h('div', { className: 'dsj-desc' }, t('autoDesc')),
          ),
          h('div', { className: 'dsj-inline' },
            h('span', { className: 'dsj-muted' }, autoEnabled ? t('autoOn') : t('autoOff')),
            h('button', {
              className: 'dsj-switch',
              type: 'button',
              role: 'switch',
              'aria-checked': autoEnabled,
              'aria-label': t('autoTitle'),
              disabled: remote.busy,
              onClick: () => remote.save({ autoClean: { enabled: !autoEnabled } }),
            }, h('span', { className: 'dsj-knob' })),
          ),
        ),
      )

      return h('div', { className: 'dsj-page' },
        h('style', null, CSS),
        header,
        summary,
        list,
        footer,
        confirmBanner,
        resultBanner,
        errorBanner,
        autoCard,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = createTranslator(ctx)

        ctx.effect(() => {
          const disposers = []
          for (const [locale, dict] of Object.entries(DICT)) {
            try {
              disposers.push(ctx.locale.register(NS, locale, dict))
            } catch {
              /* A duplicate namespace must not blank the page: local dicts still answer. */
            }
          }
          return () => {
            for (const dispose of disposers) {
              try {
                dispose()
              } catch {
                /* idempotent disposer */
              }
            }
          }
        })

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'disk-janitor',
          order: 55,
          label: () => t('nav'),
        }, () => h(JanitorPage, { t, ctx })))
      },
    }
  },
})
