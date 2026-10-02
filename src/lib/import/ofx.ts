import { parseAmountToCents } from "@/lib/money";
import type { Snapshot } from "@/lib/networth/types";
import { cleanMerchant } from "@/lib/normalize/merchant";
import type { ParsedRow } from "./types";

function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(block);
  return m?.[1].trim();
}

function ofxDate(s: string | undefined): string | null {
  if (!s || !/^\d{8}/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** The statement's closing balance, as the bank signs it (negative = owed on most cards). */
function ledgerBalance(body: string): Snapshot | undefined {
  const block = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|$)/i.exec(body)?.[1];
  if (!block) return undefined;
  const date = ofxDate(tag(block, "DTASOF"));
  const balanceCents = parseAmountToCents(tag(block, "BALAMT") ?? "");
  if (!date || balanceCents === null) return undefined;
  return { date, balanceCents };
}

export function parseOfx(text: string): {
  accountId?: string;
  rows: ParsedRow[];
  balance?: Snapshot;
} {
  const body = text.slice(text.search(/<OFX>/i));
  const accountId = tag(body, "ACCTID");
  const balance = ledgerBalance(body);
  const rows: ParsedRow[] = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  for (const m of body.matchAll(re)) {
    const b = m[1];
    const date = ofxDate(tag(b, "DTPOSTED"));
    const amountCents = parseAmountToCents(tag(b, "TRNAMT") ?? "");
    const name = tag(b, "NAME") ?? tag(b, "PAYEE") ?? "";
    const memo = tag(b, "MEMO");
    if (!date || amountCents === null) continue;
    const rawDescription = [name, memo].filter(Boolean).join(" ").trim();
    rows.push({
      date,
      amountCents,
      rawDescription,
      merchant: cleanMerchant(name || rawDescription),
    });
  }
  return { accountId, rows, balance };
}
