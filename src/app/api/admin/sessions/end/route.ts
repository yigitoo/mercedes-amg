import { adminJsonRoute, str } from "@/server/admin-api";
import { endActiveSession } from "@/server/services/fleet-service";

/** POST /api/admin/sessions/end — araçtaki sürüşü bitir. { "vehicleId": "v6" } */
export async function POST(request: Request) {
  return adminJsonRoute(request, "end-session", (body) => endActiveSession(str(body, "vehicleId")));
}
