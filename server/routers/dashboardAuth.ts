import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db";
import { dashboardUsers, dashboardSessions, passwordResetTokens, activityLogs } from "../../drizzle/schema";

async function logActivity(db: any, opts: {
  userId?: number;
  userEmail?: string;
  action: string;
  description?: string;
  targetEmail?: string;
  ipAddress?: string;
  statusCode?: number;
  metadata?: string;
}) {
  try {
    await db.insert(activityLogs).values({
      userId: opts.userId ?? null,
      userEmail: opts.userEmail ?? null,
      action: opts.action,
      description: opts.description ?? null,
      targetEmail: opts.targetEmail ?? null,
      ipAddress: opts.ipAddress ?? null,
      statusCode: opts.statusCode ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.error("[activityLog] Failed to write log:", e);
  }
}
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString("hex");
}

function sessionExpiry(rememberMe: boolean): Date {
  const d = new Date();
  d.setDate(d.getDate() + (rememberMe ? 30 : 1));
  return d;
}

async function getUserFromCookie(req: any) {
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
  return users[0] ?? null;
}

// ─── Dashboard Auth Router ───────────────────────────────────────────────────

export const dashboardAuthRouter = router({
  /** Login with email + password */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        rememberMe: z.boolean().default(false),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const found = await db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.email, input.email.toLowerCase()))
        .limit(1);

      if (!found[0] || !found[0].active) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
      }

      const valid = await bcrypt.compare(input.password, found[0].passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
      }

      const token = generateToken();
      const expiresAt = sessionExpiry(input.rememberMe);

      await db.insert(dashboardSessions).values({
        userId: found[0].id,
        token,
        expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      await db
        .update(dashboardUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(dashboardUsers.id, found[0].id));

      const maxAge = input.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
      const isProduction = process.env.NODE_ENV === "production";
      (ctx as any).res?.cookie("dash_session", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAge * 1000, // express uses milliseconds
        secure: isProduction,
      });

      return {
        success: true,
        user: {
          id: found[0].id,
          name: found[0].name,
          email: found[0].email,
          role: found[0].role,
        },
      };
    }),

  /** Get current logged-in dashboard user */
  me: publicProcedure.query(async ({ ctx }) => {
    const user = await getUserFromCookie((ctx as any).req);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
    };
  }),

  /** Logout — invalidate session cookie */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = (ctx as any).req?.cookies?.["dash_session"];
    if (token) {
      const db = await getDb();
      if (db) await db.delete(dashboardSessions).where(eq(dashboardSessions.token, token));
    }
    (ctx as any).res?.clearCookie("dash_session", { path: "/" });
    return { success: true };
  }),

  /** Change own password (must know current password) */
  changePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string().min(6),
        newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserFromCookie((ctx as any).req);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado." });

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const hash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(dashboardUsers)
        .set({ passwordHash: hash })
        .where(eq(dashboardUsers.id, user.id));

      return { success: true };
    }),

  /** Upload avatar image (base64) */
  uploadAvatar: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(), // data:image/...;base64,...
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserFromCookie((ctx as any).req);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "N\u00e3o autenticado." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Decodificar base64 e fazer upload para S3
      const base64Data = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem muito grande. M\u00e1ximo 2MB." });
      }

      const { storagePut } = await import("../storage");
      const key = `avatars/user-${user.id}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await db
        .update(dashboardUsers)
        .set({ avatarUrl: url })
        .where(eq(dashboardUsers.id, user.id));

      return { success: true, avatarUrl: url };
    }),

  /** Update own profile (name) */
  updateProfile: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres.").max(80),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserFromCookie((ctx as any).req);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "N\u00e3o autenticado." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(dashboardUsers)
        .set({ name: input.name.trim() })
        .where(eq(dashboardUsers.id, user.id));

      return { success: true, name: input.name.trim() };
    }),

  /** Request password reset */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: true };

      const found = await db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.email, input.email.toLowerCase()))
        .limit(1);

      if (!found[0]) return { success: true };

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: found[0].id,
        token,
        expiresAt,
      });

      return { success: true, resetToken: token };
    }),

  /** Reset password using token */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      const records = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, input.token),
            gt(passwordResetTokens.expiresAt, now)
          )
        )
        .limit(1);

      if (!records[0] || records[0].usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido ou expirado." });
      }

      const hash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(dashboardUsers)
        .set({ passwordHash: hash })
        .where(eq(dashboardUsers.id, records[0].userId));

      await db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, records[0].id));

      return { success: true };
    }),
});

// ─── Dashboard Users Admin Router ────────────────────────────────────────────

export const dashboardUsersRouter = router({
  /** List all users (admin only) */
  list: publicProcedure.query(async ({ ctx }) => {
    const currentUser = await getUserFromCookie((ctx as any).req);
    if (!currentUser || currentUser.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
    }
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: dashboardUsers.id,
        name: dashboardUsers.name,
        email: dashboardUsers.email,
        role: dashboardUsers.role,
        active: dashboardUsers.active,
        createdAt: dashboardUsers.createdAt,
        lastLoginAt: dashboardUsers.lastLoginAt,
      })
      .from(dashboardUsers)
      .orderBy(dashboardUsers.createdAt);
  }),

  /** Create a new user (admin only) */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["admin", "viewer"]).default("viewer"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const currentUser = await getUserFromCookie((ctx as any).req);
      if (!currentUser || currentUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.email, input.email.toLowerCase()))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado." });
      }

      const hash = await bcrypt.hash(input.password, 12);
      await db.insert(dashboardUsers).values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: hash,
        role: input.role,
        active: 1,
      });

      await logActivity(db, {
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: "create_user",
        description: `Usuário criado: ${input.name} (${input.email}) com papel ${input.role}.`,
        targetEmail: input.email.toLowerCase(),
        statusCode: 200,
      });

      return { success: true };
    }),

  /** Update user (admin only) */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "viewer"]).optional(),
        active: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const currentUser = await getUserFromCookie((ctx as any).req);
      if (!currentUser || currentUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...updates } = input;
      if (Object.keys(updates).length === 0) return { success: true };

      await db.update(dashboardUsers).set(updates).where(eq(dashboardUsers.id, id));

      const target = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, id)).limit(1);
      await logActivity(db, {
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: "update_user",
        description: `Usuário atualizado: ${target[0]?.email ?? id}. Campos: ${Object.keys(updates).join(", ")}.`,
        targetEmail: target[0]?.email,
        statusCode: 200,
      });

      return { success: true };
    }),

  /** Force reset user password (admin only) */
  resetUserPassword: publicProcedure
    .input(z.object({ id: z.number(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const currentUser = await getUserFromCookie((ctx as any).req);
      if (!currentUser || currentUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const hash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(dashboardUsers)
        .set({ passwordHash: hash })
        .where(eq(dashboardUsers.id, input.id));

      const target2 = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, input.id)).limit(1);
      await logActivity(db, {
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: "reset_password",
        description: `Senha redefinida para: ${target2[0]?.email ?? input.id}.`,
        targetEmail: target2[0]?.email,
        statusCode: 200,
      });

      return { success: true };
    }),

  /** Delete user (admin only, cannot delete self) */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const currentUser = await getUserFromCookie((ctx as any).req);
      if (!currentUser || currentUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      if (currentUser.id === input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const target3 = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, input.id)).limit(1);
      await db.delete(dashboardSessions).where(eq(dashboardSessions.userId, input.id));
      await db.delete(dashboardUsers).where(eq(dashboardUsers.id, input.id));

      await logActivity(db, {
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: "delete_user",
        description: `Usuário excluído: ${target3[0]?.email ?? input.id}.`,
        targetEmail: target3[0]?.email,
        statusCode: 200,
      });

      return { success: true };
    }),

  /** List activity logs (admin only) */
  listActivityLogs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input, ctx }) => {
      const currentUser = await getUserFromCookie((ctx as any).req);
      if (!currentUser || currentUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(activityLogs)
        .orderBy(activityLogs.createdAt)
        .limit(input.limit);
    }),
});
