import { stripProjectPrefix } from "./workloadTaskLabel";

export function reviewTaskDisplayTitle(title: string, projectName: string): string {
  const withoutReviewPrefix = title.replace(/^\s*\[REV\]\s*/i, "");
  return stripProjectPrefix(withoutReviewPrefix, projectName);
}
