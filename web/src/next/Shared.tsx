import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Alert, Button, Skeleton} from '@patternfly/react-core';

export const RequestState: React.FC<{loading: boolean; error: Error | null; retry: () => void}> = ({loading, error, retry}) => (
  <>
    {loading && <div className="qn-skeleton" aria-label="Loading registry data"><Skeleton width="75%" screenreaderText="Loading" /><Skeleton /><Skeleton /></div>}
    {error && <Alert isInline variant="danger" title={error.message}><Button variant="link" isInline onClick={retry}>Retry request</Button></Alert>}
  </>
);
export function useWorkspace() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 0, root: 16});
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (): void => {const style = getComputedStyle(element); setSize({width: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), root: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16});};
    const observer = new ResizeObserver(update);
    observer.observe(element); observer.observe(document.documentElement); update();
    return () => observer.disconnect();
  }, []);
  return {ref, ...size};
}
export function useNarrow(): boolean {
  const [value, setValue] = useState(() => window.matchMedia('(max-width: 48rem)').matches);
  useEffect(() => { const mq = window.matchMedia('(max-width: 48rem)'); const changed = (): void => setValue(mq.matches); mq.addEventListener('change', changed); return () => mq.removeEventListener('change', changed); }, []);
  return value;
}
export const CopyCommand: React.FC<{command: string; target: string}> = ({command, target}) => {
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setStatus(''); setFailed(false); return () => { generation.current++; }; }, [command]);
  const copy = async (): Promise<void> => {
    const operation = generation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(command);
      if (operation === generation.current) {setStatus(`Copied immutable pull command for ${target}.`); setFailed(false);}
    } catch {
      if (operation === generation.current) {setStatus('Clipboard access failed. Select and copy the complete command above.'); setFailed(true);}
    }
  };
  return <section className="qn-command" aria-label="Immutable pull command">
    <code className="qn-identifier" data-testid="artifact-immutable-command">{command}</code>
    <Button variant="primary" onClick={() => void copy()} data-testid="artifact-copy-immutable">Copy immutable pull command</Button>
    <p role="status" aria-live="polite">{!failed && status}</p>
    {failed && <Alert isInline variant="warning" title={status} />}
  </section>;
};
