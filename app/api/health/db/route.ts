import { NextResponse } from "next/server";
import { probeDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const probe = await probeDb();
    return NextResponse.json(probe);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
