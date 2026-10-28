/**
 * Real-world credit formats from many Indian banks / UPI apps, and the negative cases that must NEVER
 * parse as a credit (a false credit marks an order paid without money).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSms } from '../src/lib/sms-parser.js';

const credits = [
  ['SBI transfer credit',
    'Dear SBI User, your A/c X1234-credited by Rs.500 on 23Oct26 transfer from RAVI KUMAR Ref No 412345678901 -SBI',
    { amount: 50000, utr: '412345678901' }],
  ['HDFC "Update! deposited" with cheque-clearing footer',
    'Update! INR 500.00 deposited in HDFC Bank A/c XX1234 on 23-OCT-26 for UPI-RAVI KUMAR-ravi@okaxis-HDFC0001234-412345678901-PAYMENT.Avl bal INR 10,000.00. Cheque deposits in A/C are subject to clearing',
    { amount: 50000, utr: '412345678901' }],
  ['ICICI credited with ... from',
    'ICICI Bank Acct XX123 credited with Rs 500.00 on 23-Oct-26 from RAVI KUMAR. UPI:412345678901. Call 18002662 for dispute.',
    { amount: 50000, utr: '412345678901' }],
  ['Axis "Amount Credited" block format',
    'Amount Credited: INR 500.00 Account Number: XX1234 Date & Time: 23-10-26, 10:20:30 IST Transaction Info: UPI/P2A/412345678901/RAVI KUMAR',
    { amount: 50000, utr: '412345678901' }],
  ['Kotak "is credited in your"',
    'Rs 500.00 is credited in your Kotak Bank A/c XX1234 by ravi@okaxis on 23-10-26 (UPI Ref No 412345678901).',
    { amount: 50000, utr: '412345678901', payer_vpa: 'ravi@okaxis' }],
  ['Yes Bank',
    'INR 500.00 credited to your A/c XX1234 on 23-10-2026 by UPI Ref no 412345678901 from ravi@okaxis.Avl Bal INR 1,000.00 - YES BANK',
    { amount: 50000, utr: '412345678901' }],
  ['IDFC FIRST',
    'Your A/C XXXXXXX1234 has been credited with INR 500.00 on 23/10/2026 from ravi@okaxis. UPI Ref 412345678901. Avl Bal INR 1,000.00 - IDFC FIRST Bank',
    { amount: 50000, utr: '412345678901', payer_vpa: 'ravi@okaxis' }],
  ['PNB with "Avl Bal Cr"',
    'Your A/c XX1234 credited INR 500.00 on 23-10-26 via UPI Ref No 412345678901. Avl Bal Cr INR 1,000.00 - PNB',
    { amount: 50000, utr: '412345678901' }],
  ['Bank of Baroda with Avlbl Amt',
    'Rs.500.00 Credited to A/c ...1234 thru UPI/412345678901 by ravi@okaxis. Total Bal:Rs.1000.00CR. Avlbl Amt:Rs.1000.00(23-10-2026 10:20:30) - Bank of Baroda',
    { amount: 50000, utr: '412345678901' }],
  ['Canara "has been CREDITED"',
    'An amount of INR 500.00 has been CREDITED to your account XXX1234 on 23/10/2026 towards UPI Ref 412345678901 from RAVI. Total Avail.bal INR 1,000.00 - Canara Bank',
    { amount: 50000, utr: '412345678901' }],
  ['Union Bank Rs: format with OTP/PIN footer',
    'A/c *1234 Credited for Rs:500.00 on 23-10-2026 10:20:30 by Mob Bk ref no 412345678901 Avl Bal Rs:1000.00.Never Share OTP/PIN/CVV-Union Bank of India',
    { amount: 50000, utr: '412345678901' }],
  ['IndusInd',
    'Your IndusInd A/C 1234XXXX5678 is credited by Rs 500.00 towards UPI/412345678901/ravi@okaxis. Avl Bal Rs 1,000.00',
    { amount: 50000, utr: '412345678901' }],
  ['AU Small Finance',
    'Dear Customer, your AU Bank A/c XX1234 is credited with INR 500.00 on 23-10-26 via UPI from ravi@okaxis Ref 412345678901. Avl Bal INR 1000.00',
    { amount: 50000, utr: '412345678901' }],
  ['Paytm Payments Bank',
    'Received Rs.500 in your a/c XX1234 from RAVI KUMAR via UPI. UPI Ref: 412345678901. -Paytm Payments Bank',
    { amount: 50000, utr: '412345678901' }],
  ['Fi (Federal)',
    '₹500 received in your Federal Bank account from RAVI KUMAR via UPI. Ref 412345678901 - Fi Money',
    { amount: 50000, utr: '412345678901' }],
  ['Jupiter',
    "You've received ₹500 from ravi@okaxis. Txn ID 412345678901",
    { amount: 50000, utr: '412345678901', payer_vpa: 'ravi@okaxis' }],
  ['GPay notification', 'Ravi Kumar paid you ₹500.00', { amount: 50000 }],
  ['PhonePe notification', '₹500 received in your Bank account XX1234 from Ravi Kumar', { amount: 50000 }],
  ['Paytm notification', 'Received ₹500 from Ravi Kumar on Paytm. Money added to your bank account', { amount: 50000 }],
  ['BHIM', 'You have received Rs.500.00 from ravi@upi. UPI Ref No.412345678901', { amount: 50000, utr: '412345678901' }],
  ['PhonePe Business', 'Received ₹500 from RAVI on PhonePe. UTR 412345678901', { amount: 50000, utr: '412345678901' }],
];

for (const [name, text, expected] of credits) {
  test(`parser credit: ${name}`, () => {
    const got = parseSms(text);
    assert.equal(got.direction, 'credit', `direction for: ${text}`);
    for (const [k, v] of Object.entries(expected)) assert.equal(got[k], v, `${k} for: ${text}`);
  });
}

const notCredits = [
  ['HDFC debit', 'Sent Rs.500.00 From HDFC Bank A/C *1234 To RAVI KUMAR On 23/10/26 Ref 412345678902 Not You? Call 18002586161'],
  ['failed transaction', 'Your UPI transaction of Rs.500.00 to ravi@okaxis has failed. Ref 412345678901. Amount if debited will be reversed within 48 hours.'],
  ['declined', 'Transaction of Rs 500.00 on your A/c XX1234 was declined. UPI Ref 412345678901'],
  ['credit failed / not credited', 'Rs 500.00 could not be credited to your A/c XX1234. UPI Ref 412345678901'],
  ['pending credit', 'Your credit of Rs 500 received from RAVI is pending. UPI Ref 412345678901'],
  ['mandate created', 'Your UPI AutoPay mandate for Rs 499.00 for NETFLIX is successfully created. Rs 499.00 will be debited on 23-10-26'],
  ['mandate execution', 'UPI-Mandate: Rs 499 received request from NETFLIX, will be debited on 23-10-26'],
  ['autopay credited-looking', 'AutoPay of Rs 499 credited to your Netflix subscription'],
  ['collect request', 'ravi@okaxis has requested Rs 500 from you. Approve on BHIM to pay.'],
  ['collect request 2', 'You have a collect request of Rs.500 from ravi@okaxis. Received at 10:20.'],
  ['GPay request', 'Ravi requested ₹500 from you on Google Pay'],
  ['cashback', 'Congrats! Cashback of Rs 50 credited to your Paytm wallet'],
  ['cashback won', "You've won ₹50 cashback! It has been credited to your account."],
  ['OTP', '123456 is your OTP for UPI txn of Rs 500 received. Do not share.'],
  ['OTP 2', 'OTP for receiving Rs 500.00 credited to A/c XX12 is 482913'],
  ['promo win', 'Win Rs 500! Pay your bills via UPI and get assured cashback upto Rs 500 credited to your account. T&C'],
  ['promo loan', 'Pre-approved loan of Rs 5,00,000 credited instantly! Apply now: bit.ly/xyz'],
  ['refund to you', 'Refund of Rs 500.00 credited to your A/c XX1234 for UPI Ref 412345678901'],
  ['reversal', 'Rs 500.00 reversed and credited to your A/c XX1234 towards UPI Ref 412345678901'],
  ['balance only', 'Avl Bal in A/c XX1234 is INR 5,000.00 on 23-10-26'],
  ['credit card payment received', 'Payment of Rs 5,000 received towards your HDFC Bank Credit Card XX1234. Thank you.'],
  ['interest credited', 'Interest of Rs 120.00 credited to your SB A/c XX1234 on 30-09-26'],
  ['salary credited', 'Salary of Rs 50,000.00 credited to your A/c XX1234 by ACME CORP'],
  ['future credit', 'Rs 500 will be credited to your account XX1234 by 25-10-26'],
  ['bill paid', 'Your electricity bill payment of Rs 500.00 has been received. Ref 412345678901'],
];

for (const [name, text] of notCredits) {
  test(`parser not-credit: ${name}`, () => {
    assert.notEqual(parseSms(text).direction, 'credit', text);
  });
}

test('parser: phone numbers / customer ids in footers are not UTRs', () => {
  const r = parseSms('INR 499.01 credited to A/c no. XX1234 on 23-10-26. Info- UPI/P2A/RAVI KUMAR. SMS BLOCKUPI Cust ID to 919951860002 Axis Bank');
  assert.equal(r.direction, 'credit');
  assert.equal(r.utr, null);
});

test('parser: huge input is clipped and does not hang', () => {
  const t0 = Date.now();
  const r = parseSms('Rs 500 credited '.padEnd(200_000, 'a.b@c '));
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(r.amount, 50000);
});
