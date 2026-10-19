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

type SessionRow = {
  id: string;
  expires_at: number;
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  specialist_role: string | null;
};

type UserRow = SessionRow & { password_hash: string };

type ClientProfileRow = {
  phone: string | null;
  city: string | null;
  language: string | null;
  accessibility_json: string | null;
};

export type DirectoryRow = {
  id: string;
  source_id: string;
  name: string;
  category: string;
  city: string;
  zip: string | null;
  canonical_provider_id: string | null;
  address: string | null;
  phone: string | null;
  verified: boolean | number;
  hsai_score: number | null;
  transit_burden: string | null;
  required_docs_json: string | null;
  latitude: number | null;
  longitude: number | null;
  intake_notes: string | null;
  access_outcome: string | null;
  service_notes: string | null;
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

export class AuthRepository {
  private readonly database = getDualDatabase();

  async getSession(sessionId: string, currentTime: number): Promise<SessionRow | undefined> {
    const rows = await this.database.query<SessionRow>(
      `SELECT s.id, s.expires_at, u.id AS user_id, u.email, u.display_name, u.role, u.specialist_role
       FROM app_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ? AND u.is_active = TRUE`,
      [sessionId, currentTime],
      "auth:session",
    );
    return rows[0];
  }

  async getActiveUserByEmail(email: string): Promise<UserRow | undefined> {
    const rows = await this.database.query<UserRow>("SELECT * FROM app_users WHERE email = ? AND is_active = TRUE LIMIT 1", [email], "auth:user-by-email");
    return rows[0];
  }
}

export class ClientProfileRepository {
  private readonly database = getDualDatabase();

  async getByUserId(userId: string): Promise<ClientProfileRow | undefined> {
    const rows = await this.database.query<ClientProfileRow>("SELECT phone, city, language, accessibility_json FROM client_profiles WHERE user_id = ?", [userId], "profile:get");
    return rows[0];
  }
}

export class DirectoryRepository {
  private readonly database = getDualDatabase();

  async search(filters: { search?: string; city?: string; category?: string }): Promise<DirectoryRow[]> {
    const clauses = ["1 = 1"];
    const params: unknown[] = [];
    if (filters.search) {
      clauses.push("(name LIKE ? OR category LIKE ? OR city LIKE ? OR address LIKE ?)");
      const like = `%${filters.search}%`;
      params.push(like, like, like, like);
    }
    if (filters.city) { clauses.push("city = ?"); params.push(filters.city); }
    if (filters.category) { clauses.push("category = ?"); params.push(filters.category); }
    return this.database.query<DirectoryRow>(`SELECT * FROM directory_resources WHERE ${clauses.join(" AND ")} ORDER BY city, name`, params, "directory:search");
  }
}

export const pwaPrototypeRepository = new PwaPrototypeRepository();
export const authRepository = new AuthRepository();
export const clientProfileRepository = new ClientProfileRepository();
export const directoryRepository = new DirectoryRepository();
