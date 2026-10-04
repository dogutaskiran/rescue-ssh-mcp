# Rescue SSH MCP

Standalone break-glass MCP server for one configured SSH host.

It is intentionally independent from DoğuOne, Kvar, OpenBao, Traefik, application databases, and product services.

## Tools

- `ssh_health`: read-only identity/uptime/Docker smoke.
- `ssh_exec`: arbitrary shell command on the configured host.

## Vercel environment

Required:

- `SSH_HOST`
- `SSH_PORT` (default 22)
- `SSH_USER`
- `SSH_PRIVATE_KEY_B64`
- `MCP_SHARED_SECRET` (32+ chars)

Recommended:

- `SSH_HOST_KEY_SHA256`

Optional limits:

- `MAX_COMMAND_SECONDS` (default 120, max 300)
- `MAX_OUTPUT_BYTES` (default 200000)

Generate a dedicated key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rescue_mcp -N '' -C rescue-ssh-mcp
cat ~/.ssh/rescue_mcp.pub >> ~/.ssh/authorized_keys
base64 -w0 ~/.ssh/rescue_mcp
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
openssl rand -hex 32
```

Do not commit the private key or shared secret.

## Endpoints

Health:

```
GET /api/health
```

MCP:

```
https://<project>.vercel.app/api/mcp?key=<MCP_SHARED_SECRET>
```

The endpoint also accepts:

```
Authorization: Bearer <MCP_SHARED_SECRET>
```

Keep this project boring: no queues, product APIs, browser automation, or application-specific logic.
