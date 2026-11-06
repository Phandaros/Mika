const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Completa o protocolo e recusa endereços que o navegador não deve abrir a partir de um comentário. */
export function normalizeLinkHref(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? withProtocol : null;
  } catch {
    return null;
  }
}
