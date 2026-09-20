import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, recurringRules, recurringRuns } from "@/db/schema";
import {
  effectiveMonthlyDate,
  toIdr,
  toKey,
  wibTodayKey,
} from "@/lib/finance";
import { createTransaction } from "@/lib/ledger-service";
import { getRates } from "@/lib/rates-server";

const MAX_BACKFILL_MONTHS = 6;

function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function shiftMonths(y: number, m: number, delta: number): [number, number] {
  const total = y * 12 + m + delta;
  return [Math.floor(total / 12), ((total % 12) + 12) % 12];
}

/**
 * Posting semua aturan AKTIF yang jatuh tempo (efektif <= hari ini WIB)
 * dan belum ada jejaknya. Idempoten via klaim baris runs lebih dulu.
 * userId null = semua user (dipakai cron server).
 */
export async function processDueRules(
  userId?: string,
): Promise<{ processed: number; created: number }> {
  if (!db) throw new Error("db_not_configured");
  const todayKey = wibTodayKey();
  const [cy, cm1] = todayKey.split("-").map(Number);
  const curY = cy ?? new Date().getFullYear();
  const curM = (cm1 ?? 1) - 1;

  const rules = userId
    ? await db
        .select()
        .from(recurringRules)
        .where(
          and(
            eq(recurringRules.userId, userId),
            eq(recurringRules.active, true),
          ),
        )
    : await db
        .select()
        .from(recurringRules)
        .where(eq(recurringRules.active, true));

  let processed = 0;
  let created = 0;
  const rates = await getRates();

  for (const rule of rules) {
    try {
      // Akun masih ada & milik user yang sama?
      const acc = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, rule.accountId),
            eq(accounts.userId, rule.userId),
          ),
        );
      const a = acc[0];
      if (!a) continue;
      processed++;

      const [sy, sm1] = rule.startMonth.split("-").map(Number);
      let y = sy ?? curY;
      let m = (sm1 ?? 1) - 1;
      // Batas backfill agar tidak menumpuk posting lama.
      const [minY, minM] = shiftMonths(curY, curM, -(MAX_BACKFILL_MONTHS - 1));
      if (y * 12 + m < minY * 12 + minM) {
        y = minY;
        m = minM;
      }
      for (let g = 0; g < 24; g++) {
        if (y * 12 + m > curY * 12 + curM) break;
        const period = monthKey(y, m);
        const eff = effectiveMonthlyDate(y, m, rule.dayOfMonth);
        if (toKey(eff) <= todayKey) {
          // Klaim dulu (atomic-ish): yang menang klaim yang posting.
          const claimed = await db
            .insert(recurringRuns)
            .values({ ruleId: rule.id, period, effectiveDate: toKey(eff) })
            .onConflictDoNothing({
              target: [recurringRuns.ruleId, recurringRuns.period],
            })
            .returning({ id: recurringRuns.id });
          if (claimed.length > 0 && claimed[0]) {
            const amount = Number(rule.amountNative);
            const res = await createTransaction(rule.userId, {
              accountId: rule.accountId,
              kind: rule.kind,
              amount,
              category: rule.category,
              date: toKey(eff),
              note:
                rule.note?.trim() ||
                `${rule.category} ${eff.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
              amountIdr: Math.round(toIdr(amount, a.type, rates)),
            });
            if ("error" in res) {
              // Gagal tulis tx → lepas klaim agar dicoba lagi berikutnya.
              await db.delete(recurringRuns).where(eq(recurringRuns.id, claimed[0].id));
            } else {
              created++;
            }
          }
        }
        [y, m] = shiftMonths(y, m, 1);
      }
    } catch (e) {
      console.error("[recurring]", rule.id, e instanceof Error ? e.message : e);
    }
  }
  return { processed, created };
}
