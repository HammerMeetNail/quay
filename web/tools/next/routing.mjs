import {HEADERS, localResponse} from './assets.mjs';
import {isApprovedRead, LIVE_ORIGIN} from './policy.mjs';
/** Shared by the live launcher and the real-browser fixture-origin harness. */
export async function installPreviewRoutes(context, getState, origin = LIVE_ORIGIN, onError = () => {}) {
  await context.route('**/*', async route => {
    try {
      const {mode, build, runtime, scope} = getState();
      const request = route.request();
      if (mode === 'native') {await route.continue(); return;}
      const local = localResponse(request.url(), request.method(), request.isNavigationRequest() && request.resourceType() === 'document', origin, build, runtime);
      if (local) {await route.fulfill({status: 200, ...local}); return;}
      if (isApprovedRead(request.url(), request.method(), scope, origin)) {await route.continue(); return;}
      if (new URL(request.url()).origin === origin) await route.fulfill({status: 403, headers: HEADERS, contentType: 'application/json', body: JSON.stringify({error_type: 'preview_operation_blocked'})});
      else await route.abort('blockedbyclient');
    } catch (error) {onError(error); await route.abort('failed').catch(() => {});}
  });
  await context.routeWebSocket('**/*', socket => {if (getState().mode === 'native') socket.connectToServer(); else void socket.close();});
}
