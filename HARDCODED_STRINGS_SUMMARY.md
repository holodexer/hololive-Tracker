# 硬編碼字符串快速參考表

## 29 個硬編碼 UI 文本字符串

| # | 硬編碼字符串 | 文件位置 | 類別 | 建議翻譯鍵 |
|---|---|---|---|---|
| 1 | `No messages yet` | ChatPanel.tsx #L36 | 空狀態 | `sync.noMessages` |
| 2 | `Message...` | ChatPanel.tsx #L65 | 佔位符 | `sync.messagePlaceholder` |
| 3 | `Set Nickname` | NicknameModal.tsx #L21 | 對話框標題 | `sync.nicknameTitle` |
| 4 | `Enter a nickname to join the watch room.` | NicknameModal.tsx #L21 | 對話框描述 | `sync.nicknameDesc` |
| 5 | `Your nickname...` | NicknameModal.tsx #L21 | 佔位符 | `sync.nicknamePlaceholder` |
| 6 | `Join Room` | NicknameModal.tsx #L21 | 按鈕 | `sync.joinButton` |
| 7 | `Cancel` | NicknameModal.tsx #L21 | 按鈕 | `common.cancel` |
| 8 | `Queue is empty` | VideoQueue.tsx #L18 | 空狀態 | `sync.queueEmpty` |
| 9 | `Paste URL to add to queue` | VideoQueue.tsx #L18 | 佔位符 | `sync.queueAddHint` |
| 10 | `Add` | VideoQueue.tsx #L18 | 按鈕 | `sync.addButton` |
| 11 | `Up Next` | VideoQueue.tsx #L23 | 標籤 | `sync.upNext` |
| 12 | `Only the Host can manage the queue` | VideoQueue.tsx #L23 | 限制 | `sync.hostOnlyQueue` |
| 13 | `Up next` | QueueCountdown.tsx #L59 | 標籤 | `sync.upNext` |
| 14 | `Play now` | QueueCountdown.tsx #L70 | 按鈕 | `sync.playNow` |
| 15 | `Cancel` | QueueCountdown.tsx #L78 | 按鈕 | `common.cancel` |
| 16 | `(you)` | UserList.tsx #L45 | 指示器 | `sync.youIndicator` |
| 17 | `顯示聊天室` | CinemaOverlay.tsx #L36 | 標籤 | `cinema.showChat` |
| 18 | `Failed to load streams.` | Index.tsx #L23 | 錯誤 | `errors.failedToLoadStreams` |
| 19 | `404` | NotFound.tsx #L14 | 錯誤代碼 | `errors.notFound` |
| 20 | `Oops! Page not found` | NotFound.tsx #L15 | 錯誤 | `errors.pageNotFound` |
| 21 | `Return to Home` | NotFound.tsx #L16 | 連結 | `errors.returnHome` |
| 22 | `Playlist not found.` | Playlist.tsx #L34 | 錯誤 | `errors.playlistNotFound` |
| 23 | `No members found.` | Members.tsx #L126 | 空狀態 | `members.noFound` |
| 24 | `Invite link copied!` | SyncWatch.tsx #L431 | 通知 | `sync.inviteCopied` |
| 25 | `Hololive Tracker` | App.tsx #L42 | 標題 | `app.title` |
| 26 | `English` | SettingsPanel.tsx #L17 | 語言標籤 | `locales.en` |
| 27 | `日本語` | SettingsPanel.tsx #L18 | 語言標籤 | `locales.ja` |
| 28 | `中文` | SettingsPanel.tsx #L19 | 語言標籤 | `locales.zh` |
| 29 | `Hololive Tracker` | App.tsx (header) | 應用標題 | `app.title` |

## 文件統計

- **需要修改的文件**: 11 個
- **硬編碼字符串總數**: 29 個
- **已有部分翻譯**: 5 個文件
- **需要新增翻譯類別**: 5 個 (sync, cinema, errors, common, app, members)

## 模式分析

### 重複的字符串
- `Cancel` - 2 次 (NicknameModal, QueueCountdown) → 建議統一為 `common.cancel`
- `Up Next/Up next` - 2 次 (VideoQueue, QueueCountdown) → 建議統一為 `sync.upNext`
- `Hololive Tracker` - 2 次 (重複計數) → 使用 `app.title`

### 按優先級改進

**🔴 高優先級** (影響核心用戶體驗):
- 錯誤頁面字符串 (404, Page not found)
- 按鈕文本 (Play now, Cancel, Add)
- 空狀態消息 (No messages, No members)

**🟡 中優先級** (輔助功能文本):
- 聊天功能文本
- 隊列管理文本
- 通知消息

**🟢 低優先級** (UI 輔助信息):
- 佔位符和提示文本
- 對話框描述
- 應用標題

## 語言覆蓋

目前狀態：
- ✅ 英文（大部分已有硬編碼）
- ✅ 中文繁體 (zh-TW) - 需要為新字符串新增
- ✅ 日文 (ja) - 需要為新字符串新增

## 快速行動清單

- [ ] 在 i18n.ts 新增 sync, cinema, errors, common, app, members 上下文
- [ ] 將 29 個硬編碼字符串遷移到翻譯
- [ ] 為新翻譯鍵新增中文和日文版本
- [ ] 更新 11 個文件以使用翻譯鍵而非硬編碼值
- [ ] 測試全語言渲染
