/**
 * Settings for the disk janitor, persisted as JSON in the DSH home.
 *
 * A file (not the Loader `config`) so the Settings page can change it without
 * editing a profile patch or restarting: the Host reads it on every scan.
 *
 * @module @local/dsh-disk-janitor/settings
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { clampNumber, describe } from './janitor.js'

/** Only regenerable scratch areas are ever auto-cleaned. */
export const AUTO_CLEAN_IDS = Object.freeze(['temp-scratch', 'request-image-cache'])

/** @type {Readonly<{ autoClean: { enabled: boolean, intervalHours: number, categories: string[] }, oldSessionDays: number }>} */
export const DEFAULT_SETTINGS = Object.freeze({
  autoClean: { enabled: false, intervalHours: 6, categories: [...AUTO_CLEAN_IDS] },
  oldSessionDays: 30,
})

/**
 * Path of the settings file.
 * @param {{ home: string }} env Resolved environment.
 * @returns {string} Absolute file path.
 */
export function settingsPath(env) {
  return path.join(env.home, 'dsh-disk-janitor.json')
}

/**
 * Read settings, falling back to defaults.
 * @param {{ home: string }} env Resolved environment.
 * @returns {Promise<typeof DEFAULT_SETTINGS>} Normalized settings.
 */
export async function readSettings(env) {
  try {
    const raw = await fsp.readFile(settingsPath(env), 'utf8')
    return normalize(JSON.parse(raw))
  } catch {
    return normalize(null)
  }
}

/**
 * Merge a patch into the stored settings and persist the result.
 * @param {{ home: string }} env Resolved environment.
 * @param {Record<string, unknown>} patch Partial settings.
 * @returns {Promise<typeof DEFAULT_SETTINGS>} Written settings.
 */
export async function writeSettings(env, patch) {
  const current = await readSettings(env)
  const merged = normalize({
    ...current,
    ...isRecord(patch) ? patch : {},
    autoClean: {
      ...current.autoClean,
      ...isRecord(patch?.autoClean) ? patch.autoClean : {},
    },
  })
  await fsp.mkdir(env.home, { recursive: true })
  const file = settingsPath(env)
  const temporary = `${file}.tmp-${process.pid}`
  await fsp.writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, file)
  return merged
}

/**
 * Normalize arbitrary JSON into the settings shape.
 * @param {unknown} raw Parsed file content.
 * @returns {typeof DEFAULT_SETTINGS} Normalized settings.
 */
export function normalize(raw) {
  const root = isRecord(raw) ? raw : {}
  const auto = isRecord(root.autoClean) ? root.autoClean : {}
  const categories = Array.isArray(auto.categories)
    ? auto.categories.filter((id) => typeof id === 'string' && AUTO_CLEAN_IDS.includes(id))
    : []
  return {
    autoClean: {
      enabled: typeof auto.enabled === 'boolean' ? auto.enabled : DEFAULT_SETTINGS.autoClean.enabled,
      intervalHours: clampNumber(auto.intervalHours, DEFAULT_SETTINGS.autoClean.intervalHours, 1, 168),
      categories: categories.length > 0 ? [...new Set(categories)] : [...AUTO_CLEAN_IDS],
    },
    oldSessionDays: clampNumber(root.oldSessionDays, DEFAULT_SETTINGS.oldSessionDays, 1, 3650),
  }
}

/**
 * Persist-on-write failure text for logs.
 * @param {unknown} error Thrown value.
 * @returns {string} Message.
 */
export const settingsError = describe

/**
 * @param {unknown} value Candidate.
 * @returns {value is Record<string, any>} Whether it is a plain object.
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
