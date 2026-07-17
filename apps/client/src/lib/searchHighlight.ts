export interface SearchHighlightRange {
  start: number;
  end: number;
}

export function findNormalizedMatchRange(value: string, term: string): SearchHighlightRange | null {
  const normalizedValue = normalizeWithMap(value);
  const normalizedTerm = normalizeSearchText(term);
  const normalizedStart = normalizedValue.text.indexOf(normalizedTerm);

  if (!normalizedTerm || normalizedStart < 0) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedTerm.length - 1;
  return {
    start: normalizedValue.startMap[normalizedStart] ?? 0,
    end: normalizedValue.endMap[normalizedEnd] ?? value.length
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeWithMap(value: string): { text: string; startMap: number[]; endMap: number[] } {
  let text = "";
  let sourceOffset = 0;
  const startMap: number[] = [];
  const endMap: number[] = [];

  for (const sourceCharacter of Array.from(value)) {
    const normalizedCharacter = sourceCharacter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lettersAndNumbers = normalizedCharacter.match(/[\p{L}\p{N}]/gu)?.join("").toLowerCase() ?? "";

    if (lettersAndNumbers) {
      for (const character of Array.from(lettersAndNumbers)) {
        text += character;
        startMap.push(sourceOffset);
        endMap.push(sourceOffset + sourceCharacter.length);
      }
    } else if (text && !text.endsWith(" ")) {
      text += " ";
      startMap.push(sourceOffset);
      endMap.push(sourceOffset + sourceCharacter.length);
    }

    sourceOffset += sourceCharacter.length;
  }

  while (text.endsWith(" ")) {
    text = text.slice(0, -1);
    startMap.pop();
    endMap.pop();
  }

  return { text, startMap, endMap };
}
