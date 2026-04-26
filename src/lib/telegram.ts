export function normalizeTelegramValue(value: string) {
  return value.trim();
}

export function getTelegramUrl(value?: string) {
  const trimmed = normalizeTelegramValue(value ?? "");
  if (!trimmed) return null;

  if (/^tg:\/\//i.test(trimmed)) return trimmed;

  const telegramLinkMatch = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/([A-Za-z0-9_]{5,32})(?:[/?#].*)?$/i,
  );
  if (telegramLinkMatch) {
    return `https://t.me/${telegramLinkMatch[1]}`;
  }

  const username = trimmed.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    return `https://t.me/${username}`;
  }

  return null;
}
