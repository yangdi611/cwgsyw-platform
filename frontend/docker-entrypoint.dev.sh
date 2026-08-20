#!/bin/sh

set -eu

lock_checksum="$(sha256sum package-lock.json)"
checksum_file="node_modules/.package-lock.sha256"

if [ ! -f "$checksum_file" ] || [ "$(cat "$checksum_file")" != "$lock_checksum" ]; then
  npm ci
  printf '%s\n' "$lock_checksum" > "$checksum_file"
fi

exec npm run dev
