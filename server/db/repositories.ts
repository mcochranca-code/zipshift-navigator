import { getDualDatabase, type DatabaseMode } from "./dualDatabase";

export type PwaPrototype = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  version: string;
  created_at: string;
  updated_at: string;
};

/** Example repository for the existing pwa_prototype.pwa_prototypes table. */
export class PwaPrototypeRepository {
  private readonly database = getDualDatabase();

  list(): Promise<PwaPrototype[]> {
    return this.database.query<PwaPrototype>("SELECT id, name, slug, description, status, version, created_at, updated_at FROM pwa_prototypes ORDER BY updated_at DESC", [], "pwa-prototypes:list");
  }

  getBySlug(slug: string): Promise<PwaPrototype | undefined> {
    return this.database.query<PwaPrototype>("SELECT id, name, slug, description, status, version, created_at, updated_at FROM pwa_prototypes WHERE slug = ? LIMIT 1", [slug], "pwa-prototypes:get").then((rows) => rows[0]);
  }

  runtime(): { mode: DatabaseMode; cockroachConfigured: boolean; legacyConfigured: boolean } {
    return { mode: this.database.mode, cockroachConfigured: this.database.hasCockroach, legacyConfigured: this.database.hasLegacy };
  }
}

export const pwaPrototypeRepository = new PwaPrototypeRepository();
