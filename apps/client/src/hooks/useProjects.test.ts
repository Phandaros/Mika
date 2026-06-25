import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({
  api: {}
}));
vi.mock("../lib/queryClient", () => ({
  queryClient: {}
}));

import {
  buildPortfolioQueryParams,
  portfolioProjectsQueryKey,
  type PortfolioProjectsFilters
} from "./useProjects";

describe("portfolio project query helpers", () => {
  const filters: PortfolioProjectsFilters = {
    sort: "updatedAt-desc",
    status: ["ACTIVE"],
    platform: ["CAD"],
    builder: ["Construtora Sul"],
    query: "  Atlântico  ",
    customFieldFilters: [
      {
        fieldKey: "disciplinas",
        type: "multi_enum",
        operator: "containsAny",
        values: ["Sprinkler"]
      }
    ]
  };

  it("envia o filtro textual como q junto dos demais filtros", () => {
    expect(buildPortfolioQueryParams(filters, "cursor-1")).toEqual({
      cursor: "cursor-1",
      sort: "updatedAt-desc",
      status: ["ACTIVE"],
      platform: ["CAD"],
      builder: ["Construtora Sul"],
      q: "Atlântico",
      customFieldFilters: JSON.stringify(filters.customFieldFilters)
    });
  });

  it("omite q quando o texto contém apenas espaços", () => {
    expect(
      buildPortfolioQueryParams({
        sort: "name-asc",
        query: "   "
      })
    ).toEqual({
      cursor: undefined,
      sort: "name-asc"
    });
  });

  it("inclui o texto do filtro na query key", () => {
    expect(portfolioProjectsQueryKey(filters)).toEqual([
      "projects",
      "portfolio",
      filters
    ]);
  });
});
