import {runSsh} from "../../../../src/ssh.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
const COMMANDS={"ping":"set -e; echo SSH_RESCUE_OK; hostname; uptime","health":"set +e; docker inspect openbao --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}'; docker inspect openbao | python3 -c 'import sys,json; c=json.load(sys.stdin)[0]; print(\"recent_health_exit_codes=\"+str([v.get(\"ExitCode\") for v in c.get(\"State\",{}).get(\"Health\",{}).get(\"Log\",[])]))'; docker ps -a --format '{{.Names}}|{{.Status}}' | grep -Ei '(^openbao|traefik)' | head -12","network":"set +e; docker inspect openbao | python3 -c 'import sys,json; c=json.load(sys.stdin)[0]; print(\"networks=\"+str(list(c[\"NetworkSettings\"][\"Networks\"].keys())));print(\"traefik_ip=\"+str(c[\"NetworkSettings\"][\"Networks\"].get(\"traefik-public\",{}).get(\"IPAddress\")))'; IP=$(docker inspect openbao | python3 -c 'import sys,json;print(json.load(sys.stdin)[0][\"NetworkSettings\"][\"Networks\"].get(\"traefik-public\",{}).get(\"IPAddress\",\"\"))'); for proto in http https; do curl -ksS -o /dev/null --connect-timeout 2 --max-time 4 -w \"$proto=%{http_code}\\n\" \"$proto://$IP:8200/v1/sys/health\" 2>/dev/null || true; done","route":"set +e; docker inspect openbao | python3 -c 'import sys,json; c=json.load(sys.stdin)[0]; x=c[\"Config\"].get(\"Labels\") or {}; print(\"\\n\".join(k+\"=\"+v for k,v in sorted(x.items()) if k.startswith(\"traefik.\") and \"secret\" not in k.lower() and \"password\" not in k.lower()))'; curl -ksS -o /dev/null -D - --connect-timeout 2 --max-time 5 https://openbao.kvar.one/v1/sys/health 2>/dev/null | grep -Ei '^HTTP/|^server:|^content-type:'","local":"set +e; docker exec openbao sh -c 'if command -v wget >/dev/null; then wget -S --spider -T 4 http://127.0.0.1:8200/v1/sys/health 2>&1 | grep -Ei \"HTTP/|connection|refused|timed|error\" | head -8; else echo no-wget; fi' || true; docker inspect openbao --format 'health_status={{if .State.Health}}{{.State.Health.Status}}{{end}}'"};
export async function GET(request){
 if(process.env.VERCEL_ENV!=="preview") return Response.json({error:"preview_only"},{status:404});
 const action=new URL(request.url).searchParams.get("action")||"ping";
 if(!Object.prototype.hasOwnProperty.call(COMMANDS,action)) return Response.json({error:"invalid_action"},{status:400});
 let lastError=null;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await runSsh(COMMANDS[action],14);
   return Response.json({ok:r.exitCode===0,attempt,action,exitCode:r.exitCode,stdout:r.stdout,stderr:r.stderr},{headers:{"cache-control":"no-store"}});
  }catch(e){lastError={code:e.code||null,error:String(e.message||e)}}
 }
 return Response.json({ok:false,action,...lastError},{status:503,headers:{"cache-control":"no-store"}});
}
