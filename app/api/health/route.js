export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "rescue-ssh-mcp",
    version: "0.2.0"
  }, {
    headers: { "cache-control": "no-store" }
  });
}
