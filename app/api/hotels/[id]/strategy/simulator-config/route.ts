import { NextResponse } from "next/server";
import { getSimulatorConfig } from "@/lib/queries/strategy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await getSimulatorConfig(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[strategy/simulator-config]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
