import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "../helpers/test-db";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getCompletedFeedbackIds,
  markFeedbackCompleted,
  unmarkFeedbackCompleted,
} from "@/lib/feedback-completed";

describe("feedback-completed", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  describe("getCompletedFeedbackIds", () => {
    it("returns empty array when no items are completed", () => {
      expect(getCompletedFeedbackIds("app-1")).toEqual([]);
    });

    it("returns only IDs for the given app", () => {
      markFeedbackCompleted("fb-1", "app-1");
      markFeedbackCompleted("fb-2", "app-1");
      markFeedbackCompleted("fb-3", "app-2");

      expect(getCompletedFeedbackIds("app-1")).toEqual(["fb-1", "fb-2"]);
      expect(getCompletedFeedbackIds("app-2")).toEqual(["fb-3"]);
    });
  });

  describe("markFeedbackCompleted", () => {
    it("marks a feedback item as completed", () => {
      markFeedbackCompleted("fb-1", "app-1");
      expect(getCompletedFeedbackIds("app-1")).toEqual(["fb-1"]);
    });

    it("is idempotent – marking twice does not throw", () => {
      markFeedbackCompleted("fb-1", "app-1");
      markFeedbackCompleted("fb-1", "app-1");
      expect(getCompletedFeedbackIds("app-1")).toEqual(["fb-1"]);
    });
  });

  describe("unmarkFeedbackCompleted", () => {
    it("removes a completed feedback item", () => {
      markFeedbackCompleted("fb-1", "app-1");
      markFeedbackCompleted("fb-2", "app-1");
      unmarkFeedbackCompleted("fb-1");
      expect(getCompletedFeedbackIds("app-1")).toEqual(["fb-2"]);
    });

    it("is a no-op for a non-existent ID", () => {
      expect(() => unmarkFeedbackCompleted("nonexistent")).not.toThrow();
    });
  });
});
