#!/usr/bin/env node
// Copy worker.js and all its dependencies into .open-next/assets/
// so Cloudflare Pages advanced mode (_worker.js) can resolve relative imports.

const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Skipping (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const base = '.open-next';
const assets = path.join(base, 'assets');

// Copy worker entry point
fs.copyFileSync(path.join(base, 'worker.js'), path.join(assets, '_worker.js'));
console.log('Copied worker.js -> assets/_worker.js');

// Copy all directories the worker imports from
const dirs = ['cloudflare', 'middleware', '.build', 'server-functions'];
for (const dir of dirs) {
  copyDirSync(path.join(base, dir), path.join(assets, dir));
  console.log(`Copied ${dir}/ -> assets/${dir}/`);
}

console.log('Done. _worker.js and dependencies are in .open-next/assets/');
