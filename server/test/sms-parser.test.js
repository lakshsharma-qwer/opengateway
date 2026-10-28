import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSms } from '../src/lib/sms-parser.js';

const cases = [
  // ---- HDFC
  ['HDFC credit (Money Received)',
    'Money Received - INR 499.01 in your HDFC Bank A/c xx1234 on 23-10-26 by A/c linked to VPA ravi.k@okaxis (UPI Ref No 412345678901). Avl bal: INR 12,000.50',
    { direction: 'credit', amount: 49901, utr: '412345678901', payer_vpa: 'ravi.k@okaxis' }],
  ['HDFC credit alert',
    'Credit Alert!\nRs.1,250.00 credited to HDFC Bank A/c XX1234 on 23-10-26 from VPA priya@ybl (UPI 523456789012)',
    { direction: 'credit', amount: 125000, utr: '523456789012', payer_vpa: 'priya@ybl' }],
  ['HDFC debit (Sent)',
    'Sent Rs.500.00\nFrom HDFC Bank A/C *1234\nTo RAVI KUMAR\nOn 23/10/26\nRef 412345678902\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    { direction: 'debit', amount: 50000, utr: '412345678902' }],
  // ---- SBI
  ['SBI credit',
    'Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 23Oct26 by (Ref no 612345678903)',
    { direction: 'credit', amount: 50000, utr: '612345678903' }],
  ['SBI credit with transfer + balance',
    'Your A/C XXXXX1234 Credited INR 2,000.00 on 23/10/26 -Deposit by transfer from RAVI KUMAR. Avl Bal INR 15,500.25-SBI',
    { direction: 'credit', amount: 200000 }],
  ['SBI debit without currency',
    'Dear UPI user A/C X1234 debited by 500.0 on date 23Oct26 trf to RAVI Refno 412345678904. If not u? call 1800111109. -SBI',
    { direction: 'debit', amount: 50000, utr: '412345678904' }],
  // ---- ICICI
  ['ICICI credit',
    'Dear Customer, Acct XX123 is credited with Rs 750.50 on 23-Oct-26 from ankit@paytm. UPI:712345678905-ICICI Bank.',
    { direction: 'credit', amount: 75050, utr: '712345678905', payer_vpa: 'ankit@paytm' }],
  ['ICICI debit ("... credited" beneficiary later)',
    'ICICI Bank Acct XX123 debited for Rs 300.00 on 23-Oct-26; RAVI credited. UPI:712345678906. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.',
    { direction: 'debit', amount: 30000, utr: '712345678906' }],
  ['ICICI credit with Available Balance',
    'ICICI Bank Account XX123 credited:Rs. 1,000.00 on 23-Oct-26. Info UPI-812345678907-Ravi. Available Balance is Rs. 1,23,456.00.',
    { direction: 'credit', amount: 100000, utr: '812345678907' }],
  // ---- Axis
  ['Axis credit (Info- UPI/P2A)',
    'INR 499.01 credited to A/c no. XX1234 on 23-10-26 at 10:20:30 IST. Info- UPI/P2A/412345678908/RAVI KUMAR/Axis Bank. Avl Bal INR 12,345.67 - Axis Bank',
    { direction: 'credit', amount: 49901, utr: '412345678908' }],
  ['Axis debit',
    'INR 250.00 debited A/c no. XX1234 23-10-26 10:20:30 UPI/P2M/412345678909/SWIGGY Not you? SMS BLOCKUPI Cust ID to 919951860002 Axis Bank',
    { direction: 'debit', amount: 25000, utr: '412345678909' }],
  // ---- Kotak
  ['Kotak credit',
    'Received Rs.999.00 in your Kotak Bank AC X1234 from neha@okhdfcbank on 23-10-26.UPI Ref:912345678910.',
    { direction: 'credit', amount: 99900, utr: '912345678910', payer_vpa: 'neha@okhdfcbank' }],
  ['Kotak debit',
    'Sent Rs.120.00 from Kotak Bank AC X1234 to chai@okaxis on 23-10-26.UPI Ref 912345678911. Not you, kotak.com/fraud',
    { direction: 'debit', amount: 12000, utr: '912345678911', payer_vpa: 'chai@okaxis' }],
  // ---- App notifications
  ['PhonePe received',
    'Received ₹1,499 from Ravi Kumar. UTR: 312345678912',
    { direction: 'credit', amount: 149900, utr: '312345678912' }],
  ['PhonePe paid (debit)',
    'Paid ₹500 to Ravi Kumar',
    { direction: 'debit', amount: 50000 }],
  ['GPay paid you',
    'Ravi Kumar paid you ₹250.75',
    { direction: 'credit', amount: 25075 }],
  ['GPay sent you',
    'Priya sent you ₹100 • UPI transaction ID 212345678913',
    { direction: 'credit', amount: 10000, utr: '212345678913' }],
  ['Paytm money received',
    'Rs 75 received from 98XXXXXX10 in your Paytm Payments Bank a/c. UPI Ref No: 112345678914',
    { direction: 'credit', amount: 7500, utr: '112345678914' }],
  // ---- Balance-first / tricky
  ['balance clause appears first',
    'Avl Bal Rs 5,000.00. Rs 200 credited to your a/c XX99 UTR 998877665544',
    { direction: 'credit', amount: 20000, utr: '998877665544' }],
  ['balance only, no transaction',
    'Your Avl Bal is INR 5,000.00 as on 23-10-26',
    { direction: 'unknown' }],
  ['collect request is not a credit',
    'RAVI has requested money from you on Google Pay. On approving the request, INR 500.00 will be debited from your A/c.',
    { direction: 'unknown' }],
  ['OTP is not a credit',
    'OTP for txn of Rs 2000 at AMAZON is 123456. Do not share.',
    { direction: 'unknown' }],
  ['email-like token is not a VPA',
    'Rs 300 credited to a/c XX12 from ravi@oksbi. Queries: care@hdfcbank.net',
    { direction: 'credit', amount: 30000, payer_vpa: 'ravi@oksbi' }],
];

for (const [name, text, expected] of cases) {
  test(`parser: ${name}`, () => {
    const got = parseSms(text);
    for (const [k, v] of Object.entries(expected)) assert.equal(got[k], v, `${k} for: ${text}`);
  });
}

test('parser: empty input', () => {
  assert.deepEqual(parseSms(''), { direction: 'unknown', amount: null, utr: null, payer_vpa: null });
});

test('parser: amount with paise and Indian grouping', () => {
  assert.equal(parseSms('INR 1,23,456.5 credited to a/c').amount, 12345650);
});

test('parser: credit SMS with a "never share OTP" footer is still a credit', () => {
  const r = parseSms('Rs 450.00 credited to A/c XX11 via UPI Ref 512345678999. Never share your OTP with anyone. -Bank');
  assert.equal(r.direction, 'credit');
  assert.equal(r.amount, 45000);
});
