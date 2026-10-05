import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { useNavigate } from 'react-router-dom';
import { useAllWikiPages } from '../../api/wiki';
import type { WikiPageSummaryDto } from '../../types/api';

/** Strips a relative-path shape like "./api_standards.md" or "../Foo-Bar" down to a comparable
 * title: "api standards" / "foo bar". Wiki pages here are identified by ID, not by filename, so
 * a markdown link authored the way GitHub-wiki-style relative links usually are (pointing at a
 * page's title, dashed/underscored, optionally with a .md extension) has to be resolved by
 * matching against actual page titles rather than followed as a real path. */
function normalizeRef(raw: string): string {
  return raw
    .replace(/^\.*\/+/, '')
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Absolute URLs (http:, mailto:, etc.) are never internal wiki references — in-page anchors are
 * handled separately before this runs — only a bare/relative-looking href is worth trying to
 * resolve against a page title. */
function isLikelyInternalRef(href: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

interface WikiContentProps {
  content: string;
  /** The project this content is being viewed from — an unqualified link resolves here first. */
  projectId: string;
  /** The current project's own page list, already loaded by the caller — checked before the
   * org-wide index so the common case (linking a sibling page) never waits on an extra fetch. */
  currentProjectPages?: WikiPageSummaryDto[];
}

export default function WikiContent({ content, projectId, currentProjectPages }: WikiContentProps) {
  const navigate = useNavigate();
  const { data: allPages } = useAllWikiPages();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={{
        a: ({ href, children, ...props }) => {
          const raw = href ?? '';

          if (raw.startsWith('#')) {
            const targetId = raw.slice(1);
            return (
              <a
                href={raw}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                {...props}
              >
                {children}
              </a>
            );
          }

          if (!isLikelyInternalRef(raw)) {
            return <a href={raw} target="_blank" rel="noreferrer" {...props}>{children}</a>;
          }

          // A link can combine a page reference with a heading anchor on that page, e.g.
          // "./project_architecture.md#service-internal-layering" — resolve the page from the
          // part before '#' and carry the fragment through to the destination URL so the target
          // page can scroll to it once loaded (see ProjectDetailPage's hash-scroll effect).
          const hashIndex = raw.indexOf('#');
          const pathPart  = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
          const fragment  = hashIndex === -1 ? '' : raw.slice(hashIndex + 1);

          const normalized = normalizeRef(pathPart);
          const inProject = currentProjectPages?.find((p) => p.title.trim().toLowerCase() === normalized);
          const inAnyProject = !inProject
            ? allPages?.find((p) => p.pageTitle.trim().toLowerCase() === normalized)
            : undefined;

          const target = inProject
            ? { projectId, pageId: inProject.id, otherProject: false }
            : inAnyProject
              ? { projectId: inAnyProject.projectId, pageId: inAnyProject.pageId, otherProject: true }
              : null;

          if (target) {
            // A page in another project opens in the standalone wiki viewer: wiki pages are readable by
            // everyone, but the reader may not be a member of that project, whose own page would refuse them.
            const base = target.otherProject
              ? `/wiki/${target.projectId}/${target.pageId}`
              : `/projects/${target.projectId}?wiki=${target.pageId}`;
            const url = `${base}${fragment ? `#${fragment}` : ''}`;
            return (
              <a href={url} onClick={(e) => { e.preventDefault(); navigate(url); }} {...props}>
                {children}
              </a>
            );
          }

          // Looks like a reference to another wiki page (relative path, often ".md") but nothing
          // matches its title — flag it rather than silently letting the browser 404 on click.
          const looksLikeWikiRef = pathPart.startsWith('.') || /\.md$/i.test(pathPart);
          if (looksLikeWikiRef) {
            return (
              <a
                href={raw}
                title={`No wiki page found matching "${raw}"`}
                className="text-muted-foreground underline decoration-dashed decoration-1 underline-offset-2 cursor-help"
                onClick={(e) => e.preventDefault()}
                {...props}
              >
                {children}
              </a>
            );
          }

          return <a href={raw} {...props}>{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
