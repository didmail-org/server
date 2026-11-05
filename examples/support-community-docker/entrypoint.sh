#!/bin/bash
set -euo pipefail
instance=$(jq -r .instance /opt/demo-config.json)
mkdir -p /data/home /data/registry
# PID/port/lock records belong to the previous container process namespace.
# This image runs one owned daemon. Keep identity, auth.db, Space data and keys.
for record in /data/registry/*/instance.json; do
  [ -f "$record" ] || continue
  if jq -e --arg name "$instance" '.name == $name and .home == "/data/home"' "$record" >/dev/null; then
    rm -f "$record"
  fi
done
rm -f /data/home/.afs/daemon.pid /data/home/.afs/daemon.port /data/home/.afs/daemon.bind /data/home/.afs/daemon.lock
proxy_pid=''
cleanup() {
  if [ -n "$proxy_pid" ]; then kill "$proxy_pid" 2>/dev/null || true; fi
  arc service stop --instance "$instance" --json > /data/service-stop.json 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' TERM INT
arc service start --instance "$instance" --home /data/home --purpose evidence \
  --host 127.0.0.1 --port 8081 --no-advertise --no-peer-browse \
  --blocklet /opt/demo --json > /data/service-start.json
daemon_pid=$(jq -r .pid /data/service-start.json)
BUN_BE_BUN=1 /opt/arc/arc-linux-x64 /opt/warmup.mjs
nginx -c /opt/demo-proxy.conf -g 'daemon off;' &
proxy_pid=$!
while kill -0 "$daemon_pid" 2>/dev/null && kill -0 "$proxy_pid" 2>/dev/null; do
  sleep 1 &
  wait $! || true
done
exit 1
