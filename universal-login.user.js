// ==UserScript==
// @name         Universal Login - Cookie Manager
// @namespace    https://github.com/universal-login
// @version      1.2.0
// @description  清理网站Cookies/缓存，批量导入Cookies实现快速登录
// @author       You
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_cookie
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ========== 样式 ==========
  GM_addStyle(`
    #ul-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      display: none;
    }
    #ul-panel {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      max-height: 85vh;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: none;
      overflow: hidden;
    }
    #ul-panel * {
      box-sizing: border-box;
    }
    .ul-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
    .ul-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .ul-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      opacity: 0.8;
    }
    .ul-close:hover { opacity: 1; }
    .ul-body {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(85vh - 52px);
    }
    .ul-section {
      margin-bottom: 16px;
    }
    .ul-section:last-child {
      margin-bottom: 0;
    }
    .ul-section-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ul-info {
      background: #f0f4ff;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #4338ca;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .ul-btn-group {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .ul-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      flex: 1;
      min-width: 120px;
      text-align: center;
    }
    .ul-btn:active {
      transform: scale(0.97);
    }
    .ul-btn-danger {
      background: #fee2e2;
      color: #dc2626;
    }
    .ul-btn-danger:hover {
      background: #fecaca;
    }
    .ul-btn-danger-solid {
      background: #dc2626;
      color: #fff;
    }
    .ul-btn-danger-solid:hover {
      background: #b91c1c;
    }
    .ul-btn-primary {
      background: #667eea;
      color: #fff;
    }
    .ul-btn-primary:hover {
      background: #5a6fd6;
    }
    .ul-btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .ul-btn-secondary:hover {
      background: #e5e7eb;
    }
    .ul-btn-success {
      background: #059669;
      color: #fff;
    }
    .ul-btn-success:hover {
      background: #047857;
    }
    .ul-textarea {
      width: 100%;
      min-height: 100px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
      line-height: 1.6;
      color: #1f2937;
    }
    .ul-textarea:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }
    .ul-textarea::placeholder {
      color: #9ca3af;
    }
    .ul-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 16px 0;
    }
    .ul-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: none;
    }
    .ul-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .ul-toast-success { background: #059669; }
    .ul-toast-error { background: #dc2626; }
    .ul-toast-info { background: #2563eb; }
    .ul-cookie-list {
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .ul-cookie-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 12px;
      font-family: "SF Mono", Monaco, monospace;
    }
    .ul-cookie-item:last-child {
      border-bottom: none;
    }
    .ul-cookie-name {
      color: #6d28d9;
      font-weight: 600;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ul-cookie-value {
      color: #6b7280;
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 8px;
      flex: 1;
    }
    .ul-count {
      display: inline-block;
      background: #667eea;
      color: #fff;
      border-radius: 10px;
      padding: 1px 8px;
      font-size: 12px;
      margin-left: 6px;
      font-weight: 600;
    }
    .ul-footer {
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      padding-top: 8px;
    }
  `);

  // ========== 工具函数 ==========
  function showToast(message, type = 'success') {
    const existing = document.getElementById('ul-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ul-toast';
    toast.className = `ul-toast ul-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function getCurrentDomain() {
    return location.hostname;
  }

  function getDomainVariants(hostname) {
    const parts = hostname.split('.');
    const variants = [hostname];
    variants.push('.' + hostname);
    if (parts.length > 2) {
      const parent = parts.slice(1).join('.');
      variants.push(parent);
      variants.push('.' + parent);
    }
    return variants;
  }

  // ========== Cookie 操作 ==========
  function getCurrentCookies() {
    const cookieStr = document.cookie;
    if (!cookieStr) return [];
    return cookieStr.split(';').map(c => {
      const [name, ...rest] = c.trim().split('=');
      return { name: name.trim(), value: rest.join('=') };
    }).filter(c => c.name);
  }

  const LOG_PREFIX = '[CookieManager]';

  /**
   * 通过 GM_cookie.delete 删除单个 cookie，尝试多种 URL 策略
   */
  function deleteCookieViaGMSingle(details) {
    return new Promise((resolve) => {
      GM_cookie.delete(details, (error) => {
        resolve({ ok: !error, error, details });
      });
    });
  }

  async function deleteCookieViaGM(name, domain, path) {
    const cleanDomain = (domain || getCurrentDomain()).replace(/^\./, '');
    const cleanPath = path || '/';

    // 多种 URL 策略，逐个尝试直到成功
    const attempts = [
      { name, url: 'https://' + cleanDomain + cleanPath },
      { name, url: 'http://' + cleanDomain + cleanPath },
      { name, url: 'https://' + cleanDomain + '/' },
      { name, url: 'http://' + cleanDomain + '/' },
      { name },  // 不传 url，使用默认（当前页面 URL）
    ];

    for (const details of attempts) {
      const result = await deleteCookieViaGMSingle(details);
      if (result.ok) {
        console.log(LOG_PREFIX, 'deleted:', name, details.url || '(default)');
        return true;
      }
    }
    console.warn(LOG_PREFIX, 'all attempts failed for:', name, domain, path);
    return false;
  }

  function listCookiesViaGM(filter) {
    return new Promise((resolve) => {
      GM_cookie.list(filter, (cookies, error) => {
        if (error) {
          console.warn(LOG_PREFIX, 'list error:', error, 'filter:', filter);
        }
        resolve(cookies || []);
      });
    });
  }

  function hasGMCookieAPI() {
    const has = typeof GM_cookie !== 'undefined'
      && typeof GM_cookie.list === 'function'
      && typeof GM_cookie.delete === 'function';
    console.log(LOG_PREFIX, 'GM_cookie available:', has);
    return has;
  }

  async function clearAllCookies() {
    const hostname = getCurrentDomain();
    const domains = getDomainVariants(hostname);
    const paths = ['/', '', location.pathname];
    const canGM = hasGMCookieAPI();
    let count = 0;

    if (canGM) {
      // 第一步：按域名变体查询所有 cookie
      const allFound = new Map(); // key -> cookie object
      for (const domain of domains) {
        const cookies = await listCookiesViaGM({ domain });
        console.log(LOG_PREFIX, `list({ domain: "${domain}" }) =>`, cookies.length, 'cookies');
        for (const c of cookies) {
          allFound.set(`${c.name}|${c.domain}|${c.path}`, c);
        }
      }

      // 补充：不带过滤查全部，按域名匹配过滤
      const everything = await listCookiesViaGM({});
      console.log(LOG_PREFIX, 'list({}) =>', everything.length, 'total cookies');
      for (const c of everything) {
        const d = (c.domain || '').replace(/^\./, '');
        if (hostname === d || hostname.endsWith('.' + d) || d.endsWith('.' + hostname)) {
          allFound.set(`${c.name}|${c.domain}|${c.path}`, c);
        }
      }

      console.log(LOG_PREFIX, 'unique cookies to delete:', allFound.size);

      // 第二步：逐个删除
      for (const c of allFound.values()) {
        await deleteCookieViaGM(c.name, c.domain, c.path);
        count++;
      }

      // 第三步：GM_cookie.list 可能看不到 HttpOnly cookie
      // 直接对已知的常见 auth cookie 名暴力删除
      const knownAuthCookies = [
        'auth_token', 'twid', 'ct0', 'att', '_twitter_sess',
        '__cf_bm', 'cf_clearance', '_cf_bm',
        'JSESSIONID', 'PHPSESSID', 'connect.sid', 'sid', 'session',
        'ASP.NET_SessionId', '_ga', '_gid', '_gcl_au',
        '_cfuvid', '_uetvid', '_mkto_trk'
      ];
      const baseUrl = location.protocol + '//' + hostname;
      for (const name of knownAuthCookies) {
        // 尝试多种 URL + domain 组合
        for (const domain of domains) {
          const cleanDomain = domain.replace(/^\./, '');
          const urls = [
            'https://' + cleanDomain + '/',
            'http://' + cleanDomain + '/'
          ];
          for (const url of urls) {
            await new Promise(resolve => {
              GM_cookie.delete({ url, name }, () => resolve());
            });
          }
        }
        count++;
      }
      console.log(LOG_PREFIX, 'brute-force deleted', knownAuthCookies.length, 'known auth cookie names');

      // 验证
      await new Promise(r => setTimeout(r, 500));
      const realCheck = await listCookiesViaGM({ domain: hostname });
      console.log(LOG_PREFIX, '=== REAL VERIFY ===', realCheck.length, 'remaining from list');
      console.log(LOG_PREFIX, 'document.cookie after clear:', document.cookie || '(empty)');
    }

    // 用 document.cookie 补充清除
    const docCookies = getCurrentCookies();
    console.log(LOG_PREFIX, 'document.cookie has:', docCookies.length, 'cookies');
    for (const cookie of docCookies) {
      for (const domain of domains) {
        for (const path of paths) {
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`;
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}; Secure`;
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; Secure`;
        }
      }
      if (canGM) {
        for (const domain of domains) {
          await deleteCookieViaGM(cookie.name, domain, '/');
        }
      }
      count++;
    }

    // 清除 Service Worker（可能缓存了认证状态）
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      if (registrations.length > 0) {
        console.log(LOG_PREFIX, 'unregistered', registrations.length, 'service workers');
      }
    }

    // 清除 IndexedDB（可能存储了 token）
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      try {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
        if (dbs.length > 0) {
          console.log(LOG_PREFIX, 'deleted', dbs.length, 'IndexedDB databases');
        }
      } catch (_) { /* ignore */ }
    }

    console.log(LOG_PREFIX, 'clearAllCookies done, total operations:', count);
    return count;
  }

  function clearStorage() {
    const cleared = { localStorage: 0, sessionStorage: 0 };
    try {
      cleared.localStorage = localStorage.length;
      localStorage.clear();
    } catch (_) { /* ignore */ }
    try {
      cleared.sessionStorage = sessionStorage.length;
      sessionStorage.clear();
    } catch (_) { /* ignore */ }
    return cleared;
  }

  async function clearCacheStorage() {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
      return names.length;
    }
    return 0;
  }

  /**
   * 解析 cookie 字符串，支持多种格式：
   * - 标准格式: name=value; name2=value2
   * - 带属性格式: name=value;Path=/;Domain=x.com;name2=value2
   */
  function parseCookieString(input) {
    const result = [];
    if (!input || !input.trim()) return result;

    const str = input.trim();

    const ATTRS = new Set([
      'path', 'domain', 'expires', 'max-age', 'samesite',
      'secure', 'httponly', 'priority', 'partitioned'
    ]);

    const parts = str.split(';').map(p => p.trim()).filter(Boolean);
    let currentCookie = null;

    for (const part of parts) {
      const eqIdx = part.indexOf('=');

      if (eqIdx === -1) {
        if (ATTRS.has(part.toLowerCase())) {
          continue;
        }
        continue;
      }

      const key = part.substring(0, eqIdx).trim();
      const val = part.substring(eqIdx + 1).trim();

      if (ATTRS.has(key.toLowerCase())) {
        if (key.toLowerCase() === 'domain' && currentCookie) {
          currentCookie.domain = val;
        }
        if (key.toLowerCase() === 'path' && currentCookie) {
          currentCookie.path = val;
        }
        if (key.toLowerCase() === 'max-age' && currentCookie) {
          currentCookie.maxAge = val;
        }
        if (key.toLowerCase() === 'samesite' && currentCookie) {
          currentCookie.sameSite = val;
        }
        continue;
      }

      currentCookie = { name: key, value: val };
      result.push(currentCookie);
    }

    return result;
  }

  const HTTPONLY_COOKIES = new Set([
    'auth_token', 'twid', '__cf_bm', '_ga', '_gid',
    'sess', 'session', 'sid', 'JSESSIONID',
    'connect.sid', 'PHPSESSID', 'ASP.NET_SessionId'
  ]);

  function hasGMCookie() {
    return typeof GM_cookie !== 'undefined' && typeof GM_cookie.set === 'function';
  }

  /**
   * 获取 cookie 应该注入的唯一目标域名
   * - 有 Domain 属性 → 用 .domain（覆盖所有子域名）
   * - 无 Domain 属性 → 用 .父级域名（覆盖子域名）
   * 只写入一个域名，避免重复 cookie 导致服务器验证失败
   */
  function getTargetDomain(cookieDomain) {
    if (cookieDomain) {
      const cleaned = cookieDomain.replace(/^\./, '');
      return '.' + cleaned;
    }
    const hostname = getCurrentDomain();
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return '.' + parts.slice(1).join('.');
    }
    return '.' + hostname;
  }

  function setCookieViaGM(cookie) {
    return new Promise((resolve, reject) => {
      const domain = getTargetDomain(cookie.domain);
      const path = cookie.path || '/';
      const expirationDate = cookie.maxAge
        ? Math.floor(Date.now() / 1000) + parseInt(cookie.maxAge, 10)
        : Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

      // 构造正确的 URL 供 GM_cookie 使用
      const cleanDomain = domain.replace(/^\./, '');
      const url = `${location.protocol}//${cleanDomain}${path}`;

      GM_cookie.set({
        url: url,
        name: cookie.name,
        value: cookie.value,
        domain: domain,
        path: path,
        secure: location.protocol === 'https:',
        httpOnly: HTTPONLY_COOKIES.has(cookie.name),
        expirationDate: expirationDate,
        sameSite: cookie.sameSite || 'lax'
      }, (error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      });
    });
  }

  function setCookieViaDocument(cookie) {
    const domain = getTargetDomain(cookie.domain);
    const cookieParts = [`${cookie.name}=${cookie.value}`];
    cookieParts.push(`path=${cookie.path || '/'}`);
    cookieParts.push(`domain=${domain}`);

    if (cookie.maxAge) {
      cookieParts.push(`max-age=${cookie.maxAge}`);
    } else {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      cookieParts.push(`expires=${expires}`);
    }

    if (cookie.sameSite) {
      cookieParts.push(`SameSite=${cookie.sameSite}`);
    }

    document.cookie = cookieParts.join('; ');
  }

  async function injectCookies(cookieStr) {
    const cookies = parseCookieString(cookieStr);
    if (cookies.length === 0) {
      return { success: false, count: 0, message: '未解析到有效的Cookie' };
    }

    const useGM = hasGMCookie();
    let successCount = 0;
    const errors = [];

    for (const cookie of cookies) {
      try {
        if (useGM) {
          await setCookieViaGM(cookie);
        } else {
          setCookieViaDocument(cookie);
        }
        successCount++;
      } catch (e) {
        errors.push(`${cookie.name}: ${e.message}`);
      }
    }

    const methodNote = useGM ? '(GM_cookie模式)' : '(document.cookie模式)';
    return {
      success: successCount > 0,
      count: successCount,
      total: cookies.length,
      errors,
      message: errors.length > 0
        ? `${methodNote} 注入 ${successCount}/${cookies.length} 个Cookie，${errors.length} 个失败`
        : `${methodNote} 成功注入 ${successCount} 个Cookie`
    };
  }

  function exportCookies() {
    const cookies = getCurrentCookies();
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  // ========== UI ==========
  function createPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'ul-overlay';
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.id = 'ul-panel';

    const cookies = getCurrentCookies();

    panel.innerHTML = `
      <div class="ul-header">
        <h2>Cookie Manager</h2>
        <button class="ul-close" id="ul-close-btn">&times;</button>
      </div>
      <div class="ul-body">
        <div class="ul-info">
          当前域名: <strong>${getCurrentDomain()}</strong> &nbsp;|&nbsp;
          引擎: <strong>${hasGMCookie() ? 'GM_cookie (HttpOnly)' : 'document.cookie'}</strong>
        </div>

        <!-- Cookie 列表 -->
        <div class="ul-section">
          <div class="ul-section-title">Cookie 列表 <span class="ul-count" id="ul-cookie-count">${cookies.length}</span></div>
          ${cookies.length > 0
            ? `<div class="ul-cookie-list" id="ul-cookie-list">
                ${cookies.map(c => `
                  <div class="ul-cookie-item">
                    <span class="ul-cookie-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
                    <span class="ul-cookie-value" title="${escapeHtml(c.value)}">${escapeHtml(c.value)}</span>
                  </div>
                `).join('')}
              </div>
              <div class="ul-btn-group">
                <button class="ul-btn ul-btn-secondary" id="ul-export-btn">导出 Cookie</button>
                <button class="ul-btn ul-btn-secondary" id="ul-refresh-btn">刷新列表</button>
              </div>`
            : '<div style="text-align:center;color:#9ca3af;padding:16px;">当前网站没有 Cookie</div>'
          }
        </div>

        <div class="ul-divider"></div>

        <!-- 清理 -->
        <div class="ul-section">
          <div class="ul-section-title">清理</div>
          <div class="ul-btn-group">
            <button class="ul-btn ul-btn-danger" id="ul-clear-cookies-btn">清除所有 Cookie</button>
            <button class="ul-btn ul-btn-danger" id="ul-clear-storage-btn">清除 Storage</button>
          </div>
          <div style="height:10px"></div>
          <div class="ul-btn-group">
            <button class="ul-btn ul-btn-danger" id="ul-clear-cache-btn">清除 Cache Storage</button>
            <button class="ul-btn ul-btn-danger-solid" id="ul-clear-all-btn">一键清除全部</button>
          </div>
        </div>

        <div class="ul-divider"></div>

        <!-- 导入 Cookie -->
        <div class="ul-section">
          <div class="ul-section-title">导入 Cookie</div>
          <textarea class="ul-textarea" id="ul-cookie-input" placeholder="粘贴 Cookie 字符串，例如:&#10;auth_token=abc123; guest_id=v1:123;&#10;Path=/; Domain=x.com; ct0=xyz789"></textarea>
          <div style="height:10px"></div>
          <div class="ul-btn-group">
            <button class="ul-btn ul-btn-primary" id="ul-inject-btn">导入 Cookie</button>
            <button class="ul-btn ul-btn-success" id="ul-inject-reload-btn">导入并刷新页面</button>
          </div>
        </div>

        <div class="ul-footer">快捷键 Alt+C 打开 &nbsp;|&nbsp; ESC 关闭</div>
      </div>
    `;

    document.body.appendChild(panel);
    bindEvents(panel, overlay);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function bindEvents(panel, overlay) {
    const closePanel = () => {
      panel.style.display = 'none';
      overlay.style.display = 'none';
    };

    panel.querySelector('#ul-close-btn').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // 导出
    const exportBtn = panel.querySelector('#ul-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const cookieStr = exportCookies();
        navigator.clipboard.writeText(cookieStr).then(() => {
          showToast('Cookie 已复制到剪贴板');
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = cookieStr;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          showToast('Cookie 已复制到剪贴板');
        });
      });
    }

    // 刷新列表
    const refreshBtn = panel.querySelector('#ul-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        closePanel();
        destroyPanel();
        createPanel();
        openPanel();
        showToast('列表已刷新', 'info');
      });
    }

    // 清除 Cookie
    panel.querySelector('#ul-clear-cookies-btn').addEventListener('click', async () => {
      const count = await clearAllCookies();
      showToast(`已清除 ${count} 个 Cookie`);
      refreshCookieList(panel);
    });

    // 清除 Storage
    panel.querySelector('#ul-clear-storage-btn').addEventListener('click', () => {
      const result = clearStorage();
      showToast(`已清除 localStorage(${result.localStorage}) + sessionStorage(${result.sessionStorage})`);
    });

    // 清除 Cache
    panel.querySelector('#ul-clear-cache-btn').addEventListener('click', async () => {
      const count = await clearCacheStorage();
      showToast(`已清除 ${count} 个 Cache Storage`);
    });

    // 一键清除
    panel.querySelector('#ul-clear-all-btn').addEventListener('click', async () => {
      const cookieCount = await clearAllCookies();
      const storageResult = clearStorage();
      const cacheCount = await clearCacheStorage();
      showToast(`已清除: Cookie(${cookieCount}) + Storage(${storageResult.localStorage + storageResult.sessionStorage}) + Cache(${cacheCount})`);
      refreshCookieList(panel);
    });

    // 导入 Cookie
    panel.querySelector('#ul-inject-btn').addEventListener('click', async () => {
      const input = panel.querySelector('#ul-cookie-input').value;
      const result = await injectCookies(input);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        refreshCookieList(panel);
      }
    });

    // 导入并刷新
    panel.querySelector('#ul-inject-reload-btn').addEventListener('click', async () => {
      const input = panel.querySelector('#ul-cookie-input').value;
      const result = await injectCookies(input);
      if (result.success) {
        showToast(result.message + '，即将刷新页面...');
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(result.message, 'error');
      }
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.style.display !== 'none') {
        closePanel();
      }
    });
  }

  function refreshCookieList(panel) {
    const cookies = getCurrentCookies();
    const countEl = panel.querySelector('#ul-cookie-count');
    if (countEl) countEl.textContent = cookies.length;

    const listEl = panel.querySelector('#ul-cookie-list');
    if (listEl) {
      if (cookies.length > 0) {
        listEl.innerHTML = cookies.map(c => `
          <div class="ul-cookie-item">
            <span class="ul-cookie-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
            <span class="ul-cookie-value" title="${escapeHtml(c.value)}">${escapeHtml(c.value)}</span>
          </div>
        `).join('');
      } else {
        listEl.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:16px;">已全部清除</div>';
      }
    }
  }

  function destroyPanel() {
    const panel = document.getElementById('ul-panel');
    const overlay = document.getElementById('ul-overlay');
    if (panel) panel.remove();
    if (overlay) overlay.remove();
  }

  function openPanel() {
    let panel = document.getElementById('ul-panel');
    let overlay = document.getElementById('ul-overlay');
    if (!panel) {
      createPanel();
      panel = document.getElementById('ul-panel');
      overlay = document.getElementById('ul-overlay');
    }
    panel.style.display = 'block';
    overlay.style.display = 'block';
  }

  // ========== 注册菜单 ==========
  GM_registerMenuCommand('Cookie Manager', openPanel);

  // ========== 快捷键 Alt+C ==========
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      openPanel();
    }
  });
})();
