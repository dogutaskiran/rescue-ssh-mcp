export const dynamic = "force-dynamic";

async function inspect(url) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    return {
      status: response.status,
      headers: {
        "www-authenticate": response.headers.get("www-authenticate"),
        "content-type": response.headers.get("content-type"),
        "location": response.headers.get("location")
      },
      body: body.slice(0, 2000)
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET() {
  const [mcp, mcpMeta, consoleMeta] = await Promise.all([
    inspect("https://mcp.dogu.one/mcp"),
    inspect("https://mcp.dogu.one/.well-known/oauth-protected-resource"),
    inspect("https://console.dogu.one/.well-known/oauth-protected-resource")
  ]);

  return Response.json({
    ok: true,
    service: "rescue-ssh-mcp",
    version: "0.2.0",
    dogu: { mcp, mcpMeta, consoleMeta }
  }, {
    headers: { "cache-control": "no-store" }
  });
}
