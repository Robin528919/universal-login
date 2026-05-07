// ==UserScript==
// @name         Universal Login Receiver
// @namespace    https://github.com/Robin528919/universal-login
// @version      1.0.0
// @description  接收来自外部页面的 Cookie 一键植入请求，自动清场并注入完成登录
// @author       Robin528919 <robin528919@gmail.com>
// @homepageURL  https://github.com/Robin528919/universal-login
// @supportURL   https://github.com/Robin528919/universal-login/issues
// @match        *://*/*
// @run-at       document-start
// @grant        GM_cookie
// @license      MIT
// ==/UserScript==

/*
 * ⚠️ 安全告知（用户主动选择的最简模式）
 *
 * 本脚本不做任何自动安全防护：
 *   - 不验证 HMAC 签名
 *   - 不限制 referrer 来源
 *   - 不弹用户确认框
 *   - 不限制路径必须为根
 *   - 不做 nonce / 过期校验
 *
 * 这意味着：任何第三方网站只要诱导你点击形如
 *   <a href="https://x.com/#__ulinject=...">链接</a>
 * 的链接，就会静默把攻击者的 cookie 植入你的浏览器，造成会话固定攻击。
 *
 * 用户已知情并选择以"自我约束（不点不明链接）"作为唯一防护措施。
 * 如需加回防护层，参考 docs/integration/A站接入指南.md。
 */

(function () {
  'use strict';

  const HASH_KEY = '__ulinject';
  const LOG_PREFIX = '[UL-Receiver]';
  const TOAST_TEXT = '正在为你登录...';
  const RELOAD_DELAY_MS = 1000;
  const SUPPORTED_VERSION = 1;

  // ========== 入口：document-start 立即检测 ==========
  const payload = parseHashPayload();
  if (!payload) return;

  console.log(LOG_PREFIX, '检测到注入请求', { cookieField: typeof payload.cookies });

  // 立即清掉 hash，避免 reload 时重复触发、避免被书签/历史泄露
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    console.warn(LOG_PREFIX, 'replaceState 失败:', e);
  }

  runInjectionPipeline(payload).catch((e) => {
    console.error(LOG_PREFIX, '流水线异常:', e);
  });

  // ========== Hash 解析 ==========
  function parseHashPayload() {
    const hash = location.hash || '';
    const m = hash.match(new RegExp('[#&]' + HASH_KEY + '=([^&]+)'));
    if (!m) return null;

    let json;
    try {
      // 防御：A 站若错误地对 payload 做了 encodeURIComponent，先尝试解一次
      let raw = m[1];
      try { raw = decodeURIComponent(raw); } catch (_) { /* 不是 percent-encoded，原样使用 */ }

      let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      // 兼容 UTF-8（cookie 值里偶尔有非 ASCII）
      json = decodeURIComponent(
        Array.prototype.map.call(binary, (c) =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
    } catch (e) {
      console.error(LOG_PREFIX, 'base64 解码失败:', e);
      return null;
    }

    let obj;
    try {
      obj = JSON.parse(json);
    } catch (e) {
      console.error(LOG_PREFIX, 'JSON 解析失败:', e);
      return null;
    }

    if (!obj || typeof obj !== 'object') {
      console.warn(LOG_PREFIX, 'payload 非对象');
      return null;
    }
    if (obj.v !== SUPPORTED_VERSION) {
      console.warn(LOG_PREFIX, '不支持的 payload 版本:', obj.v);
      return null;
    }
    if (!obj.cookies || (typeof obj.cookies !== 'string' && !Array.isArray(obj.cookies))) {
      console.warn(LOG_PREFIX, 'payload.cookies 缺失或类型错误');
      return null;
    }
    return obj;
  }

  // ========== Cookie 解析（兼容字符串与数组） ==========
  function parseCookies(input) {
    if (Array.isArray(input)) {
      return input
        .filter((c) => c && typeof c.name === 'string' && c.name.length > 0)
        .map((c) => ({
          name: String(c.name),
          value: String(c.value == null ? '' : c.value),
          domain: c.domain ? String(c.domain) : null,
          path: c.path ? String(c.path) : null,
        }));
    }
    if (typeof input === 'string') {
      return parseCookieString(input);
    }
    return [];
  }

  function parseCookieString(input) {
    const ATTRS = new Set([
      'path', 'domain', 'expires', 'max-age', 'samesite',
      'secure', 'httponly', 'priority', 'partitioned',
    ]);
    const result = [];
    let current = null;

    const parts = input.split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) {
        // 纯属性如 "Secure"、"HttpOnly"，忽略
        continue;
      }
      const key = part.substring(0, eqIdx).trim();
      const val = part.substring(eqIdx + 1).trim();
      const lower = key.toLowerCase();

      if (ATTRS.has(lower)) {
        if (!current) continue;
        if (lower === 'domain') current.domain = val;
        else if (lower === 'path') current.path = val;
        continue;
      }

      current = { name: key, value: val, domain: null, path: null };
      result.push(current);
    }
    return result;
  }

  // ========== 主流水线 ==========
  async function runInjectionPipeline(payload) {
    const cookies = parseCookies(payload.cookies);
    console.log(LOG_PREFIX, '解析到 cookie 数:', cookies.length);

    if (cookies.length === 0) {
      console.warn(LOG_PREFIX, '无有效 cookie，终止流程');
      return;
    }

    // 1. 清场 —— 在 document-start 阶段尽早执行，赶在网站脚本之前
    await clearAllCookies();
    clearStorage();
    await clearCacheStorage();
    await unregisterServiceWorkers();
    await clearIndexedDB();

    // 2. 注入新 cookie
    const result = await injectCookies(cookies);
    if (result.ok === 0) {
      console.error(LOG_PREFIX, '全部 cookie 注入失败，终止流程不 reload');
      await waitForBody();
      injectToastStyles();
      showToast('登录植入失败：cookie 全部写入失败，请按 F12 查看 Console 日志', 'error');
      return;
    }

    // 3. body 可用时显示 toast
    await waitForBody();
    injectToastStyles();
    const msg = result.ok === result.total
      ? TOAST_TEXT
      : `${TOAST_TEXT}（${result.ok}/${result.total} 条注入成功）`;
    showToast(msg);

    // 4. 短暂展示后 reload
    setTimeout(() => {
      console.log(LOG_PREFIX, '即将 reload');
      location.reload();
    }, RELOAD_DELAY_MS);
  }

  // ========== 清场逻辑 ==========
  function getCurrentDomain() {
    return location.hostname;
  }

  function getDomainVariants(hostname) {
    const parts = hostname.split('.');
    const variants = [hostname, '.' + hostname];
    if (parts.length > 2) {
      const parent = parts.slice(1).join('.');
      variants.push(parent, '.' + parent);
    }
    return variants;
  }

  function hasGMCookieAPI() {
    return typeof GM_cookie !== 'undefined'
      && typeof GM_cookie.list === 'function'
      && typeof GM_cookie.delete === 'function'
      && typeof GM_cookie.set === 'function';
  }

  function deleteCookieViaGMSingle(details) {
    return new Promise((resolve) => {
      try {
        GM_cookie.delete(details, (error) => resolve({ ok: !error, error }));
      } catch (e) {
        resolve({ ok: false, error: e });
      }
    });
  }

  async function deleteCookieViaGM(name, domain, path) {
    const cleanDomain = (domain || getCurrentDomain()).replace(/^\./, '');
    const cleanPath = path || '/';
    const attempts = [
      { name, url: 'https://' + cleanDomain + cleanPath },
      { name, url: 'http://' + cleanDomain + cleanPath },
      { name, url: 'https://' + cleanDomain + '/' },
      { name, url: 'http://' + cleanDomain + '/' },
      { name },
    ];
    for (const d of attempts) {
      const r = await deleteCookieViaGMSingle(d);
      if (r.ok) return true;
    }
    return false;
  }

  function listCookiesViaGM(filter) {
    return new Promise((resolve) => {
      try {
        GM_cookie.list(filter, (cookies, error) => {
          if (error) console.warn(LOG_PREFIX, 'list error:', error);
          resolve(cookies || []);
        });
      } catch (e) {
        console.warn(LOG_PREFIX, 'list 抛出:', e);
        resolve([]);
      }
    });
  }

  // 已知大站常用 auth cookie，GM_cookie.list 可能列举不到（HttpOnly），
  // 但 GM_cookie.delete 仍能删除。清场时按域名变体暴力尝试
  const KNOWN_AUTH_COOKIES = [
    'auth_token', 'twid', 'ct0', 'att', '_twitter_sess',
    '__cf_bm', 'cf_clearance', '_cfuvid',
    'JSESSIONID', 'PHPSESSID', 'connect.sid', 'sid', 'session',
    'ASP.NET_SessionId', 'sessionid', 'csrftoken', 'ds_user_id',
  ];

  async function clearAllCookies() {
    const hostname = getCurrentDomain();
    const domains = getDomainVariants(hostname);

    if (hasGMCookieAPI()) {
      const found = new Map();
      for (const d of domains) {
        const list = await listCookiesViaGM({ domain: d });
        for (const c of list) {
          found.set(c.name + '|' + c.domain + '|' + c.path, c);
        }
      }
      const all = await listCookiesViaGM({});
      for (const c of all) {
        const cd = (c.domain || '').replace(/^\./, '');
        if (hostname === cd || hostname.endsWith('.' + cd) || cd.endsWith('.' + hostname)) {
          found.set(c.name + '|' + c.domain + '|' + c.path, c);
        }
      }
      console.log(LOG_PREFIX, '待清除 cookie 数(GM):', found.size);
      for (const c of found.values()) {
        await deleteCookieViaGM(c.name, c.domain, c.path);
      }

      // 暴力删除已知 auth cookie（HttpOnly 可能不在 list 结果里）
      for (const name of KNOWN_AUTH_COOKIES) {
        for (const d of domains) {
          await deleteCookieViaGM(name, d, '/');
        }
      }
      console.log(LOG_PREFIX, '暴力删除已知 auth cookie 完成');
    }

    // document.cookie 兜底
    const docCookieNames = (document.cookie || '')
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean);
    for (const name of docCookieNames) {
      for (const d of domains) {
        for (const p of ['/', location.pathname || '/']) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}; domain=${d}`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}`;
        }
      }
    }
    console.log(LOG_PREFIX, 'cookie 清场完成');
  }

  async function clearIndexedDB() {
    if (!window.indexedDB || typeof window.indexedDB.databases !== 'function') return;
    try {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }
      if (dbs.length > 0) {
        console.log(LOG_PREFIX, '清理 IndexedDB:', dbs.length);
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'IndexedDB 清理失败:', e);
    }
  }

  function clearStorage() {
    try { localStorage.clear(); } catch (e) { /* may be blocked */ }
    try { sessionStorage.clear(); } catch (e) { /* may be blocked */ }
    console.log(LOG_PREFIX, 'storage 清场完成');
  }

  async function clearCacheStorage() {
    if (!('caches' in window)) return;
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      console.log(LOG_PREFIX, 'cache storage 清场:', names.length);
    } catch (e) {
      console.warn(LOG_PREFIX, 'cache 清场失败:', e);
    }
  }

  async function unregisterServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (regs.length > 0) {
        console.log(LOG_PREFIX, '注销 SW:', regs.length);
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'SW 注销失败:', e);
    }
  }

  // ========== 注入逻辑 ==========
  // 已知 HttpOnly cookie 名单。注意：_ga / _gid / csrftoken / ct0 等是 JS 可读的，
  // 不能误标 HttpOnly，否则会破坏目标站脚本读取这些值的能力
  const HTTPONLY_HINT = new Set([
    'auth_token', 'twid', '__cf_bm',
    'sess', 'session', 'sid', 'JSESSIONID',
    'connect.sid', 'PHPSESSID', 'ASP.NET_SessionId',
    'sessionid', 'ds_user_id',
  ]);

  // 二级 TLD 白名单（不完整但覆盖常见情况）；命中后不再上升一级
  const TWO_PART_TLDS = new Set([
    'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.in', 'co.il', 'co.id',
    'com.au', 'com.br', 'com.cn', 'com.hk', 'com.tw', 'com.mx', 'com.sg', 'com.tr',
    'org.uk', 'net.uk', 'me.uk', 'gov.uk', 'ac.uk',
    'or.jp', 'ne.jp', 'ac.jp',
  ]);

  function getTargetDomain(cookieDomain) {
    if (cookieDomain) return '.' + cookieDomain.replace(/^\./, '');
    const hostname = getCurrentDomain();
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const tail2 = parts.slice(-2).join('.');
      // example.co.uk（3 段且尾部是二级 TLD）→ 保留完整域，不能再上升到 .co.uk
      if (parts.length === 3 && TWO_PART_TLDS.has(tail2)) {
        return '.' + hostname;
      }
      // 普通 sub.example.com → .example.com
      // 或 a.b.example.co.uk → .b.example.co.uk
      return '.' + parts.slice(1).join('.');
    }
    return '.' + hostname;
  }

  function setCookieViaGM(cookie) {
    return new Promise((resolve, reject) => {
      const domain = getTargetDomain(cookie.domain);
      const path = cookie.path || '/';
      const cleanDomain = domain.replace(/^\./, '');
      const url = `${location.protocol}//${cleanDomain}${path}`;
      const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

      try {
        GM_cookie.set({
          url,
          name: cookie.name,
          value: cookie.value,
          domain,
          path,
          secure: location.protocol === 'https:',
          httpOnly: HTTPONLY_HINT.has(cookie.name),
          expirationDate,
          sameSite: 'lax',
        }, (error) => {
          if (error) reject(new Error(String(error)));
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function setCookieViaDocument(cookie) {
    const domain = getTargetDomain(cookie.domain);
    const parts = [`${cookie.name}=${cookie.value}`];
    parts.push(`path=${cookie.path || '/'}`);
    parts.push(`domain=${domain}`);
    parts.push(`expires=${new Date(Date.now() + 365 * 86400000).toUTCString()}`);
    if (location.protocol === 'https:') parts.push('Secure');
    document.cookie = parts.join('; ');
  }

  async function injectCookies(cookies) {
    const useGM = hasGMCookieAPI();
    console.log(LOG_PREFIX, '注入模式:', useGM ? 'GM_cookie' : 'document.cookie');
    if (!useGM) {
      console.warn(LOG_PREFIX, 'GM_cookie 不可用，使用 document.cookie 兜底（HttpOnly cookie 无法注入；请检查 @grant GM_cookie 权限）');
    }

    let ok = 0;
    const errors = [];
    for (const c of cookies) {
      try {
        if (useGM) await setCookieViaGM(c);
        else setCookieViaDocument(c);
        ok++;
      } catch (e) {
        errors.push({ name: c.name, error: String(e && e.message || e) });
      }
    }
    console.log(LOG_PREFIX, `注入结果: ${ok}/${cookies.length}`, errors.length ? errors : '');
    return { ok, total: cookies.length, errors };
  }

  // ========== Toast UI ==========
  function waitForBody() {
    return new Promise((resolve) => {
      if (document.body) return resolve();
      const obs = new MutationObserver(() => {
        if (document.body) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      // 补检：消除 if(body) 与 observe() 之间的竞争窗口
      if (document.body) {
        obs.disconnect();
        resolve();
      }
    });
  }

  function injectToastStyles() {
    if (document.getElementById('ulr-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'ulr-toast-style';
    style.textContent = `
      .ulr-toast {
        position: fixed;
        top: 24px;
        right: 24px;
        padding: 14px 22px;
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 2147483647;
        box-shadow: 0 8px 28px rgba(102, 126, 234, 0.45);
        opacity: 0;
        transform: translateY(-12px);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      }
      .ulr-toast.ulr-show {
        opacity: 1;
        transform: translateY(0);
      }
      .ulr-toast.ulr-error {
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        box-shadow: 0 8px 28px rgba(239, 68, 68, 0.5);
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showToast(text, type) {
    try {
      const el = document.createElement('div');
      el.className = 'ulr-toast' + (type === 'error' ? ' ulr-error' : '');
      el.textContent = text;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('ulr-show'));
    } catch (e) {
      console.warn(LOG_PREFIX, 'toast 显示失败:', e);
    }
  }
})();
