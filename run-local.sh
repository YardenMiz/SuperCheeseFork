#!/usr/bin/env bash
# Serve CheeseFork locally at http://localhost:4444
# Usage: ./run-local.sh [port]   (default port: 4444)
set -e
PORT="${1:-4444}"
cd "$(dirname "$0")"
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
    echo "Port $PORT is already in use (maybe CheeseFork is already running at http://localhost:$PORT)." >&2
    echo "Stop that process, or pick another port: ./run-local.sh 4445" >&2
    exit 1
fi
echo "CheeseFork running at http://localhost:$PORT  (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
