// ========== 状态 ==========
let currentTab = null;
let currentUrl = '';
let currentHostname = '';

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentUrl = tab.url;
  currentHostname = new URL(tab.url).hostname;

  document.getElementById('domain-text').textContent = currentHostname;

  initTabs();
  initButtons();
  await loadCookies();
});

// ========== Tab 切换 ==========
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ========== Cookie 列表 ==========
async function loadCookies() {
  const res = await sendMessage('getCookies', { url: currentUrl });
  const list = document.getElementById('cookie-list');
  const count = document.getElementById('cookie-count');

  if (!res.success || res.cookies.length === 0) {
    list.innerHTML = '<div class="empty">当前网站没有Cookie</div>';
    count.textContent = '0';
    return;
  }

  count.textContent = res.cookies.length;

  list.innerHTML = res.cookies.map(c => `
    <div class="cookie-item" title="${esc(c.name)}=${esc(c.value)}&#10;Domain: ${esc(c.domain)}&#10;Path: ${esc(c.path)}">
      <span class="cookie-name">${esc(c.name)}</span>
      <span class="cookie-value">${esc(c.value)}</span>
      <span class="cookie-flags">
        ${c.httpOnly ? '<span class="flag flag-httponly">H</span>' : ''}
        ${c.secure ? '<span class="flag flag-secure">S</span>' : ''}
      </span>
    </div>
  `).join('');
}

// ========== 按钮事件 ==========
function initButtons() {
  // 导出
  document.getElementById('export-btn').addEventListener('click', async () => {
    const res = await sendMessage('exportCookies', { url: currentUrl });
    if (res.success) {
      await navigator.clipboard.writeText(res.cookieStr);
      showToast('Cookie已复制到剪贴板');
    } else {
      showToast('导出失败: ' + res.message, 'error');
    }
  });

  // 刷新
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadCookies();
    showToast('已刷新', 'info');
  });

  // 清除 Cookie
  document.getElementById('clear-cookies-btn').addEventListener('click', async () => {
    const res = await sendMessage('clearCookies', { url: currentUrl });
    showToast(`已清除 ${res.count} 个Cookie（含HttpOnly）`);
    await loadCookies();
  });

  // 清除缓存/Storage
  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    const origin = new URL(currentUrl).origin;
    const res = await sendMessage('clearBrowsingData', { origin });
    if (res.success) {
      showToast('已清除缓存/Storage/IndexedDB');
    } else {
      showToast('清除失败: ' + res.message, 'error');
    }
  });

  // 一键清除全部
  document.getElementById('clear-all-btn').addEventListener('click', async () => {
    const origin = new URL(currentUrl).origin;
    const [cookieRes, dataRes] = await Promise.all([
      sendMessage('clearCookies', { url: currentUrl }),
      sendMessage('clearBrowsingData', { origin })
    ]);
    showToast(`已清除: Cookie(${cookieRes.count}) + 缓存/Storage`);
    await loadCookies();
  });

  // 导入
  document.getElementById('inject-btn').addEventListener('click', async () => {
    const input = document.getElementById('cookie-input').value;
    const res = await sendMessage('injectCookies', {
      cookieStr: input,
      url: currentUrl,
      hostname: currentHostname
    });
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) await loadCookies();
  });

  // 导入并刷新页面
  document.getElementById('inject-reload-btn').addEventListener('click', async () => {
    const input = document.getElementById('cookie-input').value;
    const res = await sendMessage('injectCookies', {
      cookieStr: input,
      url: currentUrl,
      hostname: currentHostname
    });
    if (res.success) {
      showToast(res.message + '，刷新页面中...');
      setTimeout(() => {
        chrome.tabs.reload(currentTab.id);
        window.close();
      }, 800);
    } else {
      showToast(res.message, 'error');
    }
  });
}

// ========== 工具函数 ==========
function sendMessage(action, data) {
  return chrome.runtime.sendMessage({ action, data });
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
