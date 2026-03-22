import { db } from "@/db";
import { feedbackCompleted } from "@/db/schema";
import { eq } from "drizzle-orm";

export function getCompletedFeedbackIds(appId: string): string[] {
  const rows = db
    .select({ feedbackId: feedbackCompleted.feedbackId })
    .from(feedbackCompleted)
    .where(eq(feedbackCompleted.appId, appId))
    .all();

  return rows.map((r) => r.feedbackId);
}

export function markFeedbackCompleted(feedbackId: string, appId: string): void {
  db.insert(feedbackCompleted)
    .values({ feedbackId, appId })
    .onConflictDoNothing()
    .run();
}

export function unmarkFeedbackCompleted(feedbackId: string): void {
  db.delete(feedbackCompleted)
    .where(eq(feedbackCompleted.feedbackId, feedbackId))
    .run();
}
