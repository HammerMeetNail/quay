import React, {useEffect, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Button, ExpandableSection} from '@patternfly/react-core';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  TimesIcon,
} from '@patternfly/react-icons';
import {useSession} from '../app/Session';
import {parseRepositoryDetails, parseTags, repoPath} from '../lib/domain';
import {descriptionText} from '../lib/presentation';
import {
  RepositoryGlyph,
  StateMark,
  VisibilityMark,
} from '../components/DataPresentation';
import {Failure, LoadingRows} from '../components/Primitives';

export const RepositoryPreview: React.FC<{
  ns: string;
  repo: string;
  page: boolean;
  close: () => void;
  autoFocus?: boolean;
}> = ({ns, repo, page, close, autoFocus = true}) => {
  const {client} = useSession();
  const heading = useRef<HTMLHeadingElement>(null);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const details = useQuery({
    queryKey: ['repository', ns, repo],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'repository', namespace: ns, repository: repo},
        parseRepositoryDetails,
        signal,
      ),
  });
  const tags = useQuery({
    queryKey: ['tags', ns, repo, 1, ''],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'tags', namespace: ns, repository: repo, page: 1},
        parseTags,
        signal,
      ),
  });
  useEffect(() => {
    if (autoFocus) heading.current?.focus();
  }, [ns, repo, page, autoFocus]);
  const Heading = page ? 'h1' : 'h2';
  const fullRoute = `/repository/${repoPath(ns, repo)}`;
  return (
    <div
      className="qn-repository-preview qn-inspector"
      data-testid="repository-preview"
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          event.target === heading.current
        ) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="qn-inspector-header">
        <span className="qn-eyebrow">Repository preview</span>
        <Button
          variant={page ? 'link' : 'plain'}
          onClick={close}
          aria-label={
            page ? 'Back to repositories' : 'Close repository preview'
          }
          icon={
            page ? (
              <ArrowLeftIcon aria-hidden="true" />
            ) : (
              <TimesIcon aria-hidden="true" />
            )
          }
        >
          {page ? 'Back to repositories' : null}
        </Button>
      </div>
      <div className="qn-preview-identity">
        <RepositoryGlyph />
        <div>
          <p className="qn-secondary">{ns}</p>
          <Heading id="repository-preview-heading" ref={heading} tabIndex={-1}>
            {repo}
          </Heading>
        </div>
      </div>
      {details.isLoading ? (
        <LoadingRows />
      ) : details.isError ? (
        <Failure error={details.error} retry={() => void details.refetch()} />
      ) : (
        <>
          <div className="qn-tabs">
            <strong>Overview</strong>
            <Link to={fullRoute}>Tags &amp; artifacts</Link>
          </div>
          <div className="qn-overview-facts">
            <section className="qn-overview-card">
              <h3>Visibility</h3>
              <div className="qn-inline-metadata">
                <VisibilityMark value={details.data.visibility} />
                <StateMark state={details.data.state} />
              </div>
            </section>
            <section className="qn-overview-card">
              <h3>Your access</h3>
              <p>{details.data.access}</p>
            </section>
          </div>
          <p className="qn-about-text">
            {descriptionText(details.data.description) ||
              'No description provided.'}
          </p>
        </>
      )}
      <section className="qn-overview-card qn-quick-actions">
        <h3>Pull an exact image</h3>
        <p className="qn-secondary">
          Choose a tag to inspect its platforms and copy an immutable pull
          command.
        </p>
        <Link to={fullRoute} className="qn-main-link">
          Browse tags &amp; artifacts <ArrowRightIcon aria-hidden="true" />
        </Link>
      </section>
      <section className="qn-section" aria-labelledby="preview-tags-heading">
        <div className="qn-section-title">
          <h3 id="preview-tags-heading">Tags</h3>
          <Link to={fullRoute}>Browse all</Link>
        </div>
        <p className="qn-secondary">
          First entries from the registry’s current tag page.
        </p>
        {tags.isLoading ? (
          <p role="status">Loading tags…</p>
        ) : tags.isError ? (
          <Failure error={tags.error} retry={() => void tags.refetch()} />
        ) : !tags.data.tags.length ? (
          <p>No active tags returned.</p>
        ) : (
          <ul className="qn-preview-tags">
            {tags.data.tags.slice(0, 5).map((tag) => {
              const q = new URLSearchParams({
                artifact: tag.digest,
                tag: tag.name,
              });
              return (
                <li key={`${tag.name}-${tag.digest}`}>
                  <Link to={`${fullRoute}?${q}`}>{tag.name}</Link>
                  <span className="qn-secondary">
                    {tag.index ? 'Image index' : 'Manifest'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ExpandableSection
        toggleText="About this preview"
        isExpanded={aboutOpen}
        onToggle={(_, open) => setAboutOpen(open)}
      >
        {aboutOpen && (
          <div className="qn-section">
            <p>
              Repository visibility and your access are separate from image
              security. Scan reports belong to exact artifact digests.
            </p>
            <p>
              No default tag or pull command is selected on your behalf. Choose
              a tag before copying an immutable reference.
            </p>
            <p>
              This preview loads only this repository and its first tag page. It
              does not scan every image in the namespace.
            </p>
          </div>
        )}
      </ExpandableSection>
    </div>
  );
};
