// Loans are checked before cards so "Home Equity Line of Credit" is a loan,
// while an unsecured "Bank Credit Line" still reads as a card.
const LOAN_WORDS = /mortgage|\bloan\b|\bheloc\b|home equity/i;
const INVESTMENT_WORDS = /\bira\b|401\(?k\)?|brokerage|acorns|\binvest/i;
const SAVINGS_WORDS = /savings|money market|\bcd\b/i;
const CARD_WORDS =
  /card|credit|visa|mastercard|amex|american express|discover|rewards/i;

type GuessedType = "checking" | "savings" | "credit" | "loan" | "investment";

/** Guess an app account type from a bank-side name; the user can change it later. */
export function guessAccountType(name: string): GuessedType {
  if (LOAN_WORDS.test(name)) return "loan";
  if (INVESTMENT_WORDS.test(name)) return "investment";
  if (SAVINGS_WORDS.test(name)) return "savings";
  if (CARD_WORDS.test(name)) return "credit";
  return "checking";
}
