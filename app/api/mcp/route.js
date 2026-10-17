import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getAuthSecret, getSshConfig } from "../../../src/config.js";
import { runSsh } from "../../../src/ssh.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function text(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ssh_health",
      "Read-only SSH smoke test against the single configured rescue host.",
      { title: "SSH health", description: "Read-only SSH smoke test against the single configured rescue host.", inputSchema: z.object({}) },
      async () => {
        try {
          const result = await runSsh(
            "set -eu; printf 'RESCUE_SSH_OK\\n'; hostname; id -un; uptime; if command -v docker >/dev/null 2>&1; then docker ps --format '{{.Names}}\\t{{.Status}}' | head -30; fi",
            30
          );
          return { content: text(result), isError: result.exitCode !== 0 };
        } catch (error) {
          return {
            content: text({
              ok: false,
              error: error.message,
              code: error.code ?? null
            }),
            isError: true
          };
        }
      }
    );

    server.registerTool(
      "ssh_exec",
      "Execute a shell command over SSH on the single configured rescue host. This may modify system state.",
      {
        title: "SSH exec",
        description: "Execute a shell command over SSH on the single configured rescue host. This may modify system state.",
        inputSchema: z.object({
          command: z.string().min(1).max(8000),
          timeoutSeconds: z.number().int().min(1).max(300).optional()
        })
      },
      async ({ command, timeoutSeconds }) => {
        try {
          const cfg = getSshConfig();
          const result = await runSsh(
            command,
            Math.min(timeoutSeconds ?? cfg.maxCommandSeconds, cfg.maxCommandSeconds)
          );
          return { content: text(result), isError: result.exitCode !== 0 };
        } catch (error) {
          return {
            content: text({
              ok: false,
              error: error.message,
              code: error.code ?? null
            }),
            isError: true
          };
        }
      }
    );
  },
);

function suppliedSecret(request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return url.searchParams.get("key");
}

async function authorized(request) {
  try {
    return suppliedSecret(request) === getAuthSecret();
  } catch {
    return false;
  }
}

async function route(request) {
  if (!(await authorized(request))) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }
  return mcpHandler(request);
}

export { route as GET, route as POST, route as DELETE };
