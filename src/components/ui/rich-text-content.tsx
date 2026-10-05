import { cn } from '@/lib/utils';

interface RichTextContentProps {
  html: string;
  className?: string;
}

/**
 * Read-only render of description HTML. Safe to use dangerouslySetInnerHTML here — the backend
 * sanitizes every write path (DescriptionSanitizer) to a small formatting allowlist before this
 * content is ever persisted, so nothing reaching this component can carry a script or handler.
 */
export function RichTextContent({ html, className }: RichTextContentProps) {
  return (
    <div
      className={cn(
        'prose-sm max-w-none text-sm text-foreground',
        '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
        '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
        '[&_a]:text-primary [&_a]:underline',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
