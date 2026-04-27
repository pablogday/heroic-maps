/**
 * Tiny global toast store. No dependencies, no provider needed —
 * components subscribe to changes and `toast.*()` can be called from
 * anywhere on the client (event handlers, after server-action results,
 * etc).
 */

export type ToastKind = "info" | "success" | "error";

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after ms; 0 = sticky. */
  duration: number;
};

type Listener = (toasts: Toast[]) => void;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

function push(kind: ToastKind, message: string, duration = 3500) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message, duration }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  info: (message: string, duration?: number) => push("info", message, duration),
  success: (message: string, duration?: number) =>
    push("success", message, duration),
  error: (message: string, duration?: number) =>
    push("error", message, duration ?? 5000),
  dismiss,
};

/** Subscribe to toast changes. Returns an unsubscribe fn. */
export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  fn(toasts); // hydrate
  return () => listeners.delete(fn);
}
