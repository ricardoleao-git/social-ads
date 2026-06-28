import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "./db";
import { dashboardUsers, dashboardSessions, activityLogs, passwordResetTokens } from "../drizzle/schema";
import {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
} from "./credentials";

// Rate limiter: máximo 3 tentativas por IP a cada 60 minutos
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas tentativas. Tente novamente em 1 hora." },
});

// ─── Gmail Send Helper ─────────────────────────────────────────────────────
async function sendResetEmail(toEmail: string, resetUrl: string, userName: string): Promise<void> {
  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_ADS_CLIENT_ID,
        client_secret: GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenResp.json() as any;
    if (!tokenData.access_token) {
      console.error("[sendResetEmail] Falha ao obter access token:", JSON.stringify(tokenData));
      return;
    }
    const subject = "Redefinição de senha — Dashboard Zênite Tech";
    const body = [
      `Olá, ${userName}!`,
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta no Dashboard Zênite Tech.",
      "",
      "Clique no link abaixo para criar uma nova senha (válido por 2 horas):",
      "",
      resetUrl,
      "",
      "Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.",
      "",
      "— Equipe Zênite Tech",
    ].join("\n");
    const emailLines = [
      `From: Dashboard Zênite Tech <rjll70@gmail.com>`,
      `To: ${toEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      "",
      Buffer.from(body).toString("base64"),
    ].join("\r\n");
    const encoded = Buffer.from(emailLines)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const sendResp = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encoded }),
      }
    );
    const sendData = await sendResp.json() as any;
    if (sendData.id) {
      console.log(`[sendResetEmail] E-mail enviado para ${toEmail} — messageId: ${sendData.id}`);
    } else {
      console.error("[sendResetEmail] Falha no envio:", JSON.stringify(sendData));
    }
  } catch (err) {
    console.error("[sendResetEmail] Erro:", err);
  }
}

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

const authRouter = Router();

function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString("hex");
}

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "E-mail e senha são obrigatórios." });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ success: false, message: "Banco de dados indisponível." });
    }

    const found = await db
      .select()
      .from(dashboardUsers)
      .where(eq(dashboardUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!found[0] || !found[0].active) {
      return res.status(401).json({ success: false, message: "E-mail ou senha inválidos." });
    }

    const valid = await bcrypt.compare(password, found[0].passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "E-mail ou senha inválidos." });
    }

    const token = generateToken();
    const maxAgeDays = rememberMe ? 30 : 1;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + maxAgeDays);

    await db.insert(dashboardSessions).values({
      userId: found[0].id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await db
      .update(dashboardUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(dashboardUsers.id, found[0].id));

    await logActivity(db, {
      userId: found[0].id,
      userEmail: found[0].email,
      action: "login",
      description: `Login bem-sucedido${rememberMe ? " (lembrar por 30 dias)" : ""}.`,
      ipAddress: req.ip,
      statusCode: 200,
    });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("dash_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
      secure: isProduction,
    });

    return res.json({
      success: true,
      user: {
        id: found[0].id,
        name: found[0].name,
        email: found[0].email,
        role: found[0].role,
      },
    });
  } catch (err: any) {
    console.error("[auth/login] Error:", err);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
});

// POST /api/auth/logout
authRouter.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.["dash_session"];
    if (token) {
      const db = await getDb();
      if (db) {
        // Find user before deleting session
        const sess = await db.select().from(dashboardSessions).where(eq(dashboardSessions.token, token)).limit(1);
        await db.delete(dashboardSessions).where(eq(dashboardSessions.token, token));
        if (sess[0]) {
          const usr = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, sess[0].userId)).limit(1);
          await logActivity(db, {
            userId: sess[0].userId,
            userEmail: usr[0]?.email,
            action: "logout",
            description: "Logout realizado.",
            ipAddress: req.ip,
            statusCode: 200,
          });
        }
      }
    }
    res.clearCookie("dash_session", { path: "/" });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[auth/logout] Error:", err);
    return res.status(500).json({ success: false, message: "Erro interno." });
  }
});

// GET /api/auth/me
authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.["dash_session"];
    if (!token) return res.json({ user: null });

    const db = await getDb();
    if (!db) return res.json({ user: null });

    const now = new Date();
    const sessions = await db
      .select()
      .from(dashboardSessions)
      .where(and(eq(dashboardSessions.token, token), gt(dashboardSessions.expiresAt, now)))
      .limit(1);

    if (!sessions[0]) return res.json({ user: null });

    const users = await db
      .select()
      .from(dashboardUsers)
      .where(and(eq(dashboardUsers.id, sessions[0].userId), eq(dashboardUsers.active, 1)))
      .limit(1);

    if (!users[0]) return res.json({ user: null });

    return res.json({
      user: {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role,
      },
    });
  } catch (err: any) {
    console.error("[auth/me] Error:", err);
    return res.json({ user: null });
  }
});

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "E-mail é obrigatório." });
    }
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "Banco de dados indisponível." });

    const found = await db
      .select()
      .from(dashboardUsers)
      .where(eq(dashboardUsers.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to avoid email enumeration
    if (!found[0] || !found[0].active) {
      return res.json({ success: true, message: "Se o e-mail existir, você receberá as instruções." });
    }

    const token = generateToken(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await db.insert(passwordResetTokens).values({
      userId: found[0].id,
      token,
      expiresAt,
    });

    await logActivity(db, {
      userId: found[0].id,
      userEmail: found[0].email,
      action: "password_reset_requested",
      description: "Solicitação de reset de senha",
      ipAddress: req.ip,
      statusCode: 200,
    });

    const origin = req.headers.origin || "http://localhost:3000";
    const resetUrl = `${origin}/reset-password?token=${token}`;
    console.log(`[auth/forgot-password] Reset URL for ${found[0].email}: ${resetUrl}`);

    // Enviar e-mail real via Gmail API (não bloqueia a resposta)
    sendResetEmail(found[0].email, resetUrl, found[0].name).catch((err) =>
      console.error("[auth/forgot-password] sendResetEmail failed:", err)
    );

    return res.json({
      success: true,
      message: "Se o e-mail existir, você receberá as instruções.",
      ...(process.env.NODE_ENV !== "production" ? { resetUrl } : {}),
    });
  } catch (err: any) {
    console.error("[auth/forgot-password] Error:", err);
    return res.status(500).json({ success: false, message: "Erro interno." });
  }
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token e nova senha são obrigatórios." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "A senha deve ter pelo menos 8 caracteres." });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "Banco de dados indisponível." });

    const now = new Date();
    const records = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, now)))
      .limit(1);

    if (!records[0]) {
      return res.status(400).json({ success: false, message: "Token inválido ou expirado." });
    }
    if (records[0].usedAt) {
      return res.status(400).json({ success: false, message: "Este token já foi utilizado." });
    }

    const hash = await bcrypt.hash(password, 12);

    await db
      .update(dashboardUsers)
      .set({ passwordHash: hash, updatedAt: now })
      .where(eq(dashboardUsers.id, records[0].userId));

    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, records[0].id));

    await logActivity(db, {
      userId: records[0].userId,
      action: "password_reset_completed",
      description: "Senha redefinida via token",
      ipAddress: req.ip,
      statusCode: 200,
    });

    return res.json({ success: true, message: "Senha redefinida com sucesso. Faça login." });
  } catch (err: any) {
    console.error("[auth/reset-password] Error:", err);
    return res.status(500).json({ success: false, message: "Erro interno." });
  }
});

export { authRouter };
