#!/usr/bin/env node
// Fix Windows backslash paths in worker.js for Cloudflare Workers (Linux runtime)
const fs = require('fs')
const path = require('path')

const workerPath = path.join('.open-next', 'worker.js')

if (!fs.existsSync(workerPath)) {
  console.error('worker.js not found at', workerPath)
  process.exit(1)
}

let content = fs.readFileSync(workerPath, 'utf8')
const before = content.length

// Replace Windows backslash path separators inside string literals
// Match patterns like: "./foo\\bar\\baz" → "./foo/bar/baz"
// We target import() paths, require() paths, and general string escapes
content = content.replace(/\\\\(?=[a-zA-Z0-9_\-\.]+)/g, '/')

// Also replace single-escaped backslashes used as path separators
// e.g. import(".open-next\middleware\handler") → import(".open-next/middleware/handler")
content = content.replace(/(?<=['"` ])\./g, (m, offset, str) => {
  // only touch paths that look like relative file paths
  return m
})

// Direct replacement of known bad patterns
content = content
  .replace(/\.open-next\\/g, '.open-next/')
  .replace(/server-functions\\/g, 'server-functions/')
  .replace(/middleware\\/g, 'middleware/')
  .replace(/cloudflare\\/g, 'cloudflare/')
  .replace(/\.build\\/g, '.build/')

fs.writeFileSync(workerPath, content, 'utf8')
console.log('Fixed Windows paths in worker.js (' + workerPath + ')')
