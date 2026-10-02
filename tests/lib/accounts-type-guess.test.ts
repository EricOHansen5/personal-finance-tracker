import { describe, expect, it } from "vitest";
import { guessAccountType } from "@/lib/accounts/type-guess";

describe("guessAccountType", () => {
  it.each([
    "Amazon Prime Rewards Visa Signature (1234)",
    "Chase Freedom Unlimited CARD",
    "Bank Credit Line",
    "World Mastercard",
    "Amex Blue",
    "American Express Gold",
    "Discover it",
  ])("treats %s as a credit card", (name) => {
    expect(guessAccountType(name)).toBe("credit");
  });
  it.each(["TOTAL CHECKING (0000)", "EVERYDAY CHECKING", "Chase Bank"])(
    "leaves %s as checking",
    (name) => {
      expect(guessAccountType(name)).toBe("checking");
    },
  );
  it.each([
    "Savings",
    "USAA Savings",
    "Marcus by Goldman Sachs Online Savings Account",
    "High Yield Money Market",
    "12 Month CD",
  ])("treats %s as savings", (name) => {
    expect(guessAccountType(name)).toBe("savings");
  });
  it.each([
    "Freedom Mortgage",
    "First Security Bank HELOC",
    "Home Equity Line of Credit",
    "Clearwater Credit Union Solar Loan",
    "Auto Loan",
  ])("treats %s as a loan", (name) => {
    expect(guessAccountType(name)).toBe("loan");
  });
  it.each([
    "Roth IRA",
    "Fidelity 401(k)",
    "401k Plan",
    "Acorns Invest",
    "Individual Brokerage",
  ])("treats %s as an investment account", (name) => {
    expect(guessAccountType(name)).toBe("investment");
  });
});
