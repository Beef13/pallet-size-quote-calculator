// The copy editor, as a Vite plugin that only exists while the site runs on your own computer
// (`npm run editor`). It is never part of a build, so it is never on the live site.
//
//   /__copy/            the editor page
//   /__copy/api/scan    every piece of wording found in the pages, the app and the PDFs
//   /__copy/api/save    write edits back into the source files

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { siteView, saveEdits } from './scan.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const UI = path.join(here, 'ui')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }

const send = (res, status, body, type = 'application/json') => {
  res.statusCode = status
  res.setHeader('Content-Type', `${type}; charset=utf-8`)
  res.setHeader('Cache-Control', 'no-store')
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

const readBody = (req) => new Promise((resolve, reject) => {
  let data = ''
  req.on('data', chunk => { data += chunk; if (data.length > 5e6) reject(new Error('Too much data')) })
  req.on('end', () => resolve(data))
  req.on('error', reject)
})

// Which files have changes that are saved here but not yet published
const gitChanges = (root) => new Promise((resolve) => {
  execFile('git', ['status', '--porcelain'], { cwd: root }, (error, out) => {
    if (error) return resolve(null)
    resolve(out.split('\n').filter(Boolean).map(line => line.slice(3).trim()))
  })
})

export default function copyEditor() {
  let root = process.cwd()
  let base = '/'
  let pages = []

  return {
    name: 'pallet-copy-editor',
    apply: 'serve',

    configResolved(config) {
      root = config.root
      base = config.base
      // The pages are whatever the site is built from, so a new page appears here by itself
      const input = config.build.rollupOptions.input || {}
      const list = typeof input === 'string' ? [input] : Array.isArray(input) ? input : Object.values(input)
      pages = list.map(file => path.relative(root, file).split(path.sep).join('/')).filter(file => file.endsWith('.html'))
      if (!pages.length) pages = ['index.html']
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const at = url.pathname.indexOf('/__copy')
        if (at === -1 || (url.pathname.slice(0, at) !== '' && `${url.pathname.slice(0, at)}/` !== base)) return next()
        const route = url.pathname.slice(at + '/__copy'.length) || '/'

        try {
          if (route === '/api/scan') {
            const view = siteView(root, pages)
            return send(res, 200, { ...view, base, uncommitted: await gitChanges(root) })
          }
          if (route === '/api/version') {
            return send(res, 200, { version: siteView(root, pages).version })
          }
          if (route === '/api/save') {
            // Only this page, in this browser, on this computer may write to the files
            const origin = req.headers.origin
            if (req.method !== 'POST' || !origin || new URL(origin).host !== req.headers.host
              || !/^application\/json/.test(req.headers['content-type'] || '')) {
              return send(res, 403, { ok: false, error: 'Not allowed.' })
            }
            const { edits } = JSON.parse(await readBody(req))
            try {
              const files = saveEdits(root, pages, edits || [])
              return send(res, 200, { ok: true, files })
            } catch (error) {
              return send(res, 409, { ok: false, error: error.message, stale: Boolean(error.stale), id: error.id })
            }
          }
          if (route === '/') {
            // Without the closing slash the page's own files would be looked for in the wrong place
            if (!url.pathname.endsWith('/')) { res.statusCode = 302; res.setHeader('Location', `${url.pathname}/`); return res.end() }
            return send(res, 200, fs.readFileSync(path.join(UI, 'index.html')), 'text/html')
          }
          if (route === '/font.woff2') {
            const font = path.join(root, 'node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2')
            return fs.existsSync(font) ? send(res, 200, fs.readFileSync(font), 'font/woff2') : send(res, 404, '')
          }
          const file = path.join(UI, path.normalize(route).replace(/^([/\\])+/, ''))
          if (file.startsWith(UI) && fs.existsSync(file) && fs.statSync(file).isFile()) {
            return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream')
          }
          return send(res, 404, { ok: false, error: 'Not found.' })
        } catch (error) {
          return send(res, 500, { ok: false, error: error.message })
        }
      })
    }
  }
}
