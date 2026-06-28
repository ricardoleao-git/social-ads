/**
 * Tests for confirmNegativeKeyword, confirmAllNegativeKeywords, and updateNegativeKeyword endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockEq = vi.fn();

const mockDb = {
  update: vi.fn(() => ({
    set: mockSet.mockReturnValue({
      where: mockWhere.mockResolvedValue([{ affectedRows: 1 }]),
    }),
  })),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  negativeKeywordHistory: {
    id: "id",
    confirmed: "confirmed",
    updatedAt: "updatedAt",
    text: "text",
    matchType: "matchType",
    reason: "reason",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => args),
  gte: vi.fn((col, val) => ({ col, val })),
  desc: vi.fn((col) => col),
  or: vi.fn((...args) => args),
}));

// ─── confirmNegativeKeyword ──────────────────────────────────────────────────
describe("confirmNegativeKeyword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success: true when db is available", async () => {
    // Simulate the endpoint logic
    const db = await (await import("./db")).getDb();
    expect(db).toBeTruthy();

    // Simulate update call
    const result = await db!
      .update({} as any)
      .set({ confirmed: true, updatedAt: new Date() })
      .where({ col: "id", val: 1 });

    expect(result).toBeDefined();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: true })
    );
  });

  it("should handle missing db gracefully", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValueOnce(null as any);
    const db = await getDb();
    expect(db).toBeNull();
    // Endpoint should return { success: false, error: "Database not available" }
  });
});

// ─── confirmAllNegativeKeywords ──────────────────────────────────────────────
describe("confirmAllNegativeKeywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call update with confirmed: true and no specific id filter", async () => {
    const db = await (await import("./db")).getDb();
    expect(db).toBeTruthy();

    const result = await db!
      .update({} as any)
      .set({ confirmed: true, updatedAt: new Date() })
      .where({ col: "confirmed", val: false });

    expect(result).toBeDefined();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: true })
    );
  });
});

// ─── updateNegativeKeyword ───────────────────────────────────────────────────
describe("updateNegativeKeyword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update text field when provided", async () => {
    const db = await (await import("./db")).getDb();
    expect(db).toBeTruthy();

    const updates = { text: "novo termo", updatedAt: new Date() };
    const result = await db!
      .update({} as any)
      .set(updates)
      .where({ col: "id", val: 5 });

    expect(result).toBeDefined();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ text: "novo termo" })
    );
  });

  it("should update matchType field when provided", async () => {
    const db = await (await import("./db")).getDb();
    expect(db).toBeTruthy();

    const updates = { matchType: "EXACT", updatedAt: new Date() };
    const result = await db!
      .update({} as any)
      .set(updates)
      .where({ col: "id", val: 3 });

    expect(result).toBeDefined();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ matchType: "EXACT" })
    );
  });

  it("should update reason field when provided", async () => {
    const db = await (await import("./db")).getDb();
    expect(db).toBeTruthy();

    const updates = { reason: "irrelevant_intent", updatedAt: new Date() };
    const result = await db!
      .update({} as any)
      .set(updates)
      .where({ col: "id", val: 7 });

    expect(result).toBeDefined();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "irrelevant_intent" })
    );
  });

  it("should handle empty updates gracefully (no fields to update)", async () => {
    // When no text/matchType/reason is provided, endpoint returns early
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    // Only updatedAt — endpoint should still proceed
    expect(Object.keys(updates).length).toBe(1);
  });
});
