import { describe, expect, it } from "vitest";
import { DeliveryStatus } from "./enums.js";
import { taskDeliveryStatus } from "./taskDeliveryStatus.js";

describe("taskDeliveryStatus", () => {
  it("classifies completed tasks by estimated and conclusion days", () => {
    expect(taskDeliveryStatus({ completed: true, estimatedDays: 3, conclusionDays: 4 })).toBe(DeliveryStatus.LATE);
    expect(taskDeliveryStatus({ completed: true, estimatedDays: 3, conclusionDays: 2 })).toBe(DeliveryStatus.EARLY);
    expect(taskDeliveryStatus({ completed: true, estimatedDays: 3, conclusionDays: 3 })).toBe(DeliveryStatus.ON_TIME);
  });

  it("keeps completed tasks without both day fields unclassified", () => {
    expect(taskDeliveryStatus({ completed: true, estimatedDays: null, conclusionDays: 3 })).toBe(DeliveryStatus.UNCLASSIFIED);
    expect(taskDeliveryStatus({ completed: true, estimatedDays: 3, conclusionDays: null })).toBe(DeliveryStatus.UNCLASSIFIED);
  });

  it("does not classify open tasks even when day fields are filled", () => {
    expect(taskDeliveryStatus({ completed: false, estimatedDays: 3, conclusionDays: 4 })).toBeNull();
  });

  it("uses estimatedTime as a compatibility fallback", () => {
    expect(taskDeliveryStatus({ completed: true, estimatedDays: null, estimatedTime: 5, conclusionDays: 3 })).toBe(DeliveryStatus.EARLY);
  });
});
