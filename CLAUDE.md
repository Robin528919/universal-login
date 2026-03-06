# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

油猴（Tampermonkey/Greasemonkey）用户脚本，用于跨网站的 Cookie 管理与快速登录。核心功能：

- **查看/导出** 当前网站的所有 Cookie
- **清理** Cookie、localStorage、sessionStorage、Cache Storage
- **导入** Cookie 字符串（支持带属性格式如 `Path=/;Domain=x.com`），实现跨浏览器/设备的快速登录

## 架构

单文件脚本 `universal-login.user.js`，IIFE 结构，内部按职责分区：

| 区域 | 职责 |
|------|------|
| GM_addStyle | 全部 CSS 样式（带 `ul-` 前缀避免冲突） |
| 工具函数 | showToast、getDomainVariants、escapeHtml |
| Cookie 操作 | getCurrentCookies、clearAllCookies、parseCookieString、injectCookies、exportCookies |
| Storage 操作 | clearStorage、clearCacheStorage |
| UI 构建 | createPanel、bindEvents、openPanel、destroyPanel |
| 入口 | GM_registerMenuCommand + Alt+C 快捷键 |

## 关键设计决策

- **z-index 使用最大值** (2147483647) 确保面板始终在最顶层
- **Cookie 解析器** 会区分 cookie 键值对和属性（Path/Domain/Max-Age/SameSite），属性关联到前一个 cookie
- **域名变体清理**：清除 cookie 时尝试多种 domain 组合（含/不含点前缀、父级域名）
- **所有 CSS class 使用 `ul-` 前缀** 避免与宿主页面样式冲突
- **GM API 依赖**：GM_registerMenuCommand、GM_addStyle、GM_setValue、GM_getValue

## 开发与安装

无构建步骤。直接在 Tampermonkey 中新建脚本并粘贴 `universal-login.user.js` 内容，或通过文件 URL 安装。

## 使用方式

- **Alt+C** 快捷键打开面板
- Tampermonkey 菜单点击 "Cookie Manager"
