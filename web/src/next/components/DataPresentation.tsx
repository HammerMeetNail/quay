import React, {useId, useState} from 'react';
import {Button} from '@patternfly/react-core';
import {
  AppleIcon,
  CubeIcon,
  GlobeIcon,
  LinuxIcon,
  LockIcon,
  ServerIcon,
  StarIcon,
  WindowsIcon,
} from '@patternfly/react-icons';
import {bytesLabel, dateLabel, type Manifest} from '../lib/domain';
import {
  platformLabels,
  relativeTime,
  repositoryState,
  timestamp,
} from '../lib/presentation';

export const RepositoryGlyph: React.FC = () => (
  <span className="qn-repo-glyph">
    <CubeIcon aria-hidden="true" />
  </span>
);
export const VisibilityMark: React.FC<{value: string}> = ({value}) => {
  const kind =
    value === 'Public' ? 'public' : value === 'Private' ? 'private' : 'unknown';
  return (
    <span
      className={`qn-visibility qn-visibility--${kind}`}
      data-testid="visibility-mark"
    >
      {kind === 'public' ? (
        <GlobeIcon aria-hidden="true" />
      ) : kind === 'private' ? (
        <LockIcon aria-hidden="true" />
      ) : null}
      <span>{kind === 'unknown' ? 'Visibility not reported' : value}</span>
    </span>
  );
};
export const StarredMark: React.FC<{starred: boolean | null}> = ({starred}) =>
  starred === true ? (
    <span
      className="qn-starred"
      role="img"
      aria-label="Starred repository"
      title="Starred repository"
    >
      <StarIcon aria-hidden="true" />
    </span>
  ) : null;
export const StateMark: React.FC<{state: string}> = ({state}) => {
  const label = repositoryState(state);
  return label ? <span className="qn-state">{label}</span> : null;
};
export const UpdatedAt: React.FC<{value: string | number | null}> = ({
  value,
}) => {
  const ms = timestamp(value);
  return ms === null ? (
    <span className="qn-secondary">Not reported</span>
  ) : (
    <time
      dateTime={new Date(ms).toISOString()}
      title={dateLabel(value)}
      className="qn-updated"
    >
      <span aria-hidden="true">{relativeTime(value)}</span>
      <span className="qn-sr-only">{dateLabel(value)}</span>
    </time>
  );
};
export const DownloadSize: React.FC<{
  bytes: number | null;
  index?: boolean;
}> = ({bytes, index = false}) => {
  const label = bytesLabel(bytes);
  const split = /^(\S+) (\S+)$/.exec(label);
  return (
    <span className="qn-download-size">
      {index ? (
        <>
          <strong>Per platform</strong>
          <small>Select a pull target</small>
        </>
      ) : split && bytes !== null && Number.isFinite(bytes) && bytes >= 0 ? (
        <>
          <span>
            <strong>{split[1]}</strong> <span>{split[2]}</span>
          </span>
          <small>Compressed layers</small>
        </>
      ) : (
        <span className="qn-secondary">Size not reported</span>
      )}
    </span>
  );
};
const PlatformIcon: React.FC<{label: string}> = ({label}) => {
  const os = label.split('/')[0]?.toLowerCase() ?? '';
  const Icon =
    os === 'linux'
      ? LinuxIcon
      : os === 'windows'
        ? WindowsIcon
        : os === 'darwin'
          ? AppleIcon
          : ServerIcon;
  return (
    <span className="qn-platform-icon" data-platform-os={os} aria-hidden="true">
      <Icon />
    </span>
  );
};
export const PlatformList: React.FC<{
  manifest?: Manifest;
  index: boolean;
  loading?: boolean;
  failed?: boolean;
}> = ({manifest, index, loading = false, failed = false}) => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const labels = platformLabels(manifest);
  if (failed)
    return <span className="qn-secondary">Platform data unavailable</span>;
  if (loading) return <span className="qn-secondary">Loading platforms…</span>;
  if (!labels.length)
    return (
      <span className="qn-secondary">
        {index && !manifest
          ? 'Platform details pending'
          : 'Platform not reported'}
      </span>
    );
  return (
    <div className="qn-platform-summary">
      <ul
        id={id}
        aria-label="Advertised platforms"
        className="qn-platform-chips"
      >
        {(expanded ? labels : labels.slice(0, 2)).map((label) => (
          <li key={label}>
            <PlatformIcon label={label} />
            <code>{label}</code>
          </li>
        ))}
      </ul>
      {labels.length > 2 && (
        <Button
          type="button"
          variant="link"
          isInline
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `+${labels.length - 2} more platforms`}
        </Button>
      )}
    </div>
  );
};
