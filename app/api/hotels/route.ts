import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listHotels } from "@/lib/queries/hotels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withKpis = searchParams.get("withKpis") === "true";

    // Role-based access control.
    // Priority: simulation cookie (set by /api/sim/role) > env var DEMO_USER_ROLE > default admin
    const cookieStore = cookies();
    const cookieRole = cookieStore.get("sim_role")?.value;
    const cookieUserId = cookieStore.get("sim_user_id")?.value;
    const role = cookieRole ?? process.env.DEMO_USER_ROLE ?? "admin";
    const isSuperuser = role === "admin";

    let hotels;
    if (isSuperuser) {
      hotels = await listHotels(undefined, true);
    } else {
      // Cookie takes priority over env var for simulation user ID
      const rawId = cookieUserId || process.env.DEMO_SIMULATE_USER_ID;
      const simulatedUserId = rawId ? parseInt(rawId, 10) : undefined;
      if (!simulatedUserId || isNaN(simulatedUserId)) {
        return NextResponse.json({
          ok: true,
          data: [],
          meta: { role, reason: "No DEMO_SIMULATE_USER_ID set" },
        });
      }
      hotels = await listHotels(simulatedUserId, false);
    }

    // Role-sensitive — must not be cached by the browser.  The cookies that
    // control which hotels are visible can change at any time (sim toolbar).
    // Server-side deduplication is handled by the cached() wrapper in listHotels.
    // "no-store" prevents the browser from returning stale admin data after
    // switching to a customer simulation (even across a full page reload).
    const CC = { "Cache-Control": "no-store" };

    if (!withKpis) {
      const slim = hotels.map(({ id, name, city, state, location, pendingApprovals }) => ({
        id, name, city, state, location, pendingApprovals,
      }));
      return NextResponse.json({ ok: true, data: slim, meta: { role, total: slim.length } }, { headers: CC });
    }

    return NextResponse.json({ ok: true, data: hotels, meta: { role, total: hotels.length } }, { headers: CC });
  } catch (err) {
    console.error("[GET /api/hotels]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
