import { TaskStatus } from "shared";
import { Chip, taskStatusLabels, taskStatusTokens } from "../shared/Chip";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tokens = taskStatusTokens[status];

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {taskStatusLabels[status]}
    </Chip>
  );
}
