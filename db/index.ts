import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results?: T[];
    success?: boolean;
    meta?: { changes?: number };
  }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown>;
};

export type ObjectStoreObjectLike = {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpMetadata?: { contentType?: string };
};

export type ObjectStoreLike = {
  get(key: string): Promise<ObjectStoreObjectLike | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};

export type RuntimeBindings = {
  DB?: D1DatabaseLike;
  EVIDENCE?: ObjectStoreLike;
  ADMIN_ALLOWLIST?: string;
};

let runtimeBindings: RuntimeBindings | null = null;

/** Called by the Worker entry point once for every request. */
export function setRuntimeBindings(bindings: RuntimeBindings): void {
  runtimeBindings = bindings;
}

export function getRuntimeBindings(): RuntimeBindings {
  if (!runtimeBindings) {
    throw new Error(
      "Cloudflare runtime bindings are unavailable. Shared governance routes must run through the Site Worker entry point.",
    );
  }
  return runtimeBindings;
}

export function getD1(): D1DatabaseLike {
  const database = getRuntimeBindings().DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Deploy the generated D1 migration and configure the logical DB binding before using shared governance data.",
    );
  }
  return database;
}

export function getObjectStore(): ObjectStoreLike {
  const objectStore = getRuntimeBindings().EVIDENCE;
  if (!objectStore) {
    throw new Error(
      "Cloudflare R2 binding `EVIDENCE` is unavailable. Configure the logical EVIDENCE binding before storing shared branding or retained evidence.",
    );
  }
  return objectStore;
}

export function getDb() {
  return drizzle(getD1() as never, { schema });
}
