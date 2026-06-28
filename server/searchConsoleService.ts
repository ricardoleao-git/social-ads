/**
 * Google Search Console API Service
 * Uses REST API with google-auth-library JWT auth
 * Service Account: ga4-analytics-reader@manus-g-ads.iam.gserviceaccount.com
 * Property: sc-domain:zenitetech.com
 */
import { JWT } from "google-auth-library";
import { ENV } from "./_core/env";

const SITE_URL = "sc-domain:zenitetech.com";
const SC_API = "https://searchconsole.googleapis.com/webmasters/v3/sites";

export type DeviceFilter = "ALL" | "DESKTOP" | "MOBILE" | "TABLET";

function getJwtClient(): JWT {
  const credJson = ENV.ga4ServiceAccountJson;
  if (!credJson) throw new Error("GA4_SERVICE_ACCOUNT_JSON not set");

  const creds = JSON.parse(credJson) as {
    client_email: string;
    private_key: string;
  };

  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

interface ScQueryBody {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  orderBy?: Array<{ fieldName: string; sortOrder: string }>;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: string;
      operator: string;
      expression: string;
    }>;
  }>;
}

async function scQuery(body: ScQueryBody): Promise<{ rows?: SearchConsoleApiRow[] }> {
  const jwt = getJwtClient();
  const token = await jwt.getAccessToken();
  const accessToken = token.token;

  const encodedSite = encodeURIComponent(SITE_URL);
  const url = `${SC_API}/${encodedSite}/searchAnalytics/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search Console API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ rows?: SearchConsoleApiRow[] }>;
}

interface SearchConsoleApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function buildDeviceFilter(device: DeviceFilter): ScQueryBody["dimensionFilterGroups"] | undefined {
  if (device === "ALL") return undefined;
  return [
    {
      filters: [
        {
          dimension: "device",
          operator: "equals",
          expression: device.toLowerCase(),
        },
      ],
    },
  ];
}

export interface PerformanceSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  isReal: boolean;
  period: string;
  device: DeviceFilter;
}

export interface ClickTrendPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PeriodComparison {
  current: ClickTrendPoint[];
  previous: ClickTrendPoint[];
  isReal: boolean;
}

export async function getPerformanceSummary(
  days = 28,
  device: DeviceFilter = "ALL"
): Promise<PerformanceSummary> {
  try {
    const { startDate, endDate } = getDateRange(days);
    const body: ScQueryBody = { startDate, endDate, dimensions: [], rowLimit: 1 };
    const deviceFilters = buildDeviceFilter(device);
    if (deviceFilters) body.dimensionFilterGroups = deviceFilters;

    const data = await scQuery(body);

    if (!data.rows || data.rows.length === 0) {
      return { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0, isReal: true, period: `${days}d`, device };
    }

    const row = data.rows[0];
    return {
      totalClicks: row.clicks ?? 0,
      totalImpressions: row.impressions ?? 0,
      avgCtr: row.ctr ?? 0,
      avgPosition: row.position ?? 0,
      isReal: true,
      period: `${days}d`,
      device,
    };
  } catch (err: unknown) {
    console.error("[SearchConsole] getPerformanceSummary error:", err);
    return { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0, isReal: false, period: `${days}d`, device };
  }
}

export async function getClickTrend(
  days = 28,
  device: DeviceFilter = "ALL"
): Promise<{ data: ClickTrendPoint[]; isReal: boolean }> {
  try {
    const { startDate, endDate } = getDateRange(days);
    const body: ScQueryBody = { startDate, endDate, dimensions: ["date"], rowLimit: 90 };
    const deviceFilters = buildDeviceFilter(device);
    if (deviceFilters) body.dimensionFilterGroups = deviceFilters;

    const data = await scQuery(body);
    const rows = data.rows ?? [];
    const trend: ClickTrendPoint[] = rows.map((r) => ({
      date: (r.keys?.[0] ?? "").slice(5), // MM-DD
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    }));

    return { data: trend, isReal: true };
  } catch (err: unknown) {
    console.error("[SearchConsole] getClickTrend error:", err);
    return { data: [], isReal: false };
  }
}

export async function getTopQueries(
  days = 28,
  limit = 10,
  device: DeviceFilter = "ALL"
): Promise<{ data: QueryRow[]; isReal: boolean }> {
  try {
    const { startDate, endDate } = getDateRange(days);
    const body: ScQueryBody = {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    };
    const deviceFilters = buildDeviceFilter(device);
    if (deviceFilters) body.dimensionFilterGroups = deviceFilters;

    const data = await scQuery(body);
    const rows = data.rows ?? [];
    const result: QueryRow[] = rows.map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));

    return { data: result, isReal: true };
  } catch (err: unknown) {
    console.error("[SearchConsole] getTopQueries error:", err);
    return { data: [], isReal: false };
  }
}

export async function getTopPages(
  days = 28,
  limit = 10,
  device: DeviceFilter = "ALL"
): Promise<{ data: PageRow[]; isReal: boolean }> {
  try {
    const { startDate, endDate } = getDateRange(days);
    const body: ScQueryBody = {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    };
    const deviceFilters = buildDeviceFilter(device);
    if (deviceFilters) body.dimensionFilterGroups = deviceFilters;

    const data = await scQuery(body);
    const rows = data.rows ?? [];
    const result: PageRow[] = rows.map((r) => ({
      page: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));

    return { data: result, isReal: true };
  } catch (err: unknown) {
    console.error("[SearchConsole] getTopPages error:", err);
    return { data: [], isReal: false };
  }
}

/**
 * Compare two periods: current (last N days) vs previous (N days before that)
 */
export async function getPeriodComparison(
  days = 28,
  device: DeviceFilter = "ALL"
): Promise<PeriodComparison> {
  try {
    const endCurrent = new Date();
    const startCurrent = new Date();
    startCurrent.setDate(startCurrent.getDate() - days);

    const endPrevious = new Date(startCurrent);
    endPrevious.setDate(endPrevious.getDate() - 1);
    const startPrevious = new Date(endPrevious);
    startPrevious.setDate(startPrevious.getDate() - days + 1);

    const deviceFilters = buildDeviceFilter(device);

    const bodyCurrentBase: ScQueryBody = {
      startDate: formatDate(startCurrent),
      endDate: formatDate(endCurrent),
      dimensions: ["date"],
      rowLimit: 90,
    };
    if (deviceFilters) bodyCurrentBase.dimensionFilterGroups = deviceFilters;

    const bodyPreviousBase: ScQueryBody = {
      startDate: formatDate(startPrevious),
      endDate: formatDate(endPrevious),
      dimensions: ["date"],
      rowLimit: 90,
    };
    if (deviceFilters) bodyPreviousBase.dimensionFilterGroups = deviceFilters;

    const [currentData, previousData] = await Promise.all([
      scQuery(bodyCurrentBase),
      scQuery(bodyPreviousBase),
    ]);

    const mapRows = (rows: SearchConsoleApiRow[]): ClickTrendPoint[] =>
      rows.map((r) => ({
        date: (r.keys?.[0] ?? "").slice(5),
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      }));

    return {
      current: mapRows(currentData.rows ?? []),
      previous: mapRows(previousData.rows ?? []),
      isReal: true,
    };
  } catch (err: unknown) {
    console.error("[SearchConsole] getPeriodComparison error:", err);
    return { current: [], previous: [], isReal: false };
  }
}
