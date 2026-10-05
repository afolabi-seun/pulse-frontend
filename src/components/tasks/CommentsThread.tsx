import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useComments, useAddComment, useEditComment, useDeleteComment } from '../../api/comments';
import { Card } from '@/components/ui/card';
import MentionTextarea, { type MentionCandidate } from '@/components/ui/MentionTextarea';
import Button from '../ui/Button';
import { formatRelative } from '../../lib/dates';
import type { CommentDto } from '../../types/api';

export default function CommentsThread({ taskId, currentUserId, canModerate, engineers }: {
  taskId: string; currentUserId: string; canModerate: boolean;
  /** Candidate pool for @mention autocomplete — project members, so every commenter (not just
   * PM+) gets the correct, full list of people who can actually see this task. */
  engineers?: MentionCandidate[];
}) {
  const [open, setOpen]           = useState(false);
  const [newBody, setNewBody]     = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody]   = useState('');

  const { data: comments = [] } = useComments(taskId);
  const addComment    = useAddComment(taskId);
  const editComment   = useEditComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const handleAdd = () => {
    const body = newBody.trim();
    if (!body) return;
    addComment.mutate(body, {
      onSuccess: () => { toast.success('Comment added.'); setNewBody(''); },
      onError:   (e) => toast.error((e as Error).message ?? 'Failed to add comment.'),
    });
  };

  const handleEdit = (c: CommentDto) => {
    const body = editBody.trim();
    if (!body) return;
    editComment.mutate({ commentId: c.id, body }, {
      onSuccess: () => { toast.success('Comment updated.'); setEditingId(null); },
      onError:   (e) => toast.error((e as Error).message ?? 'Failed to update comment.'),
    });
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId, {
      onError: (e) => toast.error((e as Error).message ?? 'Failed to delete comment.'),
    });
  };

  return (
    <Card className="mt-4 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Comments
          {comments.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {comments.length}
            </span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          {/* Thread */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((c) => {
                const isAuthor = c.authorId === currentUserId;
                const canEdit  = isAuthor;
                const canDel   = isAuthor || canModerate;
                return (
                  <div key={c.id} className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{c.authorName}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(c.createdAt)}{c.editedAt ? ' (edited)' : ''}
                        </span>
                        {canEdit && editingId !== c.id && (
                          <button
                            onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDel && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deleteComment.isPending}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === c.id ? (
                      <div className="space-y-2">
                        <MentionTextarea
                          rows={3}
                          value={editBody}
                          onChange={setEditBody}
                          engineers={engineers}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleEdit(c)} loading={editComment.isPending}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-foreground">{c.body}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}

          {/* New comment box */}
          <div className="space-y-2 pt-1 border-t border-border">
            <MentionTextarea
              rows={3}
              placeholder="Write a comment… (@ to mention someone)"
              value={newBody}
              onChange={setNewBody}
              engineers={engineers}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              loading={addComment.isPending}
              disabled={!newBody.trim()}
            >
              Add comment
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
