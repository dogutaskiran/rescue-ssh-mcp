import { after } from "next/server";
import { runSsh } from "../../../../src/ssh.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
const JOBS={"snapshot":"set +e; echo ===LOAD===; cat /proc/loadavg; echo ===PSI===; for f in /proc/pressure/{cpu,memory,io}; do echo \"$f\"; cat \"$f\" | head -2; done; echo ===THREAD_STATES===; ps -eLo stat=,comm= | awk '{a[substr($1,1,1)]++; if($1~/^R/) r[$2]++; if($1~/^D/) d[$2]++} END {for(k in a) print \"STATE\",k,a[k]; for(k in r) print \"RUNNING\",r[k],k; for(k in d) print \"BLOCKED\",d[k],k}' | sort -k2,2nr | head -80; echo ===PARENT_ZOMBIES===; ps -eo ppid=,stat= | awk '$2~/^Z/ {x[$1]++} END {for(k in x) print x[k],k}' | sort -rn | head -15; echo ===TOP_THREADS===; ps -eLo pid,ppid,tid,stat,comm,pcpu --sort=-pcpu | head -35; echo ===DONE===","containers":"set +e; echo ===CONTAINERS===; docker ps -a --format '{{.Names}}|{{.Status}}' | awk 'BEGIN{n=0;u=0}{n++;if(index($0,\"unhealthy\"))u++} END{print \"total=\"n,\"unhealthy=\"u}'; echo ===DOCKER_STATS===; timeout 25 docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.PIDs}}' 2>/dev/null | head -150; echo ===DONE===","disk":"set +e; echo ===MEM===; free -m; echo ===VMSTAT===; vmstat 1 3 | tail -4; echo ===FS===; df -h / /var/lib/docker 2>/dev/null; echo ===CGROUP===; cat /sys/fs/cgroup/cpu.stat 2>/dev/null; echo ===DONE==="};
export async function GET(request) {
  if(process.env.VERCEL_ENV!=="preview") return Response.json({error:"preview_only"},{status:404});
  const job=new URL(request.url).searchParams.get("job")||"snapshot";
  if(!Object.prototype.hasOwnProperty.call(JOBS,job)) return Response.json({error:"unknown_job"},{status:400});
  after(async()=>{
    try{
      const r=await runSsh(JOBS[job],155);
      console.log("LOADATTR_BEGIN job="+job+" exit="+r.exitCode);
      console.log((r.stdout||"").slice(0,17000));
      console.log("LOADATTR_END job="+job+" stderr="+String(r.stderr||"").slice(0,800));
    }catch(e){
      console.error("LOADATTR_ERROR job="+job+" code="+(e.code||"none")+" message="+String(e.message||e).slice(0,500));
    }
  });
  return Response.json({accepted:true,job,mode:"asynchronous_via_runtime_logs"},{headers:{"cache-control":"no-store"}});
}
