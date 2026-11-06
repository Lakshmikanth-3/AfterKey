import { defineConfig } from 'vite';
import { creRelay } from './server/cre-relay';
export default defineConfig({plugins:[{name:'afterkey-cre-relay',configureServer(server){server.middlewares.use((req,res,next)=>{void creRelay(req,res,next);});}}]});
