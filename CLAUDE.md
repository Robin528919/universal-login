# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

油猴（Tampermonkey/Greasemonkey）用户脚本，用于跨网站的 Cookie 管理与快速登录。包含两个独立脚本：

1. **管理面板** `universal-login.user.js`：手动查看/清理/导入 cookie，提供 Alt+C 面板和右上角浮动按钮
2. **一键植入接收端** `universal-login-receiver.user.js`：配合外部"网页 A"通过 URL hash 静默注入 cookie 完成登录

核心功能：

- **查看/导出** 当前网站的所有 Cookie（管理面板）
- **清理** Cookie、localStorage、sessionStorage、Cache Storage（管理面板）
- **手动导入** Cookie 字符串实现跨设备登录（管理面板）
- **一键植入** 由网页 A 触发 `window.open` 携带 base64 payload，目标站 document-start 拦截、清场、注入、reload（接收端）

## 架构

### 管理面板 `universal-login.user.js`

IIFE 结构，内部按职责分区：

| 区域 | 职责 |
|------|------|
| GM_addStyle | 全部 CSS 样式（带 `ul-` 前缀避免冲突） |
| 工具函数 | showToast、getDomainVariants、escapeHtml |
| Cookie 操作 | getCurrentCookies、clearAllCookies、parseCookieString、injectCookies、exportCookies |
| Storage 操作 | clearStorage、clearCacheStorage |
| UI 构建 | createPanel、bindEvents、openPanel、destroyPanel |
| 入口 | GM_registerMenuCommand + Alt+C 快捷键 |

### 一键植入接收端 `universal-login-receiver.user.js`

完全独立脚本，`@run-at document-start`，与管理面板互不影响。区域划分：

| 区域 | 职责 |
|------|------|
| 入口 | 解析 `location.hash` 中的 `#__ulinject=` payload，无则退出 |
| 解析 | base64url + JSON.parse + 协议版本校验（`v=1`） |
| Cookie 解析 | 自动识别字符串/JSON 数组两种格式 |
| 清场流水线 | clearAllCookies（含暴力删除已知 auth cookie）+ clearStorage + clearCacheStorage + unregisterServiceWorkers + clearIndexedDB |
| 注入流水线 | GM_cookie.set 多 URL 策略 + document.cookie 兜底 |
| Toast | 内联 `<style>` + `<div>`，等 body 可用后显示，1s 后 reload |

协议规范见 `docs/integration/A站接入指南.md`。

## 关键设计决策

- **z-index 使用最大值** (2147483647) 确保面板始终在最顶层
- **Cookie 解析器** 会区分 cookie 键值对和属性（Path/Domain/Max-Age/SameSite），属性关联到前一个 cookie
- **域名变体清理**：清除 cookie 时尝试多种 domain 组合（含/不含点前缀、父级域名）
- **所有 CSS class 使用 `ul-` 前缀** 避免与宿主页面样式冲突
- **GM API 依赖**：GM_registerMenuCommand、GM_addStyle、GM_setValue、GM_getValue（管理面板）；GM_cookie（接收端）
- **接收端无安全防护**：用户主动选择"最简模式"，未启用 HMAC / referrer 白名单 / 确认弹窗 / 路径限制 / nonce / 过期校验。任何含 `#__ulinject=` 的链接都会被静默执行。修改时务必保留此前提，不要"擅自加回"防护层（如有需要先与用户对齐）
- **接收端 `@run-at document-start` 不可改**：必须在网站脚本之前清场+注入，否则 SPA 内存里旧用户态 / Service Worker / 首屏 API 都会污染结果

## 开发与安装

无构建步骤。直接在 Tampermonkey 中新建脚本并粘贴 `universal-login.user.js` 内容，或通过文件 URL 安装。

## 使用方式

- **管理面板**：`Alt+C` 快捷键 / 右上角浮动按钮 / Tampermonkey 菜单 "Cookie Manager"
- **接收端**：被动触发，由 A 站通过 `window.open('https://target/#__ulinject=...')` 唤起。本地验证可双击 `docs/integration/demo.html`

## 文档目录约定

- `docs/integration/` 协议规范、给外部接入方看的文档、本地测试页
- `docs/architecture/` 架构图（SVG）
- `docs/INSTALL_AND_USAGE.md` 用户视角的新手安装教程
- `.claude/plans/` 任务规划，命名 `{YYYYMMDD-HHMMSS}-名称.md`
  - `completed/` 已完成且代码审查通过的规划
  - `pending-test/` 已实现但需要人工真实场景验收的规划
