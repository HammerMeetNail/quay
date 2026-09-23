import {useLayoutEffect, useRef, useState} from 'react';
import {shouldUseInspector} from '../lib/operations';
export function useWorkspaceWidth(forcePage = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = (): void =>
      setInline(
        shouldUseInspector(
          node.clientWidth,
          parseFloat(getComputedStyle(document.documentElement).fontSize),
          forcePage,
        ),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(document.documentElement);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [forcePage]);
  return {ref, inline};
}
