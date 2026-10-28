/**
 * Indian bank / UPI-app SMS + notification parser.
 *
 * parseSms(text) -> { direction: "credit"|"debit"|"unknown", amount: paise|null,
 *                     utr: "12 digits"|null, payer_vpa: "x@handle"|null }
 *
 * Strategy
 *  1. Direction: locate "strong" credit / debit phrases; the earliest one wins
 *     (debit SMS often say "...debited ... and credited to X", credit SMS lead
 *     with the credit verb). Weak markers (Cr / Dr) only count when nothing
 *     strong is present. Collect requests and OTPs are "unknown".
 *  2. Amount: every Rs / Rs. / INR / ₹ amount is a candidate. Candidates that sit
 *     in a balance / limit clause ("Avl Bal INR 1,234.00") are discarded. The
 *     candidate closest to the direction keyword wins.
 *  3. UTR: a standalone 12-digit number closest after UTR / RRN / Ref / Txn / UPI.
 *  4. Payer VPA: the first handle@psp token (domains with dots, i.e. emails, are skipped).
 *
 * Safety: a false "credit" can mark an order paid without money, so anything that looks like a
 * failed / pending / reversed / refunded transaction, a mandate or autopay notice, a collect request,
 * a future-tense notice, an OTP, a promotion (cashback, "win Rs 500"), or a non-customer credit
 * (loan, interest, salary, card bill payment) is forced to direction "unknown" and gets ignored.
 */

import { rupeesToPaise } from './money.js';

const STRONG_CREDIT = [
  /\bcredited\b/gi,
  /\bamount\s+credited\b/gi,
  /\bcredit(?:ed)?\s+alert\b/gi,
  /\breceived\b/gi,
  /\bdeposited\b/gi,
  /\bdeposit\s+by\b/gi,
  /\bpaid\s+you\b/gi,
  /\bsent\s+you\b/gi,
  /\badded\s+to\s+(?:your\s+)?(?:a\/?c|account|wallet)\b/gi,
];

const STRONG_DEBIT = [
  /\bdebited\b/gi,
  /\bdebit\s+alert\b/gi,
  /\bsent\b(?!\s+you\b)/gi,
  /\bpaid\s+to\b/gi,
  /\byou\s+(?:have\s+)?paid\b/gi,
  /\bpaid\s+(?=(?:rs\.?|inr|₹))/gi,
  /\bwithdrawn\b/gi,
  /\bwithdrawal\b/gi,
  /\bspent\b/gi,
  /\btransferred\s+to\b/gi,
  /\bpurchase\s+of\b/gi,
];

const WEAK_CREDIT = [/\bcr\b\.?/gi];
const WEAK_DEBIT = [/\bdr\b\.?/gi];

/**
 * Any hit => not a customer credit we may act on. Deliberately broad: a missed credit only means the
 * merchant confirms by hand; a false credit means goods shipped without payment.
 */
const NEGATIVE = [
  // failed / declined / pending / reversed transactions
  /\b(?:fail(?:ed|ure|s)?|declined|unsuccessful|rejected|cancell?ed|could\s*(?:not|n't)\s+be|has\s+not\s+been|was\s+not|not\s+(?:been\s+)?(?:processed|completed|successful|credited)|pending|timed?\s*out|on\s+hold|under\s+process)\b/i,
  // money coming back to you is not a customer payment
  /\b(?:refund(?:ed|s)?|revers(?:al|als|ed)|chargeback|charge\s+back|returned)\b/i,
  // mandates / autopay / standing instructions / scheduled debits
  /\b(?:mandate|auto\s*-?\s*pay|auto\s*-?\s*debit|e-?nach|nach|standing\s+instruction|subscription|recurring)\b/i,
  // collect / money requests
  /\b(?:has\s+requested|have\s+requested|requested\s+(?:you|money|payment|for|rs\.?|inr|₹)|request(?:ed|ing|s)?\s+(?:money|payment|of|for|rs\.?|inr|₹)|collect\s+request|payment\s+request|money\s+request|sent\s+(?:you\s+)?a\s+request|is\s+requesting|approve\s+(?:the\s+|this\s+)?(?:request|payment|mandate|transaction)|accept\s+to\s+pay)\b/i,
  // future tense / dues
  /\bwill\s+be\s+(?:credited|debited|deducted|charged|paid|sent|transferred|auto)|\b(?:is|are)\s+due\b|\bdue\s+(?:date|on|by)\b|\b(?:minimum|total)\s+(?:amount\s+)?due\b|\bscheduled\b/i,
  // OTP / verification codes
  /\b(?:otp|one[\s-]?time\s+password|verification\s+code|security\s+code)\s*(?:is|for|to|:|-)|\bis\s+(?:your|the)\s+(?:otp|one[\s-]?time\s+password|verification\s+code|code)\b/i,
  // promotions / rewards
  /\b(?:cash\s*back|rewards?|scratch\s*card|coupons?|vouchers?|offers?|win|wins|won|winner|winning|lucky|congrat(?:s|ulations)?|jackpot|prizes?|lottery|bonus|eligible|pre-?approved|apply\s+now|limited\s+period|hurry|up\s*to|claim)\b/i,
  // credits that are not a customer paying the merchant
  /\b(?:loan|emi|interest|dividend|salary|premium|policy|bill|recharge|credit\s*card|card\s+(?:no\.?\s*)?(?:ending|xx|\*{2,}|x{2,}))\b/i,
];

const NON_TRANSACTION = /\b(?:has\s+requested|requested\s+(?:money|rs|inr|₹|a\s+payment)|collect\s+request|will\s+be\s+(?:debited|credited)|(?:otp|one\s+time\s+password)\s+(?:for|is|to)|is\s+your\s+otp|minimum\s+(?:amount\s+)?due|payment\s+(?:is\s+)?due|autopay\s+(?:set|scheduled))\b/i;

const AMOUNT_RE = /(?:(?<![a-z])(?:rs|inr)(?![a-z])\.?|₹)\s*:?\s*-?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi;
const BALANCE_CONTEXT = /(?:\bbal(?:ance)?\b|\bavl\b|\bavlbl\b|\bavail(?:able)?\b|\bclos(?:ing)?\b|\bledger\b|\blimit\b|\bo\/s\b|\boutstanding\b|\btotal\s+due\b|\bmin(?:imum)?\s+due\b|\bclr\b|\bclear\b)[^0-9]{0,18}$/i;
const BARE_AMOUNT_RE = /\b(?:credited|received|deposited|debited)\s+(?:by|with|for|of)?\s*(\d[\d,]*(?:\.\d{1,2})?)(?![\d/])/i;

const UTR_KEYWORD = /\b(?:utr|rrn|ref(?:erence)?|txn|transaction|upi|imps|neft)\b/gi;
const TWELVE_DIGITS = /(?<!\d)(\d{12})(?!\d)/g;
const ACCOUNT_CONTEXT = /(?:a\/?c|acct|account|card)[^0-9]{0,12}$/i;
/** 12-digit numbers right after these are phone numbers / customer ids in footers, never UTRs. */
const NOT_UTR_CONTEXT = /\b(?:call|sms|cust(?:omer)?\s*id|helpline|dial|whatsapp|mobile\s*(?:no|number)|phone\s*(?:no|number))\b[^0-9]{0,20}$/i;

const VPA_RE = /([a-zA-Z0-9][a-zA-Z0-9.\-_]{1,255})@([a-zA-Z]{2,64})(?![a-zA-Z0-9\-_]|\.[a-zA-Z])/g;

function findAll(text, regexes) {
  const hits = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      hits.push({ index: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function detectDirection(text) {
  const credit = findAll(text, STRONG_CREDIT);
  const debit = findAll(text, STRONG_DEBIT);
  if (credit.length || debit.length) {
    if (!debit.length) return { direction: 'credit', anchors: credit };
    if (!credit.length) return { direction: 'debit', anchors: debit };
    return credit[0].index < debit[0].index
      ? { direction: 'credit', anchors: credit }
      : { direction: 'debit', anchors: debit };
  }
  const wc = findAll(text, WEAK_CREDIT);
  const wd = findAll(text, WEAK_DEBIT);
  if (wc.length && !wd.length) return { direction: 'credit', anchors: wc };
  if (wd.length && !wc.length) return { direction: 'debit', anchors: wd };
  return { direction: 'unknown', anchors: [] };
}

function findAmount(text, anchors) {
  const candidates = [];
  AMOUNT_RE.lastIndex = 0;
  let m;
  while ((m = AMOUNT_RE.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (BALANCE_CONTEXT.test(before)) continue;
    const paise = rupeesToPaise(m[1]);
    if (paise == null) continue;
    candidates.push({ index: m.index, paise });
  }
  if (candidates.length) {
    if (!anchors.length) return candidates[0].paise;
    let best = null;
    for (const c of candidates) {
      for (const a of anchors) {
        const dist = c.index >= a.end ? c.index - a.end : a.index - c.index;
        const d = Math.max(0, dist);
        if (!best || d < best.d) best = { d, paise: c.paise };
      }
    }
    return best.paise;
  }
  const bare = BARE_AMOUNT_RE.exec(text);
  if (bare) return rupeesToPaise(bare[1]);
  return null;
}

function findUtr(text) {
  const keywords = findAll(text, [UTR_KEYWORD]);
  const numbers = [];
  TWELVE_DIGITS.lastIndex = 0;
  let m;
  while ((m = TWELVE_DIGITS.exec(text))) {
    if (NOT_UTR_CONTEXT.test(text.slice(Math.max(0, m.index - 30), m.index))) continue;
    numbers.push({ index: m.index, value: m[1] });
  }
  if (!numbers.length) return null;

  let best = null;
  for (const n of numbers) {
    for (const k of keywords) {
      const gap = n.index - k.end;
      if (gap < 0 || gap > 30) continue;
      if (!best || gap < best.gap) best = { gap, value: n.value };
    }
  }
  if (best) return best.value;

  const plausible = numbers.filter((n) => !ACCOUNT_CONTEXT.test(text.slice(Math.max(0, n.index - 20), n.index)));
  return plausible.length === 1 ? plausible[0].value : null;
}

function findVpa(text) {
  VPA_RE.lastIndex = 0;
  const m = VPA_RE.exec(text);
  return m ? `${m[1]}@${m[2]}`.replace(/[.\-_]+$/, '') : null;
}

export function parseSms(input) {
  const text = String(input ?? '').slice(0, 4000).replace(/\s+/g, ' ').trim();
  if (!text) return { direction: 'unknown', amount: null, utr: null, payer_vpa: null };

  let { direction, anchors } = detectDirection(text);
  if (NON_TRANSACTION.test(text) || (direction === 'credit' && NEGATIVE.some((re) => re.test(text)))) {
    direction = 'unknown';
    anchors = [];
  }
  return {
    direction,
    amount: findAmount(text, anchors),
    utr: findUtr(text),
    payer_vpa: findVpa(text),
  };
}
