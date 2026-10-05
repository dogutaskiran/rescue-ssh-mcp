import { runSsh } from "../../../../src/ssh.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request) {
  const host = request.headers.get("host") || "";
  const deploymentHost = process.env.VERCEL_URL || "";
  if (!deploymentHost || host !== deploymentHost) {
    return Response.json({ ok: false, error: "deployment_url_only" }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  const command = [
    "set -e",
    "test -x /usr/local/sbin/dogu-next-recreate-safe",
    "/usr/local/sbin/dogu-next-recreate-safe",
    "sleep 2",
    "docker inspect dogu-next-app --format 'status={{.State.Status}} started={{.State.StartedAt}} restart={{.RestartCount}}'",
    "readlink -f /opt/vps-stack/apps/dogu-next/current"
  ].join("; ");

  const result = await runSsh(command, 120);
  return Response.json(
    {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs
    },
    { status: result.exitCode === 0 ? 200 : 500, headers: { "cache-control": "no-store" } }
  );
}
