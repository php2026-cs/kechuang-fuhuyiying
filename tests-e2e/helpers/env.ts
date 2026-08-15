import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface E2ECredentials {
  aEmail: string
  aPassword: string
  bEmail: string
  bPassword: string
}

/**
 * 从 .env.e2e.local 读取双账号凭据（该文件已被 .gitignore 忽略）。
 * 任何情况下都不会输出凭据值。
 */
export function loadE2ECredentials(): E2ECredentials | null {
  const file = resolve(process.cwd(), '.env.e2e.local')
  if (!existsSync(file)) return null

  const env: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }

  if (
    !env.E2E_USER_A_EMAIL ||
    !env.E2E_USER_A_PASSWORD ||
    !env.E2E_USER_B_EMAIL ||
    !env.E2E_USER_B_PASSWORD
  ) {
    return null
  }

  return {
    aEmail: env.E2E_USER_A_EMAIL,
    aPassword: env.E2E_USER_A_PASSWORD,
    bEmail: env.E2E_USER_B_EMAIL,
    bPassword: env.E2E_USER_B_PASSWORD,
  }
}
