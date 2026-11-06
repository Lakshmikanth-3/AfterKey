// Only for read-only preparation. Never put transaction submission behind this timer.
export async function withReadDeadline<T>(read:Promise<T>,milliseconds=45000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([read,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('The Sepolia read timed out. No transaction was sent. Retry once, or change the RPC URL in Connections.')),milliseconds);})]);}
  finally{if(timer!==undefined)clearTimeout(timer);}
}
