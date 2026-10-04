import { getAuthSecret } from "../../../src/config.js";
import { runSsh } from "../../../src/ssh.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== getAuthSecret()) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const command = [
    "set -u",
    "echo '=== START APP ==='",
    "docker start dogu-next-app 2>&1 || true",
    "sleep 6",
    "echo '=== APP STATUS ==='",
    "docker inspect dogu-next-app --format 'Status={{.State.Status}} Error={{.State.Error}} Exit={{.State.ExitCode}} Started={{.State.StartedAt}} Finished={{.State.FinishedAt}}' 2>&1 || true",
    "echo '=== APP LOGS ==='",
    "docker logs --tail 140 dogu-next-app 2>&1 || true",
    "echo '=== EDGE TEST ==='",
    "docker exec dogu-next-edge nginx -t 2>&1 || true",
    "echo '=== EDGE RELOAD ==='",
    "docker exec dogu-next-edge nginx -s reload 2>&1 || true",
    "sleep 2",
    "echo '=== INTERNAL APP ==='",
    "docker exec dogu-next-edge sh -lc 'wget -S -O - http://dogu-next-app:3000/.well-known/oauth-protected-resource 2>&1 | head -80' 2>&1 || true",
    "echo '=== PUBLIC MCP ==='",
    "curl -ksS -D - -o /tmp/dogu_mcp_body --max-time 15 https://mcp.dogu.one/mcp || true",
    "head -n 20 /tmp/dogu_mcp_body 2>/dev/null || true"
  ].join("; ");

  try {
    const result = await runSsh(command, 105);
    return Response.json({ ok: true, result }, {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
