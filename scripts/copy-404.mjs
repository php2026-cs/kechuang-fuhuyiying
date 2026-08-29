// GitHub Pages SPA fallback: 让 /recruit、/messages 等深链接刷新不 404
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const html = readFileSync(resolve(distDir, 'index.html'), 'utf8')
writeFileSync(resolve(distDir, '404.html'), html)
console.log('[copy-404] dist/404.html generated for SPA fallback')
