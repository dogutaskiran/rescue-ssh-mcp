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
    "echo '=== APP INSPECT ==='",
    "docker inspect dogu-next-app --format 'Status={{.State.Status}} Error={{.State.Error}} Exit={{.State.ExitCode}} Started={{.State.StartedAt}} Finished={{.State.FinishedAt}} Image={{.Config.Image}} Cmd={{json .Config.Cmd}} Entrypoint={{json .Config.Entrypoint}} Restart={{.HostConfig.RestartPolicy.Name}}' 2>&1 || true",
    "echo '=== APP ENV NAMES ==='",
    "docker inspect dogu-next-app --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | cut -d= -f1 | sort | grep -Ei 'DOGU|OPENBAO|PORT|HOST|NODE|NEXT|DATABASE|SUPABASE' || true",
    "echo '=== APP MOUNTS ==='",
    "docker inspect dogu-next-app --format '{{range .Mounts}}{{println .Type .Source \"->\" .Destination}}{{end}}' 2>&1 || true",
    "echo '=== APP NETWORKS ==='",
    "docker inspect dogu-next-app --format '{{json .NetworkSettings.Networks}}' 2>&1 || true",
    "echo '=== APP LOGS ==='",
    "docker logs --tail 180 dogu-next-app 2>&1 || true",
    "echo '=== EDGE INSPECT ==='",
    "docker inspect dogu-next-edge --format 'Status={{.State.Status}} Networks={{json .NetworkSettings.Networks}} Mounts={{json .Mounts}}' 2>&1 || true",
    "echo '=== EDGE CONFIG ==='",
    "docker exec dogu-next-edge sh -lc 'nginx -T 2>&1 | sed -n \"1,260p\"' 2>&1 || true"
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
