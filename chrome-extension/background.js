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

function getTargetDomain(cookieDomain, hostname) {
  if (cookieDomain) {
    const cleaned = cookieDomain.replace(/^\./, '');
    return '.' + cleaned;
  }
  // 默认使用父域名（覆盖子域名）
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return '.' + parts.slice(1).join('.');
  }
  return '.' + hostname;
}

// ========== 消息处理 ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // 保持消息通道打开
});

async function handleMessage(msg, sender) {
  const { action, data } = msg;

  switch (action) {
    case 'getCookies':
      return getCookies(data.url);

    case 'clearCookies':
      return clearCookies(data.url);

    case 'clearBrowsingData':
      return clearBrowsingData(data.origin);

    case 'injectCookies':
      return injectCookies(data.cookieStr, data.url, data.hostname);

    case 'exportCookies':
      return exportCookies(data.url);

    default:
      return { success: false, message: '未知操作' };
  }
}

async function getCookies(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return {
      success: true,
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate
      }))
    };
  } catch (e) {
    return { success: false, message: e.message, cookies: [] };
  }
}

async function clearCookies(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    let count = 0;

    for (const cookie of cookies) {
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cookieUrl = `${protocol}//${cookie.domain.replace(/^\./, '')}${cookie.path}`;
      await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
      count++;
    }

    return { success: true, count };
  } catch (e) {
    return { success: false, count: 0, message: e.message };
  }
}

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

      // 设置过期时间
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

async function exportCookies(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    const str = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return { success: true, cookieStr: str };
  } catch (e) {
    return { success: false, cookieStr: '', message: e.message };
  }
}

function normalizeSameSite(value) {
  if (!value) return 'lax';
  const lower = value.toLowerCase();
  if (lower === 'none') return 'no_restriction';
  if (lower === 'strict') return 'strict';
  return 'lax';
}
