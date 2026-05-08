const { existsSync } = require('node:fs')
const { spawnSync } = require('node:child_process')

function bashExecutable() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:/Program Files/Git/bin/bash.exe',
      'C:/Program Files/Git/usr/bin/bash.exe',
      'C:/Program Files (x86)/Git/bin/bash.exe'
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
  }
  return 'bash'
}

const result = spawnSync(bashExecutable(), ['./packages/contracts/codegen.sh'], {
  cwd: process.cwd(),
  stdio: 'inherit'
})

process.exit(result.status ?? 1)
