import { getAuthSecret } from "../../../src/config.js";
import { runSsh } from "../../../src/ssh.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== getAuthSecret()) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const command = [
    "set -u",
    "echo '=== MATCHING CONTAINERS ==='",
    "docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' | grep -Ei 'dogu|stambol|mcp|edge|nginx' || true",
    "echo '=== LISTENERS ==='",
    "ss -lntp 2>/dev/null | grep -E ':(80|443|3000|3001|8787|8080|8081)\\b' || true",
    "echo '=== EDGE LOGS ==='",
    "docker logs --tail 120 stambol-edge 2>&1 || true",
    "echo '=== DOGU RECOVERY LOGS ==='",
    "docker logs --tail 80 dogu-recovery-mcp 2>&1 || true",
    "echo '=== CANDIDATE DOGU LOGS ==='",
    "for n in $(docker ps -a --format '{{.Names}}' | grep -Ei 'dogu|mcp' | head -20); do echo ---$n---; docker logs --tail 60 $n 2>&1 || true; done"
  ].join("; ");

  try {
    const result = await runSsh(command, 75);
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
