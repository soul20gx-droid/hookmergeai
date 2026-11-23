import { withRoute, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AdminLicenseRow, AdminStats } from "@/lib/types";
import { licenseToView, type LicenseRow } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - offsetDays * 24 * 60 * 60 * 1000;
}

export const GET = withRoute(async () => {
  await requireAdmin();
  const db = getDb();
  const now = Date.now();

  const licenseRows = db.prepare("SELECT * FROM licenses").all() as LicenseRow[];
  const active = licenseRows.filter((l) => l.status === "active" && !(l.expires_at && l.expires_at <= now));
  const revoked = licenseRows.filter((l) => l.status === "revoked");
  const expired = licenseRows.filter(
    (l) => l.status === "active" && l.expires_at != null && l.expires_at <= now,
  );
  const expiringSoon = active.filter(
    (l) => l.expires_at != null && l.expires_at > now && l.expires_at <= now + 7 * 24 * 60 * 60 * 1000,
  );

  const count = (sql: string, ...args: (string | number)[]) => {
    const row = db.prepare(sql).get(...args) as { c: number };
    return row.c;
  };

  const providers = db
    .prepare("SELECT provider, COUNT(*) as count FROM scripts GROUP BY provider ORDER BY count DESC LIMIT 6")
    .all() as { provider: string; count: number }[];

  const dailyRows = db
    .prepare(
      "SELECT CAST(created_at / 86400000 AS INTEGER) as day, COUNT(*) as count FROM scripts WHERE created_at >= ? GROUP BY day ORDER BY day ASC",
    )
    .all(startOfDay(6)) as { day: number; count: number }[];

  const dailyGenerations: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = startOfDay(i);
    const end = start + 24 * 60 * 60 * 1000;
    const total = dailyRows
      .filter((row) => row.day * 86400000 >= start && row.day * 86400000 < end)
      .reduce((sum, row) => sum + row.count, 0);
    dailyGenerations.push({
      day: new Date(start).toISOString().slice(5, 10),
      count: total,
    });
  }

  const recentRows = db
    .prepare("SELECT * FROM licenses ORDER BY created_at DESC LIMIT 5")
    .all() as LicenseRow[];
  const counts = db
    .prepare("SELECT license_id, COUNT(*) as c FROM scripts GROUP BY license_id")
    .all() as { license_id: string; c: number }[];
  const countMap = new Map(counts.map((row) => [row.license_id, row.c]));

  const recentLicenses: AdminLicenseRow[] = recentRows.map((row) => ({
    ...licenseToView(row),
    notes: row.notes,
    scripts: countMap.get(row.id) ?? 0,
  }));

  const stats: AdminStats = {
    licenses: {
      total: licenseRows.length,
      active: active.length,
      revoked: revoked.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length,
    },
    scripts: {
      total: count("SELECT COUNT(*) as c FROM scripts"),
      today: count("SELECT COUNT(*) as c FROM scripts WHERE created_at >= ?", startOfDay()),
      week: count("SELECT COUNT(*) as c FROM scripts WHERE created_at >= ?", startOfDay(6)),
    },
    jobs: {
      running: count("SELECT COUNT(*) as c FROM jobs WHERE status IN ('queued','running')"),
      completed: count("SELECT COUNT(*) as c FROM jobs WHERE status = 'completed'"),
      failed: count("SELECT COUNT(*) as c FROM jobs WHERE status = 'failed'"),
      cancelled: count("SELECT COUNT(*) as c FROM jobs WHERE status = 'cancelled'"),
    },
    providers,
    recentLicenses,
    dailyGenerations,
  };

  return ok({ stats });
});
