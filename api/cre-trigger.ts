import { relayRequest } from '../server/cre-worker.js';

// Vercel's Web Standard handler preserves the exact signed request body.
// The shared relay validates the owner, digest, expiry and deployed scope.
export default {
  fetch(request: Request): Promise<Response> {
    return relayRequest(request);
  },
};
