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
