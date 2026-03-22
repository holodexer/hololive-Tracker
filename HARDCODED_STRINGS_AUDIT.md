# 硬編碼 UI 文本字符串審計報告

## 摘要
掃描了所有組件和頁面文件，發現以下硬編碼的 UI 文本字符串需要國際化(i18n)。

---

## 已發現的硬編碼字符串

### 1. **聊天和消息相關**

#### ChatPanel.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `No messages yet` | [ChatPanel.tsx](ChatPanel.tsx#L36) | 空狀態消息 | `sync.noMessages` |
| `Message...` | [ChatPanel.tsx](ChatPanel.tsx#L65) | 佔位符 | `sync.messagePlaceholder` |

#### NicknameModal.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Set Nickname` | [NicknameModal.tsx](NicknameModal.tsx#L21) | 對話框標題 | `sync.nicknameTitle` |
| `Enter a nickname to join the watch room.` | [NicknameModal.tsx](NicknameModal.tsx#L21) | 對話框描述 | `sync.nicknameDesc` |
| `Your nickname...` | [NicknameModal.tsx](NicknameModal.tsx#L21) | 佔位符 | `sync.nicknamePlaceholder` |
| `Join Room` | [NicknameModal.tsx](NicknameModal.tsx#L21) | 按鈕文本 | `sync.joinButton` |
| `Cancel` | [NicknameModal.tsx](NicknameModal.tsx#L21) | 按鈕文本 | `common.cancel` |

### 2. **隊列和播放相關**

#### VideoQueue.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Queue is empty` | [VideoQueue.tsx](VideoQueue.tsx#L18) | 空狀態消息 | `sync.queueEmpty` |
| `Paste URL to add to queue` | [VideoQueue.tsx](VideoQueue.tsx#L18) | 佔位符 | `sync.pasteUrlHint` |
| `Add` | [VideoQueue.tsx](VideoQueue.tsx#L18) | 按鈕文本 | `sync.addButton` |
| `Up Next` | [VideoQueue.tsx](VideoQueue.tsx#L23) | 標籤 | `sync.upNext` |
| `Only the Host can manage the queue` | [VideoQueue.tsx](VideoQueue.tsx#L23) | 限制消息 | `sync.hostOnlyQueueManagement` |

#### QueueCountdown.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Up next` | [QueueCountdown.tsx](QueueCountdown.tsx#L59) | 標籤 | `sync.upNext` |
| `Play now` | [QueueCountdown.tsx](QueueCountdown.tsx#L70) | 按鈕文本 | `sync.playNow` |
| `Cancel` | [QueueCountdown.tsx](QueueCountdown.tsx#L78) | 按鈕文本 | `common.cancel` |

### 3. **用戶列表和角色相關**

#### UserList.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `(you)` | [UserList.tsx](UserList.tsx#L45) | 用戶指示器 | `sync.youIndicator` |

### 4. **按鈕欄和導航相關**

#### CinemaOverlay.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `顯示聊天室` (中文) | [CinemaOverlay.tsx](CinemaOverlay.tsx#L36) | 標籤 | `cinema.showChat` |
| 需要英文版本 | - | - | - |

### 5. **頁面錯誤和返回選項**

#### Index.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Failed to load streams.` | [Index.tsx](Index.tsx#L23) | 錯誤消息 | `errors.failedToLoadStreams` |

#### NotFound.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `404` | [NotFound.tsx](NotFound.tsx#L14) | 錯誤代碼 | `errors.notFound` |
| `Oops! Page not found` | [NotFound.tsx](NotFound.tsx#L15) | 錯誤消息 | `errors.pageNotFound` |
| `Return to Home` | [NotFound.tsx](NotFound.tsx#L16) | 連結文本 | `errors.returnHome` |

#### Playlist.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Playlist not found.` | [Playlist.tsx](Playlist.tsx#L34) | 錯誤消息 | `errors.playlistNotFound` |

#### Members.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `No members found.` | [Members.tsx](Members.tsx#L126) | 空狀態消息 | `members.noFound` |

### 6. **複製/共享相關**

#### SyncWatch.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Invite link copied!` | [SyncWatch.tsx](SyncWatch.tsx#L431) | 成功通知 | `sync.inviteCopied` |
| 注意：已有中文和日文版本，但英文版本是硬編碼 | - | - | 應移至翻譯文件 |

### 7. **頁面標題和頭部**

#### App.tsx
| 硬編碼字符串 | 位置 | 類別 | 建議翻譯位置 |
|---|---|---|---|
| `Hololive Tracker` | [App.tsx](App.tsx#L42) | 應用程序標題 | `app.title` 或 `app.appName` |

---

## 分類統計

### 按類型分類：
- **按鈕文本**: 7 個 (Cancel, Add, Join Room, Play now 等)
- **佔位符**: 4 個 (Message..., URL hints, nickname 等)
- **標籤**: 3 個 (Up Next, Queue labels 等)
- **空狀態消息**: 4 個 (No messages, No members, Queue empty 等)
- **確認對話框文本**: 2 個 (Nickname desc 等)
- **錯誤消息**: 5 個 (404, Page not found, Failed to load 等)
- **成功通知**: 1 個 (Invite link copied)
- **用戶指示器**: 1 個 ((you))
- **應用程序標題/標籤**: 2 個 (Hololive Tracker, Show chat 等)

**總計**：29 個硬編碼字符串

---

## 已部分翻譯的字符串

以下文件已有翻譯結構，但需要補充英文版本或統一到 i18n 系統：

### SyncWatch.tsx - labels 對象
已有英文、中文(zh-TW)、日文(ja)三語版本：
- `Invite link copied!` (第 431 行) - 需要從硬編碼移至翻譯對象

### NicknameModal.tsx - localeLabels 對象  
已有完整三語版本，無需修改

### VideoQueue.tsx - queueLabels 對象
已有完整三語版本，無需修改

### UserList.tsx - localeLabels 對象
已有部分文本，但缺少 `(you)` 指示器的翻譯

### SettingsPanel.tsx
已有完整翻譯結構，但包含硬編碼的語言名稱選項：
- `English` / `日本語` / `中文` - 在 clipLangOptions 中

---

## 建議的 i18n 新增類別

根據發現的字符串，建議在 `i18n.ts` 中新增以下翻譯類別：

```typescript
{
  sync: {
    // 聊天
    noMessages: "No messages yet",
    messagePlaceholder: "Message...",
    
    // 隊列
    queueEmpty: "Queue is empty",
    pasteUrlHint: "Paste URL to add to queue",
    addButton: "Add",
    upNext: "Up Next",
    hostOnlyQueueManagement: "Only the Host can manage the queue",
    playNow: "Play now",
    
    // 用戶
    youIndicator: "(you)",
    
    // 通知
    inviteCopied: "Invite link copied!",
  },
  
  cinema: {
    showChat: "Show Chat",
  },
  
  errors: {
    notFound: "404",
    pageNotFound: "Oops! Page not found",
    returnHome: "Return to Home",
    playlistNotFound: "Playlist not found.",
    failedToLoadStreams: "Failed to load streams.",
  },
  
  common: {
    cancel: "Cancel",  // 重用的通用文本
  },
  
  app: {
    title: "Hololive Tracker",
  },
  
  members: {
    noFound: "No members found.",
  }
}
```

---

## 優先級建議

### 高優先級（影響用戶體驗）
1. ❌ `404` / `Oops! Page not found` / `Return to Home` - 用戶導航
2. ❌ `Playlist not found.` - 關鍵錯誤消息
3. ❌ `Failed to load streams.` - 數據載入失敗提示
4. ❌ `Play now` / `Cancel` - 關鍵按鈕
5. ❌ `No messages yet` - 聊天功能

### 中優先級（影響功能理解）
1. ⚠️ `Invite link copied!` - 反饋消息
2. ⚠️ `Queue is empty` - 功能提示
3. ⚠️ `Up Next` / `Up next` - 標籤標準化
4. ⚠️ `(you)` - 用戶指示器
5. ⚠️ `No members found.` - 空狀態提示

### 低優先級（輔助文本）
1. ℹ️ 佔位符文本 (Message..., URL hints)
2. ℹ️ 對話框描述文本
3. ℹ️ `Hololive Tracker` 應用標題

---

## 重複模式識別

### 可重用的通用翻譯鍵：
- **Cancel/取消**: 出現在 NicknameModal, QueueCountdown 中
  - 建議統一為 `common.cancel`

- **Up Next/Up next**: 出現在 QueueCountdown, VideoQueue 中
  - 當前已在 VideoQueue.tsx 的翻譯中，QueueCountdown.tsx 為硬編碼
  - 建議統一為 `sync.upNext`

- **Only Host can...**: 模式重複
  - 建議統一為類似 `sync.hostOnlyAction` 的鍵

---

## 後續步驟

1. **將硬編碼字符串遷移到 i18n.ts**
   - 按上述建議的類別添加翻譯
   - 保持與現有翻譯結構的一致性

2. **標準化翻譯鍵命名**
   - 遵循現有命名約定
   - 考慮功能模塊組織翻譯

3. **補充缺失的語言版本**
   - 中文(zh-TW)和日文(ja)版本
   - 特別是新添加的類別

4. **更新組件導入**
   - 確保所有組件導入 `useSettings` hook
   - 用 `t` 對象替換硬編碼字符串

5. **測試多語言渲染**
   - 驗證所有語言版本的文本長度和佈局
   - 測試動態文本的佈局流動
