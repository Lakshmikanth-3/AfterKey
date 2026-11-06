import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { creRelay } from './cre-relay';
const port=Number(process.argv[2]||process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
const {default:worker}=await import(pathToFileURL(resolve(import.meta.dirname,'../dist/server/index.js')).href);
createServer(async(req,res)=>{
  if(req.url?.split('?')[0]==='/api/cre-trigger'){void creRelay(req,res);return;}
  try{
    const response=await worker.fetch(new Request(new URL(req.url||'/',`http://${host}:${port}`),{method:req.method||'GET'}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500).end('Unable to serve the application.');}
}).listen(port,host,()=>console.log(`AfterKey app and signed CRE relay: http://${host}:${port}`));
