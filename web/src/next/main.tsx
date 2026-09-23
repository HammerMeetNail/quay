import React, {Component} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {Alert, Button} from '@patternfly/react-core';
import '@patternfly/react-core/dist/styles/base.css';
import './styles.css';
import {App} from './app/App';
import {SessionProvider} from './app/Session';
import {BASENAME, parseRuntime} from './lib/runtime';
import {readJson} from './lib/client';
class Boundary extends Component<
  {
    children: React.ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = {failed: false};
  static getDerivedStateFromError(): {
    failed: boolean;
  } {
    return {failed: true};
  }
  render(): React.ReactNode {
    return this.state.failed ? (
      <div className="qn-bootstrap">
        <Alert
          title="The view could not be displayed"
          variant="danger"
          isInline
        >
          <p>No raw registry content or credentials were logged.</p>
          <Button onClick={() => window.location.reload()}>
            Reload preview
          </Button>
        </Alert>
      </div>
    ) : (
      this.props.children
    );
  }
}
const node = document.getElementById('quay-next-root');
if (!node) throw new Error('Missing application root.');
// Apply the nonsecret preference before rendering a themed loading shell.
let preference = 'system';
try {
  preference = localStorage.getItem('quay-next.theme') ?? 'system';
} catch {
  /* Optional preference storage. */
}
document.documentElement.classList.toggle(
  'pf-v6-theme-dark',
  preference === 'dark' ||
    (preference !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches),
);
const root = createRoot(node);
root.render(
  <div className="qn-bootstrap">
    <h1>Quay Next</h1>
    <p role="status">Loading preview configuration…</p>
  </div>,
);
async function start(): Promise<void> {
  try {
    const response = await fetch(`${BASENAME}/runtime.json`, {
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Runtime unavailable');
    const runtime = parseRuntime(await readJson(response, 65536));
    root.render(
      <Boundary>
        <BrowserRouter basename={BASENAME}>
          <SessionProvider runtime={runtime}>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </Boundary>,
    );
  } catch {
    root.render(
      <div className="qn-bootstrap">
        <h1>Quay Next</h1>
        <Alert
          variant="danger"
          isInline
          title="Preview configuration is unavailable"
        >
          <p>
            Start the demo server or the live preview launcher. This build
            cannot be pointed at arbitrary origins.
          </p>
        </Alert>
      </div>,
    );
  }
}
void start();
