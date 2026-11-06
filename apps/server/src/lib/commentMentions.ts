const userMentionPattern = /\[[^\]]*\]\(mk:\/\/user\/([^)]+)\)/g;

export function extractUserMentionIds(content: string): string[] {
  const ids = new Set<string>();

  for (const match of content.matchAll(userMentionPattern)) {
    const userId = match[1]?.trim();

    if (userId) {
      ids.add(userId);
    }
  }

  return [...ids];
}

/** Usuários citados em `nextContent` que ainda não estavam citados em `previousContent`. */
export function findNewUserMentionIds(previousContent: string, nextContent: string): string[] {
  const previousIds = new Set(extractUserMentionIds(previousContent));

  return extractUserMentionIds(nextContent).filter((userId) => !previousIds.has(userId));
}
