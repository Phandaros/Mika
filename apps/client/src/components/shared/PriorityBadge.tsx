import { Priority } from "shared";
import { Chip, priorityLabels, priorityTokens } from "./Chip";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tokens = priorityTokens[priority];

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {priorityLabels[priority]}
    </Chip>
  );
}
