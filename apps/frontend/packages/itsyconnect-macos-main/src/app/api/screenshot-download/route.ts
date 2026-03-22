import { NextResponse } from "next/server";

const ALLOWED_HOST = "is1-ssl.mzstatic.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") ?? "screenshot.png";

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only allow Apple CDN URLs
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== ALLOWED_HOST) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") ?? "image/png";

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
