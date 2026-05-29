// src/utils/modals.ts
//
// Минимальный реестр модалок: открывая новую, закрываем все ранее открытые.
// Защищает от стека "Подписки недоступны" + "Поддержать тренера".

type Closer = () => void;

const closers = new Set<Closer>();
let escListenerAttached = false;

function ensureEscListener(): void {
  if (escListenerAttached) return;
  escListenerAttached = true;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && closers.size > 0) {
      closeAllModals();
    }
  });
}

export function registerModal(close: Closer): () => void {
  closers.add(close);
  ensureEscListener();
  return () => closers.delete(close);
}

export function closeAllModals(): void {
  closers.forEach(close => {
    try { close(); } catch { /* ignore */ }
  });
  closers.clear();
}
