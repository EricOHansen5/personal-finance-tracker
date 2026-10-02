import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOfx } from "@/lib/import/ofx";

describe("parseOfx", () => {
  const out = parseOfx(fs.readFileSync("tests/fixtures/sample.ofx", "utf8"));
  it("reads account id", () => expect(out.accountId).toBe("987654321"));
  it("parses three transactions", () => expect(out.rows).toHaveLength(3));
  it("normalizes date and cents", () => {
    expect(out.rows[0]).toMatchObject({
      date: "2026-03-02",
      amountCents: -675,
      merchant: "Blue Bottle Coffee",
    });
    expect(out.rows[0].rawDescription).toBe("SQ *BLUE BOTTLE COFFEE Card 1234");
    expect(out.rows[1]).toMatchObject({
      date: "2026-03-06",
      amountCents: 240000,
    });
  });
  it("reads the statement's ledger balance", () => {
    expect(out.balance).toEqual({ date: "2026-03-15", balanceCents: 331501 });
  });
  it("reads an XML-style ledger balance", () => {
    const xml = `<OFX><LEDGERBAL><BALAMT>-1234.56</BALAMT><DTASOF>20260401120000</DTASOF></LEDGERBAL></OFX>`;
    expect(parseOfx(xml).balance).toEqual({
      date: "2026-04-01",
      balanceCents: -123456,
    });
  });
  it("has no balance when the file carries none", () => {
    const xml = `<OFX><STMTTRN><DTPOSTED>20260101</DTPOSTED><TRNAMT>-1.00</TRNAMT><NAME>X</NAME></STMTTRN></OFX>`;
    expect(parseOfx(xml).balance).toBeUndefined();
  });
  it("parses XML-style OFX 2.x too", () => {
    const xml = `<?xml version="1.0"?><OFX><STMTTRN><DTPOSTED>20260101</DTPOSTED><TRNAMT>-1.00</TRNAMT><NAME>X</NAME></STMTTRN></OFX>`;
    expect(parseOfx(xml).rows[0]).toMatchObject({
      date: "2026-01-01",
      amountCents: -100,
    });
  });
});
