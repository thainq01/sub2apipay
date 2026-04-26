export type PayMessage =
  | { type: 'pay:ready' }
  | { type: 'pay:resize'; height: number }
  | { type: 'pay:navigate'; path: string }
  | { type: 'pay:complete'; orderId: string; status: string }
  | { type: 'pay:close' };

let allowedOrigins: string[] | null = null;

function getAllowedOrigins(): string[] {
  if (allowedOrigins !== null) return allowedOrigins;
  const raw = process.env.NEXT_PUBLIC_IFRAME_ALLOW_ORIGINS || process.env.IFRAME_ALLOW_ORIGINS || '';
  allowedOrigins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowedOrigins;
}

export function postMessageToParent(msg: PayMessage): void {
  if (typeof window === 'undefined') return;

  try {
    if (window.self === window.top) return;
  } catch {
    // Cross-origin — we are in an iframe
  }

  const origins = getAllowedOrigins();
  if (origins.length === 0) {
    // If no origins configured, send to any parent (less secure but functional)
    window.parent.postMessage(msg, '*');
    return;
  }

  for (const origin of origins) {
    window.parent.postMessage(msg, origin);
  }
}
