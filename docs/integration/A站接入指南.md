# A 站接入指南

> 这份文档写给"网页 A"（也就是用户的账号管理控制台）的实现者看。
> 按本协议生成 URL 并 `window.open`，用户的浏览器只要装了 `universal-login-receiver.user.js` 油猴脚本，就会在新 tab 里自动清场并植入 cookie 完成登录。

---

## ⚠️ 安全告知（必读）

本协议**不做任何自动安全防护**，是用户主动选择的"最简模式"：

- ❌ 不验证 HMAC 签名
- ❌ 不限制 referrer 来源
- ❌ 不弹用户确认框
- ❌ 不限制 URL 路径
- ❌ 不做 nonce / 过期校验

**已知风险**：任何第三方网站只要诱导用户点击形如 `<a href="https://x.com/#__ulinject=...">链接</a>`，就会**静默**把攻击者的 cookie 植入用户浏览器。这是真实的会话固定攻击（Session Fixation）。

**用户的对应策略**：自我约束 —— 不点不明链接。如需加回防护层，参考本文末尾「可选加固」一节。

---

## 一、协议总览

```
┌────────────────────┐    window.open      ┌──────────────────────────┐
│  网页 A（你这边）  │  ─────────────────► │  目标站新 tab            │
│                    │   URL 携带 payload  │  油猴脚本拦截 hash       │
│  组装 cookie       │                     │  → 清场 → 注入 → reload  │
└────────────────────┘                     └──────────────────────────┘
```

---

## 二、URL 格式

```
https://<目标域名>/<任意路径>#__ulinject=<base64url(JSON payload)>
```

例：

```
https://x.com/#__ulinject=eyJ2IjoxLCJjb29raWVzIjoi...
https://www.instagram.com/some/path#__ulinject=eyJ2IjoxLCJjb29raWVzIjoi...
```

要点：
- 只用 **hash（`#`）** 传递，不能放 query（`?`）。query 会被记录在目标站服务器访问日志、CDN 日志、`Referer` 头以及浏览器历史记录中；hash 只存在于客户端，安全得多
- 路径任意都接受
- `https://` 或 `http://` 都行，但建议 `https://`（X、IG 等大站强制 https）

---

## 三、Payload 数据结构

### 3.1 最小字段

```json
{
  "v": 1,
  "cookies": "<cookie 数据，字符串或数组>"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `v`  | number | 是 | 协议版本号，当前固定为 `1` |
| `cookies` | string \| Array | 是 | cookie 数据，下面两种格式都接受 |

### 3.2 Cookie 格式 A：浏览器原生字符串（推荐）

跟 `document.cookie` / Chrome DevTools Network 面板 / 现有 Cookie Manager 导出的格式完全一致：

```
name1=value1; name2=value2; Path=/; Domain=x.com; name3=value3
```

- 多条 cookie 用 `;` 分隔
- 可以带 `Path=` `Domain=` 这些属性（会关联到前一个 cookie）
- 不带 Domain 时，接收脚本会自动设到目标站的父域（例如 `x.com` → `.x.com`）

**示例 payload**：

```json
{
  "v": 1,
  "cookies": "auth_token=abc123def456; ct0=hex_csrf_token; twid=u%3D1234567890"
}
```

### 3.3 Cookie 格式 B：JSON 数组（更精确）

需要精确指定每条 cookie 的 domain/path 时使用：

```json
{
  "v": 1,
  "cookies": [
    { "name": "auth_token", "value": "abc123", "domain": ".x.com", "path": "/" },
    { "name": "ct0", "value": "xyz789" },
    { "name": "twid", "value": "u%3D123" }
  ]
}
```

| 字段 | 必填 | 默认 |
|------|------|------|
| `name` | 是 | — |
| `value` | 是 | `""` |
| `domain` | 否 | 自动取目标站父域 |
| `path` | 否 | `/` |

---

## 四、A 站完整代码（直接复制使用）

```javascript
/**
 * 一键登录目标站
 * @param {string} targetSite - 目标站域名，如 "x.com" 或 "www.instagram.com"
 * @param {string|Array} cookieData - cookie 字符串或数组，见上方两种格式
 * @param {string} [path='/']      - 目标站打开后的路径
 */
function injectLogin(targetSite, cookieData, path = '/') {
  const payload = {
    v: 1,
    cookies: cookieData,
  };

  const url = `https://${targetSite}${path}#__ulinject=${base64url(JSON.stringify(payload))}`;
  window.open(url, '_blank');
}

// base64url 编码（标准 base64 但 + → -, / → _, 去掉尾部 =）
// 用 TextEncoder 处理 UTF-8（避免已废弃的 unescape API）
function base64url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 使用示例
injectLogin('x.com',
  'auth_token=abc; ct0=xyz; twid=u%3D123'
);

injectLogin('www.instagram.com', [
  { name: 'sessionid', value: 'IGSC...', domain: '.instagram.com' },
  { name: 'csrftoken', value: 'csrf...' },
  { name: 'ds_user_id', value: '123456789' },
]);
```

> ⚠️ `window.open` 必须在用户**点击事件**的同步调用栈里调用，否则会被浏览器拦截。
> 也就是说："一键登录" 按钮的 `onClick` 处理器里直接 call 这个函数。

---

## 五、URL 长度限制

- Chrome 单 URL 实际可处理长度约 **8000 字符**
- 经验值：单条 cookie 平均 100 字符，能塞 ~60 条以内的 cookie
- 超过限制会被截断，注入失败

如果某账号 cookie 特别多，建议：
1. 只挑保留登录态必要的 cookie（如 X 只需 `auth_token`、`ct0`、`twid` 三条）
2. 不要把 `_ga`、`_gcl_au`、广告类 cookie 也塞进来

---

## 六、错误排查

打开目标站新 tab 后按 F12 → Console，搜 `[UL-Receiver]` 前缀：

| 现象 | 可能原因 |
|------|---------|
| Console 没任何 `[UL-Receiver]` 日志 | 油猴脚本未启用，或 hash 格式不对 |
| `base64 解码失败` | A 站编码有 bug，常见是没处理 UTF-8 |
| `JSON 解析失败` | payload 不是合法 JSON |
| `不支持的 payload 版本` | `v` 字段不是 `1` |
| `payload.cookies 缺失或类型错误` | cookies 字段缺失或类型不是 string/array |
| `解析到 cookie 数: 0` | cookie 字符串解析后没产出有效条目，检查格式 |
| 注入了但页面还是未登录 | 站点对 IP/UA/设备指纹有额外校验；或 cookie 已过期；或站点身份还存于 localStorage（本协议不同步它） |

---

## 七、协议限制

- 只同步 cookie，**不同步** localStorage / sessionStorage / IndexedDB（用户主动选择的简化）
- 不支持 cross-tab 通知（每次 `window.open` 是独立的）
- 不能在已经打开的 tab 里"切换账号"，必须开新 tab

---

## 八、可选加固（如果你后悔了）

### 8.1 加 referrer 白名单（最便宜的一道防护）

在接收脚本头部增加：

```javascript
const ALLOWED_SOURCES = ['https://your-panel.com'];
if (!ALLOWED_SOURCES.some(s => document.referrer.startsWith(s))) {
  console.warn(LOG_PREFIX, 'referrer 不在白名单，丢弃');
  return;
}
```

代价：A 站换域名要改脚本。

### 8.2 加 HMAC 签名（最强）

A 站和接收脚本共享一个 secret，A 站用 HMAC-SHA256 签名 payload，接收脚本校验。攻击者没有 secret 就伪造不了。代价：A 站要写签名逻辑，secret 要安全分发。

### 8.3 加用户确认弹窗

接收脚本在注入前 `confirm("即将植入来自 X 的 cookie 到 Y，是否继续？")`，加一道人工闸。代价：每次都要点。

如需启用，告诉脚本作者，会更新接收脚本代码。

---

## 九、版本与兼容

- 协议当前版本：`v=1`
- 接收脚本：`universal-login-receiver.user.js` `v1.0.0`
- 协议未来如果有破坏性变更会升 `v`，接收脚本会同时支持旧版至少 1 个版本

---

## 十、最简调用速查

```javascript
// 一行版（适合贴进 onClick）—— 现代浏览器
const p = JSON.stringify({v:1,cookies:"auth_token=abc; ct0=xyz"});
const enc = (b => btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''))(
  Array.from(new TextEncoder().encode(p), c => String.fromCharCode(c)).join('')
);
window.open(`https://x.com/#__ulinject=${enc}`, '_blank');
```

可读版见第四节。
