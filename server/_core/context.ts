import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { dashboardUsers, dashboardSessions } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Authenticate via dash_session cookie (own login system).
 * Returns a User-compatible object from dashboardUsers table.
 */
async function authenticateViaDashSession(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const token = req?.cookies?.["dash_session"];
    if (!token) return null;

    const db = await getDb();
    if (!db) return null;

    const now = new Date();
    const sessions = await db
      .select()
      .from(dashboardSessions)
      .where(and(eq(dashboardSessions.token, token), gt(dashboardSessions.expiresAt, now)))
      .limit(1);

    if (!sessions[0]) return null;

    const users = await db
      .select()
      .from(dashboardUsers)
      .where(and(eq(dashboardUsers.id, sessions[0].userId), eq(dashboardUsers.active, 1)))
      .limit(1);

    const dashUser = users[0];
    if (!dashUser) return null;

    // Map dashboardUser to User type (compatible shape for protectedProcedure)
    return {
      id: dashUser.id,
      openId: `dash_${dashUser.id}`,
      name: dashUser.name ?? null,
      email: dashUser.email ?? null,
      loginMethod: "dashboard",
      role: dashUser.role === "admin" ? "admin" : "user",
      createdAt: dashUser.createdAt ?? new Date(),
      updatedAt: dashUser.updatedAt ?? new Date(),
      lastSignedIn: dashUser.lastLoginAt ?? new Date(),
    } as User;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try dash_session first (own login system — independent of Manus)
  user = await authenticateViaDashSession(opts.req);

  // 2. Fallback to Manus OAuth (for backward compatibility)
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
