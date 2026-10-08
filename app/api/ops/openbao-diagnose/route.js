import { runSsh } from "../../../../src/ssh.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const COMMAND = "set +e\necho '==DOCKER HEALTH=='\ndocker inspect --format 'state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}' openbao\necho '==HEALTHCHECK RECENT EXIT CODES=='\ndocker inspect openbao | python3 -c 'import json,sys; c=json.load(sys.stdin)[0]; print([(q.get(\"ExitCode\"),q.get(\"End\")) for q in (c.get(\"State\",{}).get(\"Health\",{}).get(\"Log\",[]) or [])][-6:])'\necho '==PUBLIC RESPONSE HEADERS=='\ncurl -ksS -o /dev/null -D - --connect-timeout 3 --max-time 6 https://openbao.kvar.one/v1/sys/health | grep -Ei '^HTTP/|^server:|^content-type:|^x-' | head -15\necho '==TRAEFIK LABELS=='\ndocker inspect openbao | python3 -c 'import sys,json; c=json.load(sys.stdin)[0]; x=c[\"Config\"].get(\"Labels\") or {}; print(\"\\n\".join(\"%s=%s\"%(k,v) for k,v in sorted(x.items()) if k.startswith(\"traefik.\") and not (\"password\" in k or \"secret\" in k)))'\necho '==INTERNAL HOST REQUESTS=='\nIP=$(docker inspect openbao | python3 -c 'import json,sys;print(json.load(sys.stdin)[0][\"NetworkSettings\"][\"Networks\"].get(\"traefik-public\",{}).get(\"IPAddress\",\"\"))')\nprintf 'container-ip=%s\\n' \"$IP\"\nfor target in \"http://$IP:8200/v1/sys/health\" \"https://$IP:8200/v1/sys/health\"; do printf '%s ' \"${target%%/v1*}\"; curl -ksS -o /dev/null --connect-timeout 2 --max-time 5 -w 'status=%{http_code} connect=%{time_connect}\\n' \"$target\" 2>/dev/null || true; done\necho '==CONTAINER INTERNAL HEALTH=='\ndocker exec openbao sh -c 'if command -v wget >/dev/null; then wget -S --spider -T 4 http://127.0.0.1:8200/v1/sys/health 2>&1 | grep -Ei \"HTTP/|connection|refused|timed|error\" | head -10; else echo no-wget; fi' || true\necho '==TRAEFIK CONFIG STATUS=='\ndocker ps --format '{{.Names}}:{{.Status}}' | grep stambol-traefik\necho '==DIAG END=='";
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return Response.json({error:"preview_only"}, {status:404});
  try {
    const result = await runSsh(COMMAND,35);
    return Response.json({ok:result.exitCode===0,exitCode:result.exitCode,stdout:result.stdout,stderr:result.stderr}, {headers:{"cache-control":"no-store"}});
  } catch(e) {
    return Response.json({ok:false,code:e.code||null,error:String(e.message||e)}, {status:503,headers:{"cache-control":"no-store"}});
  }
}
