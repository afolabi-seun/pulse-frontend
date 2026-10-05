import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, Download, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAllWikiPages, useWikiPage, downloadWikiPagePdf } from '../../api/wiki';
import PageHeader from '../../components/layout/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import WikiContent from '../../components/wiki/WikiContent';
import Button from '../../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** A wiki page on its own, read-only. Every signed-in user can open one — unlike the project's own Wiki tab,
 * which is for the project's members — unless its author restricted it to them. */
export default function WikiPageViewPage() {
  const { projectId, pageId } = useParams<{ projectId: string; pageId: string }>();
  const location = useLocation();
  const { allow } = useAuth();
  const { data: page, isLoading, error, refetch } = useWikiPage(projectId!, pageId!);
  const { data: index } = useAllWikiPages();
  const [downloading, setDownloading] = useState(false);

  const projectName = index?.find((e) => e.projectId === projectId)?.projectName;

  // A link can carry a heading anchor; the content renders once the page arrives, so scroll after that.
  useEffect(() => {
    if (!location.hash || !page) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [location.hash, page?.content]);

  if (isLoading) return <div className="max-w-3xl space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !page) return <ErrorState error={error} onRetry={refetch} />;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadWikiPagePdf(page.projectId, page.id, page.title);
    } catch {
      toast.error('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={page.title}
        breadcrumbs={[{ label: 'Wiki', href: '/wiki' }, ...(projectName ? [{ label: projectName }] : [])]}
        actions={(
          <>
            <Button size="sm" variant="ghost" loading={downloading} onClick={handleDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
            </Button>
            {allow('team-lead-or-above') && (
              <Link to={`/projects/${page.projectId}?wiki=${page.id}`} className="text-xs font-medium text-primary hover:underline">
                Open in project
              </Link>
            )}
          </>
        )}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
          <BookOpen className="h-4 w-4 text-primary" />
          <p className="flex-1 truncate text-sm font-semibold text-foreground">{projectName ?? 'Wiki page'}</p>
          {page.restrictedToMembers && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Lock className="h-3 w-3" /> Project members only
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {page.updatedAt
              ? `Updated ${new Date(page.updatedAt).toLocaleDateString()}`
              : `Created ${new Date(page.createdAt).toLocaleDateString()}`}
          </span>
        </div>
        <CardContent className="p-6">
          <div className="wiki-prose">
            <WikiContent content={page.content} projectId={page.projectId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
