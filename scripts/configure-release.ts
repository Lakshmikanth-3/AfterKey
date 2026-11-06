import fs from 'node:fs';
import {isAddress,zeroAddress} from 'viem';
const path=process.argv[2];
if(!path)throw new Error('Usage: node --import tsx scripts/configure-release.ts <coverage.json>');
const input=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(input.releases)||input.releases.length<1||input.releases.length>4)throw new Error('Coverage requires 1–4 release gates.');
for(const r of input.releases){
  if(!isAddress(r.gate)||r.gate.toLowerCase()===zeroAddress||!Array.isArray(r.consumers)||r.consumers.length<1||r.consumers.length>16||r.consumers.some((c:string)=>!isAddress(c)||c.toLowerCase()===zeroAddress)||new Set(r.consumers.map((c:string)=>c.toLowerCase())).size!==r.consumers.length)throw new Error('Invalid gate or consumer coverage.');
}
const config=JSON.parse(fs.readFileSync('cre/config.production.json','utf8'));
config.releases=input.releases;
fs.writeFileSync('cre/config.production.json',JSON.stringify(config,null,2)+'\n');
console.log('Release coverage saved. Redeploy CRE; exporting coverage alone does not activate verification.');
