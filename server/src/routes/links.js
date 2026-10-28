/** Payment-link short URLs: GET /l/:code and /l/:code/done. */
import express from 'express';
import { one } from '../db.js';
import { runtime } from '../config.js';
import { checkoutUrl } from '../lib/serialize.js';
import { orderForLink } from '../lib/orders.js';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function linksRouter(ctx) {
  const { db } = ctx;
  const r = express.Router();
  const statusPage = (code) => `${runtime.publicUrl}/link-status/${encodeURIComponent(code)}`;

  r.get('/:code', (req, res) => {
    const link = one(db, 'SELECT * FROM payment_links WHERE code=?', req.params.code);
    if (!link) return res.redirect(302, statusPage(req.params.code));
    let order;
    try {
      order = orderForLink(db, link);
    } catch (err) {
      if (!err?.code) throw err;
      return res.status(err.status || 400).type('html').send(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
         <title>Payment unavailable</title><body style="font-family:system-ui;padding:40px;text-align:center;color:#222">
         <h2 style="color:#5f259f">Payment unavailable</h2><p>${escape(err.message)}</p></body>`);
    }
    if (!order) return res.redirect(302, statusPage(link.code));
    res.redirect(302, checkoutUrl(order.payment_session_id));
  });

  r.get('/:code/done', (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    res.redirect(302, statusPage(req.params.code) + (qs ? `?${qs}` : ''));
  });

  return r;
}
