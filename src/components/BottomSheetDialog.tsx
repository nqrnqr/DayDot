import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface BottomSheetDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accentColor?: string;
  headerRight?: ReactNode;
  bodyStyle?: React.CSSProperties;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Native <dialog> bottom-sheet modal with light-dismiss (`closedby="any"` + fallback),
 * CSS scroll containment (`overscroll-behavior: contain`), and flush bottom alignment.
 */
export function BottomSheetDialog({
  open,
  onClose,
  title,
  subtitle,
  accentColor,
  headerRight,
  bodyStyle,
  footer,
  children,
}: BottomSheetDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    const handleClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const insideContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!insideContent) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      className="daydot-dialog"
    >
      <div
        className="flex h-full w-full items-end justify-center sm:items-center sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dialogRef.current?.close();
          }
        }}
      >
        <div
          ref={contentRef}
          className="animate-sheet-up flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[var(--bg-surface)] shadow-2xl sm:rounded-[28px]"
        >
          {/* Subtle drag indicator */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="h-1 w-9 rounded-full bg-[var(--border-color)]" />
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {accentColor && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden="true"
                  />
                )}
                <h2
                  id={titleId}
                  className="truncate text-[17px] font-semibold tracking-tight text-[var(--fg-primary)]"
                >
                  {title}
                </h2>
              </div>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {headerRight}
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="关闭弹窗"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle-hover)] active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            style={bodyStyle}
            className={`no-scrollbar flex-1 overflow-y-auto px-4 py-4 ${footer ? '' : 'pb-safe'}`}
          >
            {children}
          </div>

          {footer && (
            <div className="pb-safe border-t border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 pt-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
