import "server-only";

import { env, storageKind } from "../env";
import { DEMO_DRIVERS, defaultFleet } from "../fleet-defaults";
import { MemoryFleetRepository } from "./memory-repository";
import { connectMongoRepository } from "./mongo-repository";
import type { FleetRepository } from "./repository";

export type { FleetRepository } from "./repository";

const globalForRepo = globalThis as unknown as {
  __amgMemoryRepo?: MemoryFleetRepository;
  /** Depo başına tohumlama: yapılandırma değişip depo değişirse (bellek → Mongo) yenisi de tohumlanır. */
  __amgSeededRepos?: WeakMap<FleetRepository, Promise<void>>;
};

/**
 * Uygulamanın tek veri girişi. `MONGODB_URI` varsa MongoDB, yoksa bellek kullanılır.
 * İlk çağrıda filo (8 araç) tohumlanır; sonraki çağrılar hazır depoyu döner.
 */
export async function getRepository(): Promise<FleetRepository> {
  const repository = await openRepository();
  const seeded = (globalForRepo.__amgSeededRepos ??= new WeakMap());
  if (!seeded.has(repository)) {
    seeded.set(
      repository,
      seed(repository).catch((error: unknown) => {
        seeded.delete(repository); // bir sonraki istek yeniden denesin
        throw error;
      }),
    );
  }
  await seeded.get(repository);
  return repository;
}

async function openRepository(): Promise<FleetRepository> {
  if (storageKind === "mongodb") return connectMongoRepository(env.mongodbUri!, env.mongodbDb);
  // instanceof: `next dev` yeniden yüklemesinden kalan eski sınıf örneği kullanılmasın.
  if (!(globalForRepo.__amgMemoryRepo instanceof MemoryFleetRepository)) globalForRepo.__amgMemoryRepo = new MemoryFleetRepository();
  return globalForRepo.__amgMemoryRepo;
}

async function seed(repository: FleetRepository) {
  const wasEmpty = (await repository.listVehicles()).length === 0;
  await repository.seedVehicles(defaultFleet());
  if (!wasEmpty || !env.seedDemoDrivers) return;

  const startedAt = Date.now();
  const vehicles = await repository.listVehicles();
  await Promise.all(
    vehicles.map((vehicle, i) => {
      const driver = DEMO_DRIVERS[i];
      return driver ? repository.createSession({ vehicleId: vehicle.id, plate: vehicle.plate, driver, startedAt }) : null;
    }),
  );
}
