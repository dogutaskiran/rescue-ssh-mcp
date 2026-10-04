import { getAuthSecret } from "../../../src/config.js";
import { runSsh } from "../../../src/ssh.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== getAuthSecret()) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSsh(
      "set -eu; printf 'RESCUE_SSH_OK\\n'; hostname; id -un; uptime; if command -v docker >/dev/null 2>&1; then docker ps --format '{{.Names}}\\t{{.Status}}' | head -30; fi",
      30
    );
    return Response.json({ ok: result.exitCode === 0, ...result }, { status: result.exitCode === 0 ? 200 : 500 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message, code: error.code ?? null },
      { status: 500 }
    );
  }
}
