# Rescue SSH MCP — Operating Runbook

Independent, minimal **break-glass SSH executor** for our Hostinger VPS. This is already deployed and should be **reused**, not rediscovered or rebuilt on every chat.

> **Operator rule:** For an authorized VPS action, go directly to the existing Rescue MCP `ssh_health` or `ssh_exec` tool / endpoint. Do not enumerate hundreds of Doğu One capabilities, redesign the architecture, create another rescue service, or route command execution through the Vercel **management** API. If this MCP is not attached as a ChatGPT tool, state that integration gap precisely; don't claim the SSH command ran.

## Canonical identifiers (verified 2026-10-13)

| Resource | Value |
| --- | --- |
| VPS provider | Hostinger |
| VPS ID | `720447` |
| VPS hostname | `stambol.com` |
| VPS IPv4 | `82.29.152.131` |
| VPS OS | Ubuntu 24.04 with Docker |
| Independent SSH MCP | `dogutaskiran/rescue-ssh-mcp` |
| Vercel project | `rescue-ssh-mcp` |
| Project ID | `prj_gC8sGqc4BRERb4RwJ5yOyiKPhy31` |
| MCP endpoint | `https://rescue-ssh-mcp.vercel.app/api/mcp` |
| Health endpoint | `https://rescue-ssh-mcp.vercel.app/api/health` |
| Main Compose file | `/opt/vps-stack/compose.yml` |

The above Vercel project has a READY deployment. On 2026-10-13, the public health endpoint responded HTTP 200 from the VPS. That only verifies the app endpoint, **not** authenticated SSH command execution.

## What it is / why it exists

Doğu One runs inside `dogu-next-app` **on the same VPS**. It must not use its own execution connection to stop/recreate its own container: a previous self-recreate killed the caller before the replacement started and stranded the service in Docker's `Created` state.

`self_runtime_mutation_blocked` is a **Doğu One host-execution safety guard**, not Hostinger's lock and not a user permission problem. Host-side recovery also uses `dogu-next-guard.timer` and `/usr/local/sbin/dogu-next-recreate-safe`.

This Rescue MCP lives separately on Vercel and uses its **own configured SSH credentials**. It is the designated independent channel for bounded VPS maintenance. **Do not disable the guard or restart `dogu-next-app` to edit another Compose service.**

`vps-stack` is **not another VPS, Docker installation, or daemon**. It is a historical Compose group used for multiple sites/apps (Doğu One, Dogu Taskiran, Stambol, Executable, BFT, Avenora and retired experiments) and the `dogu-deployd` release layout. Eventually separate applications can migrate to independently managed Compose projects.

## Direct invocation — not Vercel management API

The MCP service is an HTTP endpoint that speaks **MCP JSON-RPC (Streamable HTTP)**. It is **not** a plain `POST /ssh` REST command API.

- `ssh_health`: read-only hostname, uptime and Docker smoke test.
- `ssh_exec`: runs a single command on the configured VPS, with `command` and optional `timeoutSeconds` (max 300, bounded by server configuration).

**Best path from an MCP-connected client:** call `ssh_health` once when needed, then `ssh_exec({ command: "...", timeoutSeconds: 30 })` directly. Never copy private keys or tokens into chat messages.

**Direct HTTP fallback** for an authorized operator that already has the secret *securely injected into its own environment*:

```bash
export RESCUE_MCP_URL="https://rescue-ssh-mcp.vercel.app/api/mcp"
# MCP_SHARED_SECRET must already be populated by the secret authority.
# Do NOT print it, paste it in chat, put it in shell history or commit it.
test -n "${MCP_SHARED_SECRET:-}" || { echo "Missing MCP_SHARED_SECRET" >&2; exit 1; }

# Streamable HTTP MCP tools/call (a client may first need MCP initialize).
curl --fail-with-body --silent --show-error --no-buffer \
  -X POST "$RESCUE_MCP_URL" \
  -H "Authorization: Bearer $MCP_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ssh_health","arguments":{}}}'
```

If a standards-compliant MCP client requests initialization first, issue `initialize` (with supported protocol version and client info) and `notifications/initialized`, then `tools/call`, retaining any `Mcp-Session-Id` supplied by the server.

`401` means MCP authorization failed; `403` or an SSO HTML page may indicate Vercel Deployment Protection; `404` might be a wrong URL/path. **Never expose secret values in debugging output.** Treat HTTP 200 from `/api/health` as *app alive*, not as proof SSH succeeds. Check the returned `exitCode` and `stderr` from `ssh_exec`.

### Where credentials live

The Vercel project environment has `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY_B64`, `MCP_SHARED_SECRET`, with optional `SSH_HOST_KEY_SHA256`, `MAX_COMMAND_SECONDS` and `MAX_OUTPUT_BYTES`. Keep their values outside Git and chat. Do not repeatedly fetch/decrypt environment variables just to use an **already connected** tool. If there is no connected client/tool or an authorized HTTP executor, explicitly report that one missing connection rather than pretending Vercel project metadata is an SSH execution method.

## Safe maintenance recipes

### Read-only VPS snapshot

```bash
hostname
df -h /
docker ps -a --format '{{.Names}}|{{.Status}}'
docker compose -f /opt/vps-stack/compose.yml config --services
docker system df
```

Keep read-only calls short; for work exceeding 15 seconds, use the Rescue timeout setting or a bounded host job.

### Retirement of the Longevity Compose service (one-time, approved)

**Status as of 2026-10-13:** `surface-longevity` container had already been removed, **but** `/opt/vps-stack/compose.yml` still declared the `longevity` service (originally lines 30–46) with Traefik route `longevity.kvar.one`. Removing the declaration is an independent configuration-only change.

**Scope:** delete **only** `services.longevity`. Do not touch `avenora`, `loadout`, `dogu-next-app`, `deployd`, or any other service; do not invoke `compose up`, `compose down`, `restart`, or `docker system prune --volumes`. A backup and a validated parse are mandatory.

Run this **through authorized independent Rescue SSH**, not through Doğu One's protected self-mutation path:

```bash
sudo python3 - <<'PY'
from pathlib import Path
import os, re, shutil, stat, subprocess, tempfile
import yaml

path = Path("/opt/vps-stack/compose.yml")
old = path.read_text()
before = yaml.safe_load(old)
if "longevity" not in before.get("services", {}):
    print("ALREADY_ABSENT: services.longevity")
    raise SystemExit(0)

matches = list(re.finditer(
    r"(?ms)^  longevity:\s*\n.*?(?=^  [A-Za-z0-9_.-]+:\s*\n|\Z)",
    old
))
assert len(matches) == 1, "Unexpected Compose structure; no changes made"
m = matches[0]
new = old[:m.start()] + old[m.end():]
after = yaml.safe_load(new)
assert {k: v for k, v in before["services"].items() if k != "longevity"} == after["services"]
assert {k: v for k, v in before.items() if k != "services"} == {
    k: v for k, v in after.items() if k != "services"
}

fd, temp = tempfile.mkstemp(prefix=".compose-retire-longevity-", suffix=".yml", dir=path.parent)
try:
    with os.fdopen(fd, "w") as f:
        f.write(new)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(temp, stat.S_IMODE(path.stat().st_mode))
    subprocess.run(["docker", "compose", "-f", temp, "config", "-q"], check=True, timeout=15)
    assert path.read_text() == old, "Concurrent edit detected; no changes made"
    backup = path.with_name("compose.yml.before-retire-longevity.bak")
    if not backup.exists():
        shutil.copy2(path, backup)
    os.replace(temp, path)
    print("REMOVED: services.longevity; backup:", backup)
finally:
    if os.path.exists(temp):
        os.unlink(temp)
PY

docker compose -f /opt/vps-stack/compose.yml config -q
! docker compose -f /opt/vps-stack/compose.yml config --services | grep -Fxq longevity
! docker ps -a --format '{{.Names}}' | grep -Fxq surface-longevity
```

Note: YAML validation can fail if a Compose file requires unresolved environment variables or relative project settings. On failure, leave the original untouched and inspect the error. This recipe is **not proof that a change was executed**; confirm the verification commands on the live VPS before marking complete.

### Before removing anything else

1. Read current Docker/container and Compose ownership, identify mounted volumes/data and incoming Traefik routes.
2. If replacing a service, confirm the replacement is healthy first, including its actual domain/endpoint.
3. Preserve BrowserMesh, ComputerMesh, OpenBao, MailMesh, Postgres, Traefik and production surfaces unless a separate explicit migration/retirement decision exists.
4. Never blindly `docker volume prune`, `docker image prune -a`, or delete `/docker/crawlmesh/data/ingests` (valuable collected data).
5. Record affected resources, before/after state, and any blocker in Doğu One's operator ledger so the next chat resumes from facts instead of rediscovery.

## Original Vercel configuration / standalone setup

Required environment variables:

- `SSH_HOST`
- `SSH_PORT` (default 22)
- `SSH_USER`
- `SSH_PRIVATE_KEY_B64`
- `MCP_SHARED_SECRET` (32+ characters)

Recommended: `SSH_HOST_KEY_SHA256`.

Optional: `MAX_COMMAND_SECONDS` (default 120, max 300), `MAX_OUTPUT_BYTES` (default 200000).

Dedicated-key setup (only if provisioning a new host, **not** needed for this existing deployment):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rescue_mcp -N '' -C rescue-ssh-mcp
cat ~/.ssh/rescue_mcp.pub >> ~/.ssh/authorized_keys
base64 -w0 ~/.ssh/rescue_mcp
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
openssl rand -hex 32
```

Do not commit secrets or private keys. Keep this recovery service deliberately boring: one host, SSH health, SSH exec, no product APIs, queues, or new orchestration framework.
