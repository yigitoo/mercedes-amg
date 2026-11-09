import { validateDriver } from "@/domain/validation";
import { adminJsonRoute, str, ValidationFailure } from "@/server/admin-api";
import { assignDriver } from "@/server/services/fleet-service";

/**
 * POST /api/admin/drivers — araca sürücü ata (varsa önceki sürüş kapanır). Admin panelindeki "Sürücü ata" ile aynı iş.
 *   { "vehicleId": "v6", "firstName": "Defne", "lastName": "Arıkan", "startedAt"?: epoch ms }
 */
export async function POST(request: Request) {
  return adminJsonRoute(request, "assign-driver", async (body) => {
    const driver = validateDriver({ firstName: str(body, "firstName"), lastName: str(body, "lastName") });
    if (!driver.ok) throw new ValidationFailure(driver.errors);
    const startedAt = typeof body.startedAt === "number" ? body.startedAt : Date.now();
    const session = await assignDriver(str(body, "vehicleId"), driver.value, startedAt);
    return { sessionId: session.id, startedAt: session.startedAt };
  });
}
