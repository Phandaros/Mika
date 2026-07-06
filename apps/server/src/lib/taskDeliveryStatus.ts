import { DeliveryStatus, type DeliveryStatus as DeliveryStatusValue } from "./enums.js";

export function taskDeliveryStatus(task: {
  completed: boolean;
  estimatedDays?: number | null;
  estimatedTime?: number | null;
  conclusionDays?: number | null;
}): DeliveryStatusValue | null {
  if (!task.completed) {
    return null;
  }

  const estimated = task.estimatedDays ?? task.estimatedTime ?? null;
  const conclusion = task.conclusionDays ?? null;

  if (estimated == null || conclusion == null) {
    return DeliveryStatus.UNCLASSIFIED;
  }

  if (conclusion > estimated) {
    return DeliveryStatus.LATE;
  }

  if (conclusion < estimated) {
    return DeliveryStatus.EARLY;
  }

  return DeliveryStatus.ON_TIME;
}

export function deliveryStatusIsOnTime(status: DeliveryStatusValue | null): boolean {
  return status === DeliveryStatus.EARLY || status === DeliveryStatus.ON_TIME;
}
