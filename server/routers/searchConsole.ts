/**
 * tRPC Router: Search Console
 * Exposes Google Search Console data via tRPC procedures
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getPerformanceSummary,
  getClickTrend,
  getTopQueries,
  getTopPages,
  getPeriodComparison,
  type DeviceFilter,
} from "../searchConsoleService";

const deviceSchema = z.enum(["ALL", "DESKTOP", "MOBILE", "TABLET"]).optional().default("ALL");

export const searchConsoleRouter = router({
  /**
   * Performance summary (total clicks, impressions, CTR, position)
   * Supports device filter: ALL | DESKTOP | MOBILE | TABLET
   */
  getPerformanceSummary: publicProcedure
    .input(z.object({
      days: z.number().optional().default(28),
      device: deviceSchema,
    }))
    .query(async ({ input }) => {
      return getPerformanceSummary(input.days, input.device as DeviceFilter);
    }),

  /**
   * Daily click trend over time
   */
  getClickTrend: publicProcedure
    .input(z.object({
      days: z.number().optional().default(28),
      device: deviceSchema,
    }))
    .query(async ({ input }) => {
      return getClickTrend(input.days, input.device as DeviceFilter);
    }),

  /**
   * Top search queries by clicks
   */
  getTopQueries: publicProcedure
    .input(z.object({
      days: z.number().optional().default(28),
      limit: z.number().optional().default(10),
      device: deviceSchema,
    }))
    .query(async ({ input }) => {
      return getTopQueries(input.days, input.limit, input.device as DeviceFilter);
    }),

  /**
   * Top pages by clicks
   */
  getTopPages: publicProcedure
    .input(z.object({
      days: z.number().optional().default(28),
      limit: z.number().optional().default(10),
      device: deviceSchema,
    }))
    .query(async ({ input }) => {
      return getTopPages(input.days, input.limit, input.device as DeviceFilter);
    }),

  /**
   * Compare current period vs previous period (same duration)
   */
  getPeriodComparison: publicProcedure
    .input(z.object({
      days: z.number().optional().default(28),
      device: deviceSchema,
    }))
    .query(async ({ input }) => {
      return getPeriodComparison(input.days, input.device as DeviceFilter);
    }),
});
