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
    "echo '=== CURRENT ==='",
    "readlink -f /opt/vps-stack/apps/dogu-next/current || true",
    "echo '=== RELEASES ==='",
    "ls -lt /opt/vps-stack/apps/dogu-next/releases 2>/dev/null | head -20 || true",
    "echo '=== APP STATUS ==='",
    "docker inspect dogu-next-app --format 'Status={{.State.Status}} Exit={{.State.ExitCode}} Error={{.State.Error}} Started={{.State.StartedAt}} Finished={{.State.FinishedAt}}' 2>&1 || true",
    "echo '=== APP LOGS ==='",
    "docker logs --tail 160 dogu-next-app 2>&1 || true",
    "echo '=== PROMOTE UNIT ==='",
    "systemctl status dogu-guard-promote-4fa16d1.service --no-pager -l 2>&1 || true"
  ].join("; ");

  try {
    const result = await runSsh(command, 75);
    return Response.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, {
      status: 500,
      headers: { "cache-control": "no-store" }
    });
  }
}
