import { runSsh } from "../../../../src/ssh.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const COMMAND = "set +e\necho '==HOST=='\nhostname\necho '==CONTAINERS=='\ndocker ps -a --format '{{.Names}}|{{.Status}}' | grep -Ei 'openbao|vault|traefik' | head -30 || true\necho '==NETWORK=='\ndocker network inspect traefik-public --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\\n' | grep -Ei 'openbao|vault|traefik' | head -30 || true\necho '==OPENBAO_CONTAINER_DETAILS=='\nfor id in $(docker ps -aq --filter name=openbao --filter name=vault); do docker inspect --format 'name={{.Name}} running={{.State.Running}} image={{.Config.Image}} ports={{json .NetworkSettings.Ports}} networks={{range $n,$v := .NetworkSettings.Networks}}{{$n}},{{end}}' \"$id\"; docker inspect --format 'traefik-enabled={{index .Config.Labels \"traefik.enable\"}} router={{index .Config.Labels \"traefik.http.routers.openbao.rule\"}}' \"$id\"; done\necho '==HTTP=='\nfor addr in 'https://openbao.kvar.one/v1/sys/health' 'http://127.0.0.1:8200/v1/sys/health'; do printf '%s ' \"$addr\"; curl -ks -o /dev/null --connect-timeout 2 --max-time 5 -w 'status=%{http_code} ip=%{remote_ip}\\n' \"$addr\" || true; done\necho '==PROCESS=='\nps -eo comm | grep -Ei 'bao|vault|traefik' | sort -u || true\necho '==END=='";
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return Response.json({error:"preview_only"}, {status:404});
  try {
    const result = await runSsh(COMMAND,35);
    return Response.json({ok:result.exitCode===0,exitCode:result.exitCode,stdout:result.stdout,stderr:result.stderr}, {headers:{"cache-control":"no-store"}});
  } catch(e) {
    return Response.json({ok:false,code:e.code||null,error:String(e.message||e)}, {status:503,headers:{"cache-control":"no-store"}});
  }
}
