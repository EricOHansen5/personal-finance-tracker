import { describe, expect, it } from "vitest";
import {
  ensureDefaultCategories,
  findCategoryId,
  findCategoryIdBySeedKey,
} from "@/lib/categories/ensure";
import { openDb } from "@/lib/db/client";
import {
  accounts,
  imports,
  transactions,
  transferPairs,
} from "@/lib/db/schema";
import { undoImport } from "@/lib/import/commit";
import { applyTransfers } from "@/lib/transfers/apply";
import { mustFind } from "../helpers";

type Db = ReturnType<typeof openDb>;

const seedKey = (db: Db, key: string) => {
  const id = findCategoryIdBySeedKey(db, key);
  if (id === undefined) throw new Error(`missing category ${key}`);
  return id;
};

/** A checking account and one loan account, with a payment leaving checking and landing on the loan. */
function setup(
  loanName: string,
  payment = { categoryId: null as number | null, reviewed: false },
) {
  const db = openDb(":memory:");
  ensureDefaultCategories(db);
  const [chk, loan] = db
    .insert(accounts)
    .values([
      { name: "USAA Checking", type: "checking" },
      { name: loanName, type: "loan" },
    ])
    .returning()
    .all();
  const [imp] = db
    .insert(imports)
    .values({
      accountId: loan.id,
      filename: "loan.qfx",
      fileHash: "f1",
      rowCount: 1,
      newCount: 1,
      dupCount: 0,
    })
    .returning()
    .all();
  db.insert(transactions)
    .values([
      {
        accountId: chk.id,
        date: "2026-03-01",
        amountCents: -183000,
        rawDescription: "LENDER PMT",
        merchant: "Lender",
        dedupeHash: "pay",
        ...payment,
      },
      {
        accountId: loan.id,
        importId: imp.id,
        date: "2026-03-02",
        amountCents: 183000,
        rawDescription: "PAYMENT RECEIVED",
        merchant: "Payment",
        dedupeHash: "recv",
      },
    ])
    .run();
  const row = (hash: string) =>
    mustFind(
      db.select().from(transactions).all(),
      (r) => r.dedupeHash === hash,
      hash,
    );
  return { db, chk, loan, imp, row };
}

describe("applyTransfers with a loan account", () => {
  it("keeps a mortgage payment as spending under Rent/Mortgage", () => {
    const { db, row } = setup("Freedom Mortgage");
    expect(applyTransfers(db)).toEqual({ paired: 1, ruleMarked: 0 });
    expect(db.select().from(transferPairs).all()).toHaveLength(1);
    expect(row("pay")).toMatchObject({
      isTransfer: false,
      categoryId: seedKey(db, "home/rent-mortgage"),
      reviewed: true,
    });
    expect(row("recv")).toMatchObject({ isTransfer: true, reviewed: true });
  });

  it("recognizes a mortgage lender abbreviated as MTG", () => {
    const { db, row } = setup("Freedom MTG");
    applyTransfers(db);
    expect(row("pay").categoryId).toBe(seedKey(db, "home/rent-mortgage"));
  });

  it("files any other loan's payment under Loan payments", () => {
    const { db, row } = setup("First Security HELOC");
    applyTransfers(db);
    expect(row("pay")).toMatchObject({
      isTransfer: false,
      categoryId: seedKey(db, "debt/loan-payments"),
    });
    expect(row("recv").isTransfer).toBe(true);
  });

  it("leaves a category the user already confirmed alone", () => {
    const db0 = openDb(":memory:");
    ensureDefaultCategories(db0);
    const own = seedKey(db0, "home/insurance");
    const { db, row } = setup("Freedom Mortgage", {
      categoryId: own,
      reviewed: true,
    });
    applyTransfers(db);
    expect(row("pay")).toMatchObject({ isTransfer: false, categoryId: own });
  });

  it("replaces a confirmed Transfer category, since the payment is no longer a transfer", () => {
    const db0 = openDb(":memory:");
    ensureDefaultCategories(db0);
    const transferCat = findCategoryId(db0, "Transfer") ?? null;
    const { db, row } = setup("Freedom Mortgage", {
      categoryId: transferCat,
      reviewed: true,
    });
    applyTransfers(db);
    expect(row("pay")).toMatchObject({
      isTransfer: false,
      categoryId: seedKey(db, "home/rent-mortgage"),
    });
  });

  it("treats money drawn from a loan into checking as a plain transfer", () => {
    const db = openDb(":memory:");
    ensureDefaultCategories(db);
    const [chk, heloc] = db
      .insert(accounts)
      .values([
        { name: "Chk", type: "checking" },
        { name: "HELOC", type: "loan" },
      ])
      .returning()
      .all();
    db.insert(transactions)
      .values([
        {
          accountId: heloc.id,
          date: "2026-03-01",
          amountCents: -500000,
          rawDescription: "ADVANCE",
          merchant: "Advance",
          dedupeHash: "draw",
        },
        {
          accountId: chk.id,
          date: "2026-03-01",
          amountCents: 500000,
          rawDescription: "TRANSFER FROM HELOC",
          merchant: "Transfer",
          dedupeHash: "in",
        },
      ])
      .run();
    applyTransfers(db);
    const rows = db.select().from(transactions).all();
    expect(rows.every((r) => r.isTransfer)).toBe(true);
  });

  it("keeps the payment's category when the loan statement is undone", () => {
    const { db, imp, row } = setup("Freedom Mortgage");
    applyTransfers(db);
    undoImport(db, imp.id);
    expect(row("pay")).toMatchObject({
      isTransfer: false,
      categoryId: seedKey(db, "home/rent-mortgage"),
    });
  });
});
