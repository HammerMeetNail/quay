import React, {useEffect, useState} from 'react';
import {Alert, Button, Skeleton} from '@patternfly/react-core';
import {errorMessage} from '../lib/client';
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = (): void => setMatch(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return match;
}
export const LoadingRows: React.FC = () => (
  <div className="qn-loading" role="status" aria-label="Loading registry data">
    {Array.from({length: 8}, (_, i) => (
      <Skeleton
        key={i}
        height="2.5rem"
        screenreaderText={i === 0 ? 'Loading registry data' : undefined}
      />
    ))}
  </div>
);
export const Failure: React.FC<{
  error: unknown;
  retry?: () => void;
}> = ({error, retry}) => (
  <Alert title="Request could not be completed" variant="danger" isInline>
    <p>{errorMessage(error)}</p>
    {retry && (
      <Button variant="secondary" onClick={retry}>
        Retry request
      </Button>
    )}
  </Alert>
);
export const Empty: React.FC<{
  title: string;
  children?: React.ReactNode;
}> = ({title, children}) => (
  <section className="qn-empty">
    <h2>{title}</h2>
    {children}
  </section>
);
export const PageControls: React.FC<{
  label: string;
  previous: () => void;
  next: () => void;
  canPrevious: boolean;
  canNext: boolean;
  busy: boolean;
}> = (props) => (
  <div className="qn-pagination">
    <span>{props.label}</span>
    <div className="qn-actions">
      <Button
        variant="secondary"
        onClick={props.previous}
        isDisabled={!props.canPrevious || props.busy}
      >
        Previous
      </Button>
      <Button
        variant="secondary"
        onClick={props.next}
        isDisabled={!props.canNext || props.busy}
      >
        Next
      </Button>
    </div>
  </div>
);
