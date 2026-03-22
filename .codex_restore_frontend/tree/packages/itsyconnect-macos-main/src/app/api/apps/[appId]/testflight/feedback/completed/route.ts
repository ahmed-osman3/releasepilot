import { NextResponse } from "next/server";
import {
  markFeedbackCompleted,
  unmarkFeedbackCompleted,
} from "@/lib/feedback-completed";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const { feedbackId } = (await request.json()) as { feedbackId: string };

  if (!feedbackId) {
    return NextResponse.json({ error: "feedbackId is required" }, { status: 400 });
  }

  markFeedbackCompleted(feedbackId, appId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
) {
  const { feedbackId } = (await request.json()) as { feedbackId: string };

  if (!feedbackId) {
    return NextResponse.json({ error: "feedbackId is required" }, { status: 400 });
  }

  unmarkFeedbackCompleted(feedbackId);
  return NextResponse.json({ ok: true });
}
