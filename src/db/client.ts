import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Defer error to actual use; allows builds without env in CI-less local checks.
  console.warn("[db] DATABASE_URL is not set");
}

declare global {
  // eslint-disable-next-line no-var
  var __pg_client__: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__pg_client__ ??
  postgres(connectionString ?? "postgres://invalid", {
    prepare: false,
    max: 5,
  });
if (process.env.NODE_ENV !== "production") global.__pg_client__ = client;

export const db = drizzle(client, { schema });
