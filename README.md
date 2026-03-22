# Holodexer 操作指南

本專案是一個以 Hololive 內容為核心的前端應用，提供：

- 直播追蹤（Live / Upcoming）
- 存檔與精華瀏覽
- 我的最愛篩選
- 多視窗觀看（MultiView）
- 同步觀看房間（Sync Watch）

## 1. 環境需求

- Node.js 18+
- npm 9+

## 2. 安裝與啟動

1. 安裝依賴

```bash
npm install
```

2. 啟動開發環境

```bash
npm run dev
```

3. 開啟瀏覽器

預設網址：

```text
http://localhost:8080/
```

## 3. 常用指令

```bash
# 開發模式
npm run dev

# 打包
npm run build

# 本地預覽打包成果
npm run preview

# Lint
npm run lint

# 單元測試
npm run test

# 測試監看模式
npm run test:watch
```

## 4. 功能操作

### 4.1 首頁（Home）

- 可查看直播中、即將直播、存檔、精華
- 分頁可切換內容類型

### 4.2 我的最愛（Favorites）

- 在 Members 頁把成員加入最愛後，Favorites 會只顯示最愛成員內容
- 可查看最愛的直播、存檔、精華

### 4.3 多視窗（MultiView）

- 可同時加入多個直播視窗
- 支援快速靜音/取消靜音

### 4.4 同步觀看（Sync Watch）

1. 建立或加入房間
2. 輸入影片 URL 或影片 ID 載入
3. 複製邀請連結給其他人加入
4. 房主可控制播放；可切換訪客控制模式

### 4.5 Sync Watch 的 Clips Overlay

點擊「Open Clips」後可開啟選片視窗，包含：

- 直播
- 存檔
- 精華

支援功能：

- 分頁切換
- 「我的最愛」篩選器
- 載入更多
- 點選卡片後直接加入同步觀看

## 5. 語言與內容篩選

在設定頁可調整：

- 介面語言
- 精華語言篩選
- 是否隱藏不可播放影片（私有/已刪除）

## 6. 常見問題排查

### 6.1 開發伺服器打不開

```bash
pkill -f "vite"
npm run dev
```

### 6.2 看到舊畫面

- 重新整理瀏覽器（建議強制重新整理）
- 確認終端機沒有舊的 dev server 殘留

### 6.3 Build 失敗

建議先執行：

```bash
npm run lint
npm run build
```

依錯誤訊息修正對應檔案。

## 7. 專案結構（重點）

```text
src/
	pages/                # 頁面
	components/           # 共用與功能元件
	components/sync/      # 同步觀看相關元件
	hooks/                # 自訂 hooks
	contexts/             # 全域狀態（設定、多視窗）
	lib/                  # API 與工具函式
```

## 8. 備註

- Sync Watch 需要 YouTube iframe API 才能完整控制 YouTube 播放
- 直播/精華資料來源為 Holodex API
