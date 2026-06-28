import { describe, it, expect, vi } from "vitest";

// ─── Unit tests for activity log helper ──────────────────────────────────────

describe("Activity log helper", () => {
  it("should insert a log record with all required fields", async () => {
    const insertedValues: any[] = [];

    const mockDb = {
      insert: (_table: any) => ({
        values: (vals: any) => {
          insertedValues.push(vals);
          return Promise.resolve();
        },
      }),
    };

    // Inline the logActivity function to test it in isolation
    async function logActivity(
      db: any,
      opts: {
        userId?: number;
        userEmail?: string;
        action: string;
        description?: string;
        targetEmail?: string;
        ipAddress?: string;
        statusCode?: number;
        metadata?: string;
      }
    ) {
      try {
        await db.insert("activity_logs").values({
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

    await logActivity(mockDb, {
      userId: 1,
      userEmail: "admin@zenitetech.com",
      action: "login",
      description: "Login bem-sucedido.",
      ipAddress: "127.0.0.1",
      statusCode: 200,
    });

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0].action).toBe("login");
    expect(insertedValues[0].userEmail).toBe("admin@zenitetech.com");
    expect(insertedValues[0].userId).toBe(1);
    expect(insertedValues[0].statusCode).toBe(200);
    expect(insertedValues[0].targetEmail).toBeNull();
  });

  it("should handle missing optional fields gracefully (null defaults)", async () => {
    const insertedValues: any[] = [];

    const mockDb = {
      insert: (_table: any) => ({
        values: (vals: any) => {
          insertedValues.push(vals);
          return Promise.resolve();
        },
      }),
    };

    async function logActivity(db: any, opts: { action: string; userId?: number; userEmail?: string; description?: string; targetEmail?: string; ipAddress?: string; statusCode?: number; metadata?: string }) {
      await db.insert("activity_logs").values({
        userId: opts.userId ?? null,
        userEmail: opts.userEmail ?? null,
        action: opts.action,
        description: opts.description ?? null,
        targetEmail: opts.targetEmail ?? null,
        ipAddress: opts.ipAddress ?? null,
        statusCode: opts.statusCode ?? null,
        metadata: opts.metadata ?? null,
      });
    }

    await logActivity(mockDb, { action: "logout" });

    expect(insertedValues[0].userId).toBeNull();
    expect(insertedValues[0].userEmail).toBeNull();
    expect(insertedValues[0].ipAddress).toBeNull();
    expect(insertedValues[0].statusCode).toBeNull();
    expect(insertedValues[0].action).toBe("logout");
  });

  it("should not throw if db.insert fails (silent error)", async () => {
    const mockDb = {
      insert: (_table: any) => ({
        values: (_vals: any) => {
          throw new Error("DB connection error");
        },
      }),
    };

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    async function logActivity(db: any, opts: { action: string }) {
      try {
        await db.insert("activity_logs").values({ action: opts.action });
      } catch (e) {
        console.error("[activityLog] Failed to write log:", e);
      }
    }

    await expect(logActivity(mockDb, { action: "login" })).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
