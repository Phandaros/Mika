import { describe, expect, it } from "vitest";
import { initializeAssigneeSelection } from "./multiSelectFilter";

describe("initializeAssigneeSelection", () => {
  it("aplica todos os responsaveis quando o filtro ainda nao foi inicializado", () => {
    expect(initializeAssigneeSelection(undefined, ["user-1", "user-2"])).toEqual(["none", "user-1", "user-2"]);
  });

  it("preserva selecao manual vazia depois que o filtro foi inicializado", () => {
    expect(initializeAssigneeSelection([], ["user-1", "user-2"])).toEqual([]);
  });

  it("preserva selecao manual parcial depois que o filtro foi inicializado", () => {
    expect(initializeAssigneeSelection(["user-2"], ["user-1", "user-2"])).toEqual(["user-2"]);
  });
});
