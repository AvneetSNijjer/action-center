/**
 * Developer simulation role switcher.
 * Sets an HTTP-only cookie that the hotels API reads to filter visible hotels.
 * Only works when NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR=true.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR !== "true") {
    return NextResponse.json({ ok: false, error: "Simulation not enabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body.role === "customer" ? "customer" : "admin";
  const userId = String(body.userId ?? "");

  const cookieStore = cookies();
  cookieStore.set("sim_role", role, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
    sameSite: "lax",
  });
  cookieStore.set("sim_user_id", userId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true, role, userId });
}
