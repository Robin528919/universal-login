// ==UserScript==
// @name         Universal Login - Cookie Manager
// @namespace    https://github.com/universal-login
// @version      1.1.0
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
      max-height: 80vh;
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
      max-height: calc(80vh - 56px);
    }
    .ul-section {
      margin-bottom: 20px;
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
      padding: 12px 14px;
      font-size: 13px;
      color: #4338ca;
      margin-bottom: 12px;
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
      background: #d1fae5;
      color: #059669;
    }
    .ul-btn-success:hover {
      background: #a7f3d0;
    }
    .ul-textarea {
      width: 100%;
      min-height: 120px;
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
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .ul-cookie-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
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
    .ul-tabs {
      display: flex;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 16px;
    }
    .ul-tab {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
      background: none;
      border-top: none;
      border-left: none;
      border-right: none;
    }
    .ul-tab:hover {
      color: #374151;
    }
    .ul-tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
    .ul-tab-content {
      display: none;
    }
    .ul-tab-content.active {
      display: block;
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
    // 添加带点前缀的域名（用于子域名共享cookie）
    variants.push('.' + hostname);
    // 添加上级域名
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

  function deleteCookieViaGM(name, domain, path) {
    return new Promise((resolve) => {
      GM_cookie.delete({ name, domain, path }, () => resolve());
    });
  }

  async function clearAllCookies() {
    const cookies = getCurrentCookies();
    const domains = getDomainVariants(getCurrentDomain());
    const paths = ['/', '', location.pathname];
    let count = 0;
    const useGM = hasGMCookie();

    for (const cookie of cookies) {
      // 用 document.cookie 清除（非 HttpOnly）
      for (const domain of domains) {
        for (const path of paths) {
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`;
          document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
        }
      }

      // 用 GM_cookie 清除（包括 HttpOnly）
      if (useGM) {
        for (const domain of domains) {
          for (const path of paths) {
            await deleteCookieViaGM(cookie.name, domain, path);
          }
        }
      }
      count++;
    }

    // 如果有 GM_cookie.list，还能获取到 HttpOnly cookie 并清除
    if (useGM && typeof GM_cookie.list === 'function') {
      const allCookies = await new Promise((resolve) => {
        GM_cookie.list({ domain: getCurrentDomain() }, (cookies) => {
          resolve(cookies || []);
        });
      });
      for (const c of allCookies) {
        await deleteCookieViaGM(c.name, c.domain, c.path);
        count++;
      }
    }

    return count;
  }

  function clearStorage() {
    let cleared = { localStorage: 0, sessionStorage: 0 };
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

  function clearCacheStorage() {
    if ('caches' in window) {
      return caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(results => results.length);
    }
    return Promise.resolve(0);
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

    // 已知的 cookie 属性关键字（忽略大小写）
    const ATTRS = new Set([
      'path', 'domain', 'expires', 'max-age', 'samesite',
      'secure', 'httponly', 'priority', 'partitioned'
    ]);

    // 按分号拆分
    const parts = str.split(';').map(p => p.trim()).filter(Boolean);
    let currentCookie = null;

    for (const part of parts) {
      const eqIdx = part.indexOf('=');

      if (eqIdx === -1) {
        // 没有等号，可能是 Secure / HttpOnly 等布尔属性
        if (ATTRS.has(part.toLowerCase())) {
          continue; // 跳过属性
        }
        continue;
      }

      const key = part.substring(0, eqIdx).trim();
      const val = part.substring(eqIdx + 1).trim();

      // 判断是否是 cookie 属性
      if (ATTRS.has(key.toLowerCase())) {
        // 如果是 Domain 属性，记录到当前 cookie
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

      // 否则是一个新的 cookie
      currentCookie = { name: key, value: val };
      result.push(currentCookie);
    }

    return result;
  }

  // 已知需要 HttpOnly 的 cookie 名称（常见网站）
  const HTTPONLY_COOKIES = new Set([
    'auth_token', 'twid', '__cf_bm', '_ga', '_gid',
    'sess', 'session', 'sid', 'JSESSIONID',
    'connect.sid', 'PHPSESSID', 'ASP.NET_SessionId'
  ]);

  function hasGMCookie() {
    return typeof GM_cookie !== 'undefined' && typeof GM_cookie.set === 'function';
  }

  /**
   * 获取 cookie 应该注入的所有域名列表
   * 例如当前 hostname=www.x.com, cookie.domain=x.com 时:
   *   -> ['.x.com', '.www.x.com', 'x.com', 'www.x.com']
   * 没有指定 domain 时使用当前 hostname 的所有变体
   */
  function getInjectionDomains(cookieDomain) {
    const hostname = getCurrentDomain();
    const domains = new Set();

    if (cookieDomain) {
      // 用户指定的 domain（确保带点前缀用于子域名共享）
      const cleaned = cookieDomain.replace(/^\./, '');
      domains.add('.' + cleaned);
      domains.add(cleaned);
    }

    // 始终添加当前 hostname 的所有变体
    const variants = getDomainVariants(hostname);
    for (const v of variants) {
      domains.add(v);
    }

    return [...domains];
  }

  function setCookieViaGMSingle(cookie, domain) {
    return new Promise((resolve, reject) => {
      const path = cookie.path || '/';
      const expirationDate = cookie.maxAge
        ? Math.floor(Date.now() / 1000) + parseInt(cookie.maxAge, 10)
        : Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

      GM_cookie.set({
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

  function setCookieViaDocumentSingle(cookie, domain) {
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
    let domainCount = 0;
    const errors = [];

    for (const cookie of cookies) {
      const domains = getInjectionDomains(cookie.domain);
      let cookieSuccess = false;

      for (const domain of domains) {
        try {
          if (useGM) {
            await setCookieViaGMSingle(cookie, domain);
          } else {
            setCookieViaDocumentSingle(cookie, domain);
          }
          domainCount++;
          cookieSuccess = true;
        } catch (_) {
          // 某些域名可能设置失败（跨域限制），继续尝试其他域名
        }
      }

      if (cookieSuccess) {
        successCount++;
      } else {
        errors.push(`${cookie.name}: 所有域名均设置失败`);
      }
    }

    const methodNote = useGM ? '(GM_cookie模式，支持HttpOnly)' : '(document.cookie模式，不支持HttpOnly)';
    return {
      success: successCount > 0,
      count: successCount,
      total: cookies.length,
      domainCount,
      errors,
      message: errors.length > 0
        ? `${methodNote} 注入 ${successCount}/${cookies.length} 个Cookie (${domainCount}次域名写入)，${errors.length} 个失败`
        : `${methodNote} 成功注入 ${successCount} 个Cookie (${domainCount}次域名写入)`
    };
  }

  function exportCookies() {
    const cookies = getCurrentCookies();
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  // ========== UI ==========
  function createPanel() {
    // 遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'ul-overlay';
    document.body.appendChild(overlay);

    // 面板
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
          当前域名: <strong>${getCurrentDomain()}</strong><br>
          Cookie引擎: <strong>${hasGMCookie() ? 'GM_cookie (支持HttpOnly)' : 'document.cookie (不支持HttpOnly)'}</strong>
        </div>

        <div class="ul-tabs">
          <button class="ul-tab active" data-tab="view">查看Cookie<span class="ul-count">${cookies.length}</span></button>
          <button class="ul-tab" data-tab="clean">清理</button>
          <button class="ul-tab" data-tab="inject">导入Cookie</button>
        </div>

        <!-- 查看 Tab -->
        <div class="ul-tab-content active" id="ul-tab-view">
          <div class="ul-section">
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
                  <button class="ul-btn ul-btn-secondary" id="ul-export-btn">导出Cookie</button>
                  <button class="ul-btn ul-btn-secondary" id="ul-refresh-btn">刷新列表</button>
                </div>`
              : '<div style="text-align:center;color:#9ca3af;padding:20px;">当前网站没有Cookie</div>'
            }
          </div>
        </div>

        <!-- 清理 Tab -->
        <div class="ul-tab-content" id="ul-tab-clean">
          <div class="ul-section">
            <div class="ul-section-title">清理选项</div>
            <div class="ul-btn-group">
              <button class="ul-btn ul-btn-danger" id="ul-clear-cookies-btn">清除所有Cookie</button>
              <button class="ul-btn ul-btn-danger" id="ul-clear-storage-btn">清除Storage</button>
            </div>
            <div style="height:10px"></div>
            <div class="ul-btn-group">
              <button class="ul-btn ul-btn-danger" id="ul-clear-cache-btn">清除Cache Storage</button>
              <button class="ul-btn ul-btn-danger" id="ul-clear-all-btn">一键清除全部</button>
            </div>
          </div>
        </div>

        <!-- 导入 Tab -->
        <div class="ul-tab-content" id="ul-tab-inject">
          <div class="ul-section">
            <div class="ul-section-title">粘贴Cookie字符串</div>
            <textarea class="ul-textarea" id="ul-cookie-input" placeholder="粘贴Cookie字符串，例如:&#10;auth_token=abc123;guest_id=v1:123;Path=/;Domain=x.com;ct0=xyz789"></textarea>
            <div style="height:10px"></div>
            <div class="ul-btn-group">
              <button class="ul-btn ul-btn-primary" id="ul-inject-btn">导入Cookie</button>
              <button class="ul-btn ul-btn-success" id="ul-inject-reload-btn">导入并刷新页面</button>
            </div>
          </div>
        </div>
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
    // 关闭
    const closePanel = () => {
      panel.style.display = 'none';
      overlay.style.display = 'none';
    };

    panel.querySelector('#ul-close-btn').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Tab 切换
    panel.querySelectorAll('.ul-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.ul-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.ul-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabId = `ul-tab-${tab.dataset.tab}`;
        panel.querySelector(`#${tabId}`).classList.add('active');
      });
    });

    // 导出
    const exportBtn = panel.querySelector('#ul-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const cookieStr = exportCookies();
        navigator.clipboard.writeText(cookieStr).then(() => {
          showToast('Cookie已复制到剪贴板');
        }).catch(() => {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = cookieStr;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          showToast('Cookie已复制到剪贴板');
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
      showToast(`已清除 ${count} 个Cookie`);
      refreshCookieCount(panel);
    });

    // 清除 Storage
    panel.querySelector('#ul-clear-storage-btn').addEventListener('click', () => {
      const result = clearStorage();
      showToast(`已清除 localStorage(${result.localStorage}) + sessionStorage(${result.sessionStorage})`);
    });

    // 清除 Cache
    panel.querySelector('#ul-clear-cache-btn').addEventListener('click', () => {
      clearCacheStorage().then(count => {
        showToast(`已清除 ${count} 个Cache Storage`);
      });
    });

    // 一键清除
    panel.querySelector('#ul-clear-all-btn').addEventListener('click', async () => {
      const cookieCount = await clearAllCookies();
      const storageResult = clearStorage();
      const cacheCount = await clearCacheStorage();
      showToast(`已清除: Cookie(${cookieCount}) + Storage(${storageResult.localStorage + storageResult.sessionStorage}) + Cache(${cacheCount})`);
      refreshCookieCount(panel);
    });

    // 导入 Cookie
    panel.querySelector('#ul-inject-btn').addEventListener('click', async () => {
      const input = panel.querySelector('#ul-cookie-input').value;
      const result = await injectCookies(input);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        refreshCookieCount(panel);
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

  function refreshCookieCount(panel) {
    const count = getCurrentCookies().length;
    const countEl = panel.querySelector('.ul-count');
    if (countEl) countEl.textContent = count;
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
