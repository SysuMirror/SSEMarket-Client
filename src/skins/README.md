# 全站节日皮肤（可复用皮肤包）

这套皮肤系统把「节日视觉」和「业务页面」解耦：页面只消费设计 Token（`--accent` 等）
和通用组件，节日素材全部集中在 `public/skins/<skinID>/` + `src/skins/<skinID>.ts`。
活动结束后前端不需要改代码，自动回到默认皮肤；用户手动选过的皮肤会保留。

## 现有一套：`programmers-day-2026`（2026 程序员节）

| 资源 | 文件 | 用途 |
|---|---|---|
| 手机开场画面 | `splash-mobile.webp` | 手机进入站点 3s 全屏画面（可跳过） |
| 电脑开场画面 | `splash-desktop.webp` | 电脑进入站点 3s 全屏画面（可跳过） |
| 手机背景 | `bg-mobile.webp` | 手机全站背景（可关闭 / 可换自定义） |
| 电脑背景 | `bg-desktop.webp` | 电脑全站背景（可关闭 / 可换自定义） |
| 表情贴纸 | `stickers/01.webp` ~ `12.webp` | 首页横幅、宽屏两侧装饰、设置页表情墙 |

图片统一为 WebP q90（原图 1.6–2.1MB → 约 130KB），避免手机端入场等待。
页面展示一律 `object-fit: cover/contain`，任何屏幕比例都不会拉伸。

## 以后加一套节日皮肤

1. 新建目录 `public/skins/<newID>/`，放 4 张图 + 贴纸（可沿用同样文件名）。
2. 复制 `src/skins/programmers-day-2026.ts` 为 `<newID>.ts`，改 `id / name / description / 路径`。
3. 在 `src/skins/index.ts` 的 `SKINS` 数组里加一行。
4. 加配色：复制 `src/assets/skin-programmers-day-2026.css`，把
   `body[data-skin="..."]` 的配色改成新节日色，并在 `src/main.ts` import。
5. 后端往 `theme_events` 表插一行活动时间窗（北京时间墙钟，一行一期），
   `theme_id` 与前端 `id` 完全一致；不需要改代码，也不需要重新迁移。

## 关键约定

- **public 内置图片**：只通过 `src/utils/publicAsset.ts` 的 `publicAssetURL()` /
  `src/skins/index.ts` 的 `skinAssetURL()` 拼 `BASE_URL`，支持子路径部署。
- **用户上传背景**：只接受图床返回的绝对 `http(s)` 地址（`src/utils/imageSource.ts`
  校验），后端 `domain.NormalizeThemeBackgroundURL` 二次校验。相对路径、`data:`、
  `blob:`、`javascript:` 一律拒绝，绝不把 public 路径写进用户设置。
- **活动时间**：后端从 `theme_events` 表读取（北京时间墙钟，左闭右开），
  前端不自己写死日期；页面跨零点会自动结束（30s 时钟 tick）。
  表为空时 `event=null`，只能手动选皮肤，不会自动换肤。
- **用户的三种选择**：`auto` 跟随活动、`default` 强制默认、`<skinID>` 强制保留。
  保存于后端 `user_theme_settings`，本地 localStorage 只做首帧缓存。
- **开场画面**：每个浏览器会话每套皮肤只自动出现一次，右上角「跳过」始终可用，
  设置页可关闭、可随时预览。
- **背景**：可在设置里关闭；来源可选「皮肤背景」或「自定义图片」；自定义图片
  上传走 `/api/auth/uploadPhotos`（图床），内置背景不经过后端。
