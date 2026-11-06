import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { creRelay } from './cre-relay';
const dist=resolve(import.meta.dirname,'../dist'),port=Number(process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
createServer((req,res)=>{
  if(req.url?.split('?')[0]==='/api/cre-trigger'){void creRelay(req,res);return;}
  if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405).end();return;}
  try{
    const path=resolve(dist,'.'+decodeURIComponent(new URL(req.url||'/',`http://${host}`).pathname));
    if(path!==dist&&!path.startsWith(dist+sep)){res.writeHead(403).end();return;}
    const file=path===dist?resolve(dist,'index.html'):path;
    if(!statSync(file).isFile()){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end();}
}).listen(port,host,()=>console.log(`AfterKey app and signed CRE relay: http://${host}:${port}`));
