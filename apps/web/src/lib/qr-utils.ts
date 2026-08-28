export function extractQrCode(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/q\/([A-Z0-9-]+)/i);
  if (match) return match[1].toUpperCase();
  if (/^[A-Z0-9-]{4,32}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
