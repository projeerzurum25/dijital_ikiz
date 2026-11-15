#!/usr/bin/env bash
# Yeni kurum dijital ikizi üretir.
# Örnek: ./tenant-provisioner.sh --name "abc-holding" --subdomain "abc.sistem.com" --display "ABC Holding"
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node --no-warnings "$DIR/../engine/src/provisioner.mjs" "$@"
