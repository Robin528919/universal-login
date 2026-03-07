// ========== Cookie 解析 ==========
const COOKIE_ATTRS = new Set([
  'path', 'domain', 'expires', 'max-age', 'samesite',
  'secure', 'httponly', 'priority', 'partitioned'
]);

function parseCookieString(input) {
  const result = [];
  if (!input || !input.trim()) return result;

  const parts = input.trim().split(';').map(p => p.trim()).filter(Boolean);
  let currentCookie = null;

  for (const part of parts) {
    const eqIdx = part.indexOf('=');

    if (eqIdx === -1) {
      if (COOKIE_ATTRS.has(part.toLowerCase())) {
        if (currentCookie && part.toLowerCase() === 'secure') {
          currentCookie.secure = true;
        }
        if (currentCookie && part.toLowerCase() === 'httponly') {
          currentCookie.httpOnly = true;
        }
      }
      continue;
    }

    const key = part.substring(0, eqIdx).trim();
    const val = part.substring(eqIdx + 1).trim();

    if (COOKIE_ATTRS.has(key.toLowerCase())) {
      if (currentCookie) {
        const k = key.toLowerCase();
        if (k === 'domain') currentCookie.domain = val;
        if (k === 'path') currentCookie.path = val;
        if (k === 'max-age') currentCookie.maxAge = parseInt(val, 10);
        if (k === 'samesite') currentCookie.sameSite = val.toLowerCase();
        if (k === 'expires') currentCookie.expires = val;
      }
      continue;
    }

    currentCookie = { name: key, value: val };
    result.push(currentCookie);
  }

  return result;
}

// ========== 域名工具 ==========
function getDomainVariants(hostname) {
  const parts = hostname.split('.');
  const variants = [hostname, '.' + hostname];
  if (parts.length > 2) {
    const parent = parts.slice(1).join('.');
    variants.push(parent, '.' + parent);
  }
  return variants;
}

/**
 * 获取 cookie 应该注入的唯一目标域名
 * - 有 Domain 属性 → 用 .domain（覆盖所有子域名）
 * - 无 Domain 属性 → 用 .父级域名（覆盖子域名）
 * 只写入一个域名，避免重复 cookie 导致服务器验证失败
 */
function getTargetDomain(cookieDomain, hostname) {
  if (cookieDomain) {
    const cleaned = cookieDomain.replace(/^\./, '');
    return '.' + cleaned;
  }
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return '.' + parts.slice(1).join('.');
  }
  return '.' + hostname;
}

function normalizeSameSite(value) {
  if (!value) return 'lax';
  const lower = value.toLowerCase();
  if (lower === 'none') return 'no_restriction';
  if (lower === 'strict') return 'strict';
  return 'lax';
}

// ========== 消息处理 ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true;
});

async function handleMessage(msg) {
  const { action, data } = msg;

  switch (action) {
    case 'getCookies':
      return getCookies(data.url, data.hostname);
    case 'clearCookies':
      return clearCookies(data.url, data.hostname);
    case 'clearBrowsingData':
      return clearBrowsingData(data.origin);
    case 'injectCookies':
      return injectCookies(data.cookieStr, data.url, data.hostname);
    case 'exportCookies':
      return exportCookies(data.url, data.hostname);
    default:
      return { success: false, message: '未知操作' };
  }
}

// ========== Cookie 操作 ==========

/**
 * 获取当前网站所有 Cookie（通过域名变体查询，确保不遗漏）
 */
async function getCookies(url, hostname) {
  try {
    const domains = getDomainVariants(hostname);
    const seen = new Map();

    // 先按 URL 查
    const urlCookies = await chrome.cookies.getAll({ url });
    for (const c of urlCookies) {
      seen.set(`${c.name}|${c.domain}|${c.path}`, c);
    }

    // 再按域名变体查，补充遗漏的
    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const c of cookies) {
        const key = `${c.name}|${c.domain}|${c.path}`;
        if (!seen.has(key)) {
          seen.set(key, c);
        }
      }
    }

    const cookies = [...seen.values()].map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      expirationDate: c.expirationDate
    }));

    return { success: true, cookies };
  } catch (e) {
    return { success: false, message: e.message, cookies: [] };
  }
}

/**
 * 清除所有 Cookie（含 HttpOnly），使用域名变体 + 循环验证
 */
async function clearCookies(url, hostname) {
  try {
    const domains = getDomainVariants(hostname);
    const deleted = new Set();
    let count = 0;

    // 第一轮：按 URL + 域名变体查询并删除
    const urlCookies = await chrome.cookies.getAll({ url });
    for (const c of urlCookies) {
      const key = `${c.name}|${c.domain}|${c.path}`;
      if (deleted.has(key)) continue;
      await removeCookie(c);
      deleted.add(key);
      count++;
    }

    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const c of cookies) {
        const key = `${c.name}|${c.domain}|${c.path}`;
        if (deleted.has(key)) continue;
        await removeCookie(c);
        deleted.add(key);
        count++;
      }
    }

    // 循环验证，最多 3 轮
    for (let round = 0; round < 3; round++) {
      let remaining = [];
      for (const domain of domains) {
        const cookies = await chrome.cookies.getAll({ domain });
        remaining = remaining.concat(cookies);
      }
      const urlRemaining = await chrome.cookies.getAll({ url });
      remaining = remaining.concat(urlRemaining);

      if (remaining.length === 0) break;

      for (const c of remaining) {
        await removeCookie(c);
        count++;
      }
    }

    return { success: true, count };
  } catch (e) {
    return { success: false, count: 0, message: e.message };
  }
}

async function removeCookie(cookie) {
  const protocol = cookie.secure ? 'https:' : 'http:';
  const domain = cookie.domain.replace(/^\./, '');
  const cookieUrl = `${protocol}//${domain}${cookie.path}`;
  try {
    await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
  } catch (_) {
    // 尝试另一种协议
    const altProtocol = cookie.secure ? 'http:' : 'https:';
    const altUrl = `${altProtocol}//${domain}${cookie.path}`;
    await chrome.cookies.remove({ url: altUrl, name: cookie.name }).catch(() => {});
  }
}

/**
 * 清除缓存、Storage、IndexedDB
 */
async function clearBrowsingData(origin) {
  try {
    await chrome.browsingData.remove(
      { origins: [origin] },
      {
        cache: true,
        localStorage: true,
        sessionStorage: true,
        cacheStorage: true,
        indexedDB: true
      }
    );
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * 注入 Cookie — 每个 cookie 只写入唯一正确的域名
 */
async function injectCookies(cookieStr, url, hostname) {
  const cookies = parseCookieString(cookieStr);
  if (cookies.length === 0) {
    return { success: false, count: 0, message: '未解析到有效的Cookie' };
  }

  let successCount = 0;
  const errors = [];

  for (const cookie of cookies) {
    try {
      const domain = getTargetDomain(cookie.domain, hostname);
      const path = cookie.path || '/';
      const secure = cookie.secure || url.startsWith('https');

      const details = {
        url: url,
        name: cookie.name,
        value: cookie.value,
        domain: domain,
        path: path,
        secure: secure,
        httpOnly: cookie.httpOnly || false,
        sameSite: normalizeSameSite(cookie.sameSite)
      };

      if (cookie.maxAge) {
        details.expirationDate = Math.floor(Date.now() / 1000) + cookie.maxAge;
      } else if (cookie.expires) {
        details.expirationDate = Math.floor(new Date(cookie.expires).getTime() / 1000);
      } else {
        details.expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      }

      await chrome.cookies.set(details);
      successCount++;
    } catch (e) {
      errors.push(`${cookie.name}: ${e.message}`);
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    total: cookies.length,
    errors,
    message: errors.length > 0
      ? `注入 ${successCount}/${cookies.length} 个Cookie，${errors.length} 个失败`
      : `成功注入 ${successCount} 个Cookie（含HttpOnly）`
  };
}

/**
 * 导出所有 Cookie（含 HttpOnly）
 */
async function exportCookies(url, hostname) {
  try {
    const res = await getCookies(url, hostname);
    const str = res.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return { success: true, cookieStr: str, count: res.cookies.length };
  } catch (e) {
    return { success: false, cookieStr: '', message: e.message };
  }
}
