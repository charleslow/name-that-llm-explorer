/* Minimal static file server for local testing. */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv' }

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let fp = path.join(root, urlPath === '/' ? 'index.html' : urlPath)
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end() }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' })
    res.end(buf)
  })
}).listen(8077, () => console.log('serving on http://localhost:8077'))
