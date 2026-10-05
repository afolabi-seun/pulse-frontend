import { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from './dialog';

/* ─── Imperative confirm hook ──────────────────────────────────────────────── */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setPending({ options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setPending(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setPending(null);
  };

  const dialog = pending ? (
    <ConfirmDialog
      open
      title={pending.options.title}
      description={pending.options.description}
      confirmLabel={pending.options.confirmLabel}
      variant={pending.options.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}

/* ─── Presentational component ─────────────────────────────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm',
  variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm" onInteractOutside={onCancel}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {variant === 'destructive' && (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            )}
            <div>
              <DialogTitle className="text-left">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5 text-left">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={variant === 'destructive' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
