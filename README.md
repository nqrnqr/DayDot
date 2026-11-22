# DayDot · 日迹

轻量、无压力、本地优先（Local-First）的 Done List 与生活事件记录应用。支持 **Android 原生 APK（Capacitor 8）**、**离线 PWA** 与桌面浏览器，极简素纸莫兰迪美学。

- **在线体验（PWA）**：https://nqrnqr.github.io/DayDot/
- **公开仓库**：https://github.com/nqrnqr/DayDot

---

## 核心特性与设计约束

- **统一事件卡片主页**：不区分习惯/普通事件；分组筛选、搜索、置顶、触屏/鼠标拖拽排序；卡片右上角 `+`（带默认值预填确认抽屉）与 `⚡`（一键速记 + 撤销）。
- **自定义字段**：数值（单位 + 默认值 + 快捷档位 + 必填 `*`，不提供 `-/+` 步进器）、单选/多选标签、短文本备注；**刻意不做**星级评分与计时器。
- **统计与视图**：
  - **事件详情**：全主题色联动，可折叠月历 + 连续时间轴（点击时间切换时刻/间隔）；统计含周/月/年/总柱状图、4 宫格指标、年度热力图与字段占比。
  - **趋势**：4 宫格全局总览 + 周圆点矩阵 / 月双列迷你日历 / 年独立热力图卡片。
  - **查看**：全局月历 + 连续竖向时间轴。
- **外观**：极简扁平素纸质感（无浑浊卡片阴影），支持「自动 / 浅色 / 深色」三态主题。
- **本地优先 + GitHub 私有仓库云同步**：
  - 本地数据存入 IndexedDB（Dexie.js），支持 JSON 备份导出/导入（合并/覆盖）。
  - 可选绑定个人 GitHub 私有仓库（如 `<user>/DayDot-Data`）与 Fine-grained Token 实现 0 成本多端双向同步：按 `id` + `updatedAt` 执行 LWW 合并（含 90 天软删除墓碑），**30 秒防抖批量提交 + 切后台/锁屏立刻补推 + 持久化待同步标记（断网/强杀下次自动续传）+ 回到前台 2 分钟冷却拉取**。

---

## 技术栈与项目结构

- **前端**：React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Dexie 4 · `@dnd-kit` · Lucide Icons · `vite-plugin-pwa`
- **原生壳与热更新**：Capacitor 8 (`@capacitor/android`, `@capacitor/app`) · `@capgo/capacitor-updater` v8

```text
├── src/
│   ├── types/models.ts          # Group / EventItem / EventRecord / FieldSchema（含软删除字段）
│   ├── db/db.ts                 # Dexie IndexedDB 封装、种子数据、JSON 备份导入导出、notifyLocalMutation
│   ├── constants/theme.ts       # 莫兰迪色板（浅/深双套 Token）与图标目录
│   ├── services/
│   │   ├── githubSync.ts        # GitHub 私有仓库 LWW 双向同步、409 冲突重试、pendingChanges 追踪
│   │   └── otaUpdater.ts        # Capgo v8 自托管热更新封装（SHA-256 校验、进度与原生错误捕获）
│   ├── utils/                   # date.ts / stats.ts / themeMode.ts
│   ├── pages/                   # HomePage / EventDetailPage / TrendsPage / CalendarViewPage / SettingsPage
│   └── components/              # BottomSheetDialog(<dialog>) / QuickRecordSheet / EventEditorSheet /
│                                # GroupManagerSheet / CloudSyncSheet / AnnualHeatmap / BarChartCard 等
├── scripts/
│   ├── assets/android-icon-foreground.png  # Android 108dp 自适应安全区透明前景图标
│   ├── setup-android-icons.mjs             # 写入 Android mipmap 图标与 #F8F7F4 自适应底色
│   ├── configure-android-native.mjs        # 注入原生 MainActivity（WindowInsetsCompat 防遮挡 + 状态栏配色桥）
│   └── configure-android-signing.mjs       # 注入 Gradle versionCode/versionName 与永久 Release 签名
└── .github/workflows/
    ├── deploy.yml               # push main 自动发布 GitHub Pages PWA + 自托管 OTA 增量包
    └── build-apk.yml            # 手动或 v* 标签云端打包固定签名 Android Release APK
```

> **协作约定（给后续开发 / AI）**：
> - `android/` 目录不入库，由 CI 临时 `npx cap add android` 生成并执行 `scripts/` 下 3 个脚本注入原生配置。
> - 源码 `src/` 内禁止硬编码任何个人用户名、Token 或私有仓库路径；仓库相关 URL 由 CI 通过环境变量注入。
> - Capacitor 构建（APK 与 OTA）通过 `CAPACITOR_BUILD=1` 禁用 `VitePWA` Service Worker，防止本地缓存干扰升级与热更新。

---

## 构建、版本与更新机制

- **统一版本号**：`deploy.yml` 与 `build-apk.yml` 均使用 `fetch-depth: 0` 和 `1.0.$(git rev-list --count HEAD)`（APK `versionCode` 同步使用提交数），保证同一 commit 的 PWA、OTA 清单与 APK 版本严格一致。
- **Android APK（固定签名）**：
  1. 在仓库 `Settings → Secrets → Actions` 配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`（配置后自动打出永久签名 Release 包，覆盖安装无损保留数据）。
  2. 在 **Actions → Build Android APK → Run workflow** 触发打包，完成后从 Artifacts 下载 `DayDot-android-apk`。
- **应用内热更新（OTA）**：
  - 推送 `main` 时 `deploy.yml` 会自动产出 `ota/bundle-<version>-<sha>.zip`（唯一包名防 CDN 缓存错配）与含 SHA-256 的 `ota/latest.json`。
  - **更新边界**：纯 Web 页面/逻辑/样式改动 → 在手机 App「设置 → 应用热更新」直接一键更新；涉及桌面图标、`MainActivity` 原生代码、权限或 Capacitor 插件变更 → 需重跑一次 `Build Android APK`。
- **离线 PWA**：手机 Chrome / Edge 访问在线地址 → 菜单选择「安装应用 / 添加到主屏幕」即可离线使用。

---

## 本地开发

```bash
npm install
npm run dev          # 本地启动，局域网手机可访问终端输出的 Network IP 真机调试
npm run build        # 类型检查 (tsc -b) + 生产构建验证
```
