// Cloudflare Edge Compatibility Polyfills
if (typeof (globalThis as any).__dirname === 'undefined') {
  (globalThis as any).__dirname = '';
}
if (typeof (globalThis as any).__filename === 'undefined') {
  (globalThis as any).__filename = '';
}

import { POST as handleNorthPoleLogin } from './app/api/northpole/login/route';
import { GET as handleNorthPoleMe, DELETE as handleNorthPoleLogout } from './app/api/northpole/me/route';
import { POST as handleNorthPoleResetPassword } from './app/api/northpole/reset-password/route';
import { GET as handleNorthPoleConfigGet, PATCH as handleNorthPoleConfigPatch } from './app/api/northpole/config/route';
import { GET as handleNorthPoleUsersGet, PATCH as handleNorthPoleUsersPatch } from './app/api/northpole/users/route';
import { GET as handleNorthPoleOperationsGet } from './app/api/northpole/operations/route';
import { POST as handleNorthPoleEmailTest } from './app/api/northpole/email/test/route';
import { GET as handleConfigGet } from './app/api/config/route';
import { POST as handleLeadsPost, GET as handleLeadsGet } from './app/api/leads/route';
import { POST as handleClearancePost } from './app/api/clearance/route';
import { POST as handleUsersPost } from './app/api/users/route';
import { POST as handleUserLogin } from './app/api/users/login/route';
import { GET as handleUserMe } from './app/api/users/me/route';
import { GET as handleWorkshopAuth } from './app/api/workshop/auth/route';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DATABASE_URL?: string;
  DATABASE_ADMIN_URL?: string;
  DIRECT_URL?: string;
  MODE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Populate runtime process.env with Cloudflare Worker bindings
    if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
    if (env.DATABASE_ADMIN_URL) process.env.DATABASE_ADMIN_URL = env.DATABASE_ADMIN_URL;
    if (env.DIRECT_URL) process.env.DIRECT_URL = env.DIRECT_URL;
    if (env.MODE) process.env.MODE = env.MODE;

    // Handle API endpoints
    try {
      if (pathname === '/api/northpole/login' && request.method === 'POST') {
        return await handleNorthPoleLogin(request);
      }
      if (pathname === '/api/northpole/me') {
        if (request.method === 'GET') return await handleNorthPoleMe();
        if (request.method === 'DELETE') return await handleNorthPoleLogout();
      }
      if (pathname === '/api/northpole/reset-password' && request.method === 'POST') {
        return await handleNorthPoleResetPassword(request);
      }
      if (pathname === '/api/northpole/config') {
        if (request.method === 'GET') return await handleNorthPoleConfigGet();
        if (request.method === 'PATCH') return await handleNorthPoleConfigPatch(request);
      }
      if (pathname === '/api/northpole/users') {
        if (request.method === 'GET') return await handleNorthPoleUsersGet(request);
        if (request.method === 'PATCH') return await handleNorthPoleUsersPatch(request);
      }
      if (pathname === '/api/northpole/operations' && request.method === 'GET') {
        return await handleNorthPoleOperationsGet(request);
      }
      if (pathname === '/api/northpole/email/test' && request.method === 'POST') {
        return await handleNorthPoleEmailTest(request);
      }
      if (pathname === '/api/config' && request.method === 'GET') {
        return await handleConfigGet();
      }
      if (pathname === '/api/leads') {
        if (request.method === 'GET') return await handleLeadsGet();
        if (request.method === 'POST') return await handleLeadsPost(request);
      }
      if (pathname === '/api/clearance' && request.method === 'POST') {
        return await handleClearancePost(request as any);
      }
      if (pathname === '/api/users' && request.method === 'POST') {
        return await handleUsersPost(request);
      }
      if (pathname === '/api/users/login' && request.method === 'POST') {
        return await handleUserLogin(request);
      }
      if (pathname === '/api/users/me' && request.method === 'GET') {
        return await handleUserMe(request);
      }
      if (pathname === '/api/workshop/auth' && request.method === 'GET') {
        return await handleWorkshopAuth();
      }
    } catch (err: any) {
      console.error('[Edge API Error]', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Serve static assets from Cloudflare edge CDN
    return env.ASSETS.fetch(request);
  },
};
