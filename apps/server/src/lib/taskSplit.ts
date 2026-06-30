const splitSuffixPattern = /\s+\[\d+\/\d+\]$/;

export interface TaskSplitPartInput {
  id: string;
  name: string;
  splitPartNumber: number | null;
  createdAt: Date;
}

export interface TaskSplitRename {
  id: string;
  previousName: string;
  name: string;
  partNumber: number;
  partTotal: number;
}

export interface TaskSplitPlan {
  baseName: string;
  insertedPartNumber: number;
  partTotal: number;
  renames: TaskSplitRename[];
}

export function splitBaseName(name: string): string {
  return name.replace(splitSuffixPattern, "").trim();
}

export function splitPartName(baseName: string, partNumber: number, partTotal: number): string {
  return `${baseName} [${partNumber}/${partTotal}]`;
}

export function buildTaskSplitPlan(
  existingParts: TaskSplitPartInput[],
  sourceTaskId: string,
  createdTaskId: string
): TaskSplitPlan {
  const orderedParts = existingParts
    .slice()
    .sort((left, right) => {
      const leftNumber = left.splitPartNumber ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = right.splitPartNumber ?? Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
      return createdDiff || left.id.localeCompare(right.id);
    });
  const sourceIndex = orderedParts.findIndex((part) => part.id === sourceTaskId);

  if (sourceIndex === -1) {
    throw new Error("Source task is not part of the split group");
  }

  const partTotal = orderedParts.length + 1;
  const insertedPartNumber = sourceIndex + 2;
  const baseName = splitBaseName(orderedParts[0]?.name ?? "");
  const insertedPart: TaskSplitPartInput = {
    id: createdTaskId,
    name: splitPartName(baseName, insertedPartNumber, partTotal),
    splitPartNumber: insertedPartNumber,
    createdAt: new Date(0)
  };
  const partsWithInsert = [
    ...orderedParts.slice(0, sourceIndex + 1),
    insertedPart,
    ...orderedParts.slice(sourceIndex + 1)
  ];

  return {
    baseName,
    insertedPartNumber,
    partTotal,
    renames: partsWithInsert.map((part, index) => {
      const partNumber = index + 1;
      return {
        id: part.id,
        previousName: part.name,
        name: splitPartName(baseName, partNumber, partTotal),
        partNumber,
        partTotal
      };
    })
  };
}
