import { sha256, stringToHex } from 'viem';
export function evidenceLogFrames(encoded:string):string[]{
  if(new TextEncoder().encode(encoded).length>60000)throw new Error('Evidence exceeds the bounded execution log size. Reduce configured scope.');
  const digest=sha256(stringToHex(encoded)),contents:string[]=[];
  let part='';
  for(const char of encoded){if(new TextEncoder().encode(JSON.stringify(part+char)).length>650){contents.push(part);part='';}part+=char;}if(part)contents.push(part);
  return contents.map((content,index)=>JSON.stringify({source:'AfterKey CRE chunk',digest,index,total:contents.length,content}));
}
