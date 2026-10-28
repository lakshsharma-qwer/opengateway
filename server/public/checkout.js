/*!
 * OpenGateway Checkout SDK
 *
 *   <script src="https://YOUR_GATEWAY/checkout.js"></script>
 *   const og = new OpenGateway({
 *     session_id: order.payment_session_id,
 *     mode: "modal",            // or "redirect"
 *     onSuccess: (r) => {},     // { order_id, payment_id, signature, status }
 *     onFailure: (r) => {},     // { order_id, status }
 *     onClose:   () => {}
 *   });
 *   og.open();
 */
(function (global) {
  'use strict';

  var BAKED_BASE = '__OG_PUBLIC_URL__';
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var Z = 2147483000;

  function stripSlash(s) { return String(s).replace(/\/+$/, ''); }

  function resolveBase(opts) {
    if (opts && opts.checkout_base) return stripSlash(opts.checkout_base);
    if (BAKED_BASE.indexOf('__OG_') !== 0) return stripSlash(BAKED_BASE);
    try { return new URL(SCRIPT_SRC).origin; } catch (e) { return location.origin; }
  }

  function originOf(url) {
    try { return new URL(url, location.href).origin; } catch (e) { return null; }
  }

  function css(el, styles) { for (var k in styles) el.style[k] = styles[k]; return el; }

  function normalize(d) {
    return {
      order_id: d.order_id || d.og_order_id || null,
      payment_id: d.payment_id || d.og_payment_id || null,
      signature: d.signature || d.og_signature || null,
      status: d.status || d.og_status || null
    };
  }

  function OpenGateway(options) {
    if (!(this instanceof OpenGateway)) return new OpenGateway(options);
    if (!options || !options.session_id) throw new Error('OpenGateway: session_id is required');
    this.options = options;
    this.mode = options.mode === 'redirect' ? 'redirect' : 'modal';
    this.base = resolveBase(options);
    this.checkoutUrl = this.base + '/pay/' + encodeURIComponent(options.session_id);
    this._overlay = null;
    this._prevOverflow = null;
    this._onMessage = this._onMessage.bind(this);
    this._onKey = this._onKey.bind(this);
  }

  OpenGateway.prototype.open = function () {
    if (this.mode === 'redirect') {
      global.location.href = this.checkoutUrl;
      return this;
    }
    if (this._overlay) return this;

    var overlay = css(document.createElement('div'), {
      position: 'fixed', inset: '0', top: '0', left: '0', right: '0', bottom: '0',
      background: 'rgba(17, 12, 34, 0.62)', zIndex: String(Z),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: '0', transition: 'opacity .18s ease'
    });
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'OpenGateway checkout');
    overlay.className = 'opengateway-overlay';

    var spinner = css(document.createElement('div'), {
      width: '42px', height: '42px', borderRadius: '50%',
      border: '4px solid rgba(255,255,255,.25)', borderTopColor: '#ffffff',
      animation: 'og-spin .8s linear infinite', position: 'absolute'
    });
    if (!document.getElementById('og-sdk-style')) {
      var style = document.createElement('style');
      style.id = 'og-sdk-style';
      style.textContent = '@keyframes og-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    var iframe = css(document.createElement('iframe'), {
      width: '100%', height: '100%', border: '0', background: 'transparent',
      position: 'absolute', inset: '0', top: '0', left: '0', opacity: '0', transition: 'opacity .2s ease'
    });
    iframe.src = this.checkoutUrl + '?embed=1';
    iframe.title = 'OpenGateway checkout';
    iframe.allow = 'clipboard-write; payment';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.onload = function () { iframe.style.opacity = '1'; spinner.style.display = 'none'; };

    var self = this;
    var closeBtn = css(document.createElement('button'), {
      position: 'absolute', top: '12px', right: '12px', width: '36px', height: '36px',
      borderRadius: '50%', border: '0', background: 'rgba(255,255,255,.92)', color: '#3b1a63',
      fontSize: '20px', lineHeight: '36px', cursor: 'pointer', zIndex: String(Z + 1),
      boxShadow: '0 2px 8px rgba(0,0,0,.2)'
    });
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close checkout');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function () { self.close(true); };

    overlay.appendChild(spinner);
    overlay.appendChild(iframe);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    this._prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });

    this._overlay = overlay;
    this._iframe = iframe;
    global.addEventListener('message', this._onMessage);
    document.addEventListener('keydown', this._onKey);
    return this;
  };

  OpenGateway.prototype.close = function (notify) {
    if (!this._overlay) return;
    global.removeEventListener('message', this._onMessage);
    document.removeEventListener('keydown', this._onKey);
    if (this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
    document.body.style.overflow = this._prevOverflow || '';
    this._overlay = null;
    this._iframe = null;
    if (notify && typeof this.options.onClose === 'function') this.options.onClose();
  };

  OpenGateway.prototype._onKey = function (e) {
    if (e.key === 'Escape') this.close(true);
  };

  OpenGateway.prototype._onMessage = function (e) {
    if (!this._iframe || e.source !== this._iframe.contentWindow) {
      // Accept only messages from our checkout origin.
      if (e.origin !== originOf(this.checkoutUrl)) return;
    }
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (!d || d.source !== 'opengateway') return;
    var o = this.options;
    var r = normalize(d);
    if (d.type === 'success') {
      this.close(false);
      if (typeof o.onSuccess === 'function') o.onSuccess(r);
    } else if (d.type === 'failure') {
      this.close(false);
      if (typeof o.onFailure === 'function') o.onFailure({ order_id: r.order_id, status: r.status || 'failed' });
    } else if (d.type === 'close') {
      this.close(true);
    }
  };

  OpenGateway.version = '1.0.0';
  global.OpenGateway = OpenGateway;
})(window);
