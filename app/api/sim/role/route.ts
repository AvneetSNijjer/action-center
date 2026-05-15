/**
 * Developer simulation role switcher.
 * Sets an HTTP-only cookie that the hotels API reads to filter visible hotels.
 * Only works when NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR=true.
 *
 * Cookies are set directly on the NextResponse object — using cookies().set()
 * from next/headers in a Route Handler does NOT reliably attach Set-Cookie
 * headers to the response in Next.js 14. Setting them on the NextResponse
 * instance is the only guaranteed way to get them into the browser.
 *
 * Also flushes the server-side query cache so the hotels list reflects the new
 * role immediately — without this the cached() wrapper would return stale admin
 * data for up to 5 minutes after switching to a customer simulation.
 */
import { NextResponse } from "next/server";
import { invalidateCache } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  path: "/",
  maxAge: 60 * 60 * 24, // 24h
  sameSite: "lax" as const,
};

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR !== "true") {
    return NextResponse.json({ ok: false, error: "Simulation not enabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body.role === "customer" ? "customer" : "admin";
  const userId = String(body.userId ?? "");

  // Flush cached hotel lists so the next request reflects the new role / user.
  // Without this the in-process cache would serve stale data for up to 5 minutes.
  invalidateCache("listHotels");

  // CRITICAL: Set cookies on the NextResponse instance, NOT via cookies().set().
  // In Next.js 14 Route Handlers, cookies().set() from next/headers does not
  // reliably produce Set-Cookie headers on the outgoing response.
  const res = NextResponse.json({ ok: true, role, userId });
  res.cookies.set("sim_role", role, COOKIE_OPTS);
  res.cookies.set("sim_user_id", userId, COOKIE_OPTS);
  return res;
}
