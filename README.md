# Universal Login - Cookie Manager

一个用于管理网站 Cookie 和本地缓存的通用登录辅助工具。项目提供三种形态：

- 油猴脚本（管理面板）：`universal-login.user.js`，适合通过 Tampermonkey、Violentmonkey 等用户脚本管理器直接运行，提供 Cookie 查看 / 清理 / 手动导入面板。
- 油猴脚本（接收端）：`universal-login-receiver.user.js`，配合外部"账号管理控制台"（网页 A），点一下按钮新 tab 自动植入 cookie 完成登录。详见 [docs/integration/A站接入指南.md](docs/integration/A站接入指南.md)。
- Chrome 扩展：`chrome-extension/`，基于 Manifest V3，适合需要更完整 Cookie 权限，尤其是读取和清理 `HttpOnly` Cookie 的场景。

> 安全提醒：Cookie 通常等同于网站登录凭证。请只在自己的账号、自己的设备之间导出或导入 Cookie，不要保存、传播或导入来源不明的 Cookie。

## 功能特性

- 查看当前网站 Cookie 列表。
- 导出当前网站 Cookie 字符串到剪贴板。
- 导入 Cookie 字符串并快速恢复登录状态。
- 清理当前网站 Cookie、`localStorage`、`sessionStorage`、Cache Storage。
- 尝试清理 Service Worker、IndexedDB 等可能保存登录状态的数据。
- 油猴脚本支持 `Alt+C` 快捷键和页面浮动按钮打开面板。
- Chrome 扩展支持通过浏览器扩展弹窗查看、清理和导入 Cookie。

## 快速使用

### 方式一：油猴脚本

1. 在浏览器中安装 Tampermonkey 或其他用户脚本管理器。
2. 新建脚本，删除默认模板。
3. 复制 `universal-login.user.js` 的全部内容并粘贴保存。
4. 打开目标网站并刷新页面。
5. 按 `Alt+C`，或点击页面右上角浮动按钮打开 `Cookie Manager`。

更详细的新手教程请查看 [docs/INSTALL_AND_USAGE.md](docs/INSTALL_AND_USAGE.md)。

### 方式二：油猴接收端（一键植入模式）

1. 在 Tampermonkey 中安装 `universal-login-receiver.user.js`（与方式一脚本可以并存）。
2. 在你自己的"账号管理控制台"（网页 A）按 [docs/integration/A站接入指南.md](docs/integration/A站接入指南.md) 接入。
3. 在 A 站点击"一键登录"按钮，自动新 tab 打开目标站、清场、注入 cookie、刷新完成登录。
4. 想先验证脚本是否工作？双击打开 `docs/integration/demo.html`，填入 cookie 点击「打开并植入」。

> ⚠️ 接收端为了简洁未启用任何自动安全防护（无签名、无来源校验、无确认弹窗），任何含 `#__ulinject=` 的链接都会被静默执行。请只点击你信任来源的"一键登录"按钮。

### 方式三：Chrome 扩展

1. 打开 Chrome 的扩展管理页：`chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 `chrome-extension/` 目录。
5. 打开目标网站，点击浏览器工具栏中的扩展图标使用。

Chrome 扩展版本使用 `chrome.cookies` 和 `chrome.browsingData` API，权限更完整，适合需要处理 `HttpOnly` Cookie 的场景。

## Cookie 格式

支持常见的 Cookie 字符串：

```text
auth_token=abc123; guest_id=v1:123; ct0=xyz789
```

也支持携带部分属性的格式：

```text
auth_token=abc123; Path=/; Domain=example.com; SameSite=Lax
```

导入后如果网站仍未登录，常见原因包括 Cookie 已过期、域名不匹配、网站额外校验 IP 或设备指纹，或登录态还依赖 `localStorage`、`sessionStorage` 等数据。

## 项目结构

```text
.
├── universal-login.user.js          # 油猴脚本（管理面板）
├── universal-login-receiver.user.js # 油猴脚本（一键植入接收端）
├── chrome-extension/                # Chrome Manifest V3 扩展版本
│   ├── manifest.json                # 扩展权限与入口配置
│   ├── background.js                # Cookie、缓存清理和导入导出逻辑
│   ├── popup.html                   # 扩展弹窗结构
│   ├── popup.css                    # 扩展弹窗样式
│   ├── popup.js                     # 扩展弹窗交互逻辑
│   └── icons/                       # 扩展图标
├── docs/
│   ├── INSTALL_AND_USAGE.md         # 新手安装与使用指南
│   ├── integration/                 # 接收端接入文档
│   │   ├── A站接入指南.md           # 给"网页 A 实现者"看的协议规范
│   │   └── demo.html                # 本地测试页（双击打开即可用）
│   ├── architecture/                # 架构设计图
│   │   └── cookie-inject-flow.svg
│   └── images/                      # 文档配图
├── design-mockup.svg                # 设计稿
├── CLAUDE.md                        # 项目协作说明
└── AGENTS.md                        # Codex 协作说明
```

## 开发说明

本项目当前没有构建步骤，也不依赖包管理器。

- 修改油猴脚本：直接编辑 `universal-login.user.js`，再复制到用户脚本管理器中验证。
- 修改 Chrome 扩展：编辑 `chrome-extension/` 下的文件，在 `chrome://extensions/` 页面点击扩展的刷新按钮重新加载。
- 调试油猴脚本：打开目标页面开发者工具，查看控制台中 `[CookieManager]` 前缀日志。
- 调试 Chrome 扩展：在扩展管理页打开 Service Worker 控制台，或在弹窗页面上右键检查。

## 权限说明

油猴脚本声明了以下主要权限：

- `GM_registerMenuCommand`：注册油猴菜单入口。
- `GM_addStyle`：注入面板样式。
- `GM_setValue` / `GM_getValue`：保存浮动按钮位置。
- `GM_cookie`：增强 Cookie 读取、写入和删除能力。

Chrome 扩展声明了以下主要权限：

- `cookies`：读取、写入和删除 Cookie。
- `browsingData`：清理缓存、Storage、IndexedDB 等浏览器数据。
- `activeTab`：获取当前活动标签页。
- `<all_urls>`：允许在不同网站上操作对应域名的数据。

这些权限只应在可信环境中使用。处理 Cookie 前请确认当前页面域名，避免把凭证导入到错误的网站。

## 常见问题

### 按 `Alt+C` 没反应

确认用户脚本管理器已启用、本脚本已启用，并刷新当前页面。某些浏览器或网页可能占用快捷键，此时可以点击页面浮动按钮或油猴菜单中的 `Cookie Manager`。

### 导入 Cookie 后仍未登录

优先检查 Cookie 是否属于当前域名，以及是否已经过期。很多网站还会校验 IP、设备、User-Agent 或本地存储数据，仅导入 Cookie 不一定能恢复完整登录态。

### 清理后网站仍显示登录

可以再次执行“一键清除全部”并刷新页面。若仍存在状态，可能是浏览器缓存、Service Worker、IndexedDB 或网站服务端状态没有完全更新。

## 许可

MIT
