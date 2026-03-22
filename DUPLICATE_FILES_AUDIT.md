# 重複文件審計報告

**審計日期**: 2026年3月22日
**項目**: holodexer (React + TypeScript + Vite)

---

## 📋 執行摘要

發現 **8 個完全重複的文件** 和 **2 個配置文件衝突**，分佈在以下位置：


| 類別                  | 發現數量 | 狀態        |
| --------------------- | -------- | ----------- |
| contexts 重複         | 2        | ⚠️ 應刪除 |
| hooks 重複            | 4        | ⚠️ 應刪除 |
| integrations 目錄異常 | 重複目錄 | ⚠️ 應清理 |
| 配置文件衝突          | 2        | ⚠️ 應解決 |

---

## 🔍 詳細分析

### 1. React Contexts 重複

**位置**: `src/contexts/` vs `src/components/contexts/`

#### 重複文件列表


| 文件名                 | 路徑 A          | 路徑 B                     | 內容相同 | 建議                                               |
| ---------------------- | --------------- | -------------------------- | :------: | -------------------------------------------------- |
| `MultiViewContext.tsx` | `src/contexts/` | `src/components/contexts/` |  ✅ 是  | 刪除`src/components/contexts/MultiViewContext.tsx` |
| `SettingsContext.tsx`  | `src/contexts/` | `src/components/contexts/` |  ✅ 是  | 刪除`src/components/contexts/SettingsContext.tsx`  |

**用途**: 這些是 React Context 定義，用於全局狀態管理

**當前使用情況**:

- 所有 import 都使用 `@/contexts/SettingsContext` 和 `@/contexts/MultiViewContext`
- tsconfig 配置中 `@` 別名指向 `src/`
- **結論**: `src/components/contexts/` 中的文件從未被使用

**推薦操作**: 🗑️ **刪除整個目錄** `src/components/contexts/`

---

### 2. React Hooks 重複

**位置**: `src/hooks/` vs `src/components/hooks/`

#### 重複文件列表


| 文件名            | 路徑 A       | 路徑 B                  | 內容相同 | 建議                                       |
| ----------------- | ------------ | ----------------------- | :------: | ------------------------------------------ |
| `use-mobile.tsx`  | `src/hooks/` | `src/components/hooks/` |  ✅ 是  | 刪除`src/components/hooks/use-mobile.tsx`  |
| `use-toast.ts`    | `src/hooks/` | `src/components/hooks/` |  ✅ 是  | 刪除`src/components/hooks/use-toast.ts`    |
| `useHolodex.ts`   | `src/hooks/` | `src/components/hooks/` |  ✅ 是  | 刪除`src/components/hooks/useHolodex.ts`   |
| `useSyncWatch.ts` | `src/hooks/` | `src/components/hooks/` |  ✅ 是  | 刪除`src/components/hooks/useSyncWatch.ts` |

**用途**: 這些是自定義 React hooks，用於邏輯復用

**當前使用情況**:

- 發現 22+ 個導入使用 `@/hooks/*` 的 hook
- 零個導入使用 `src/components/hooks/*` 的 hook
- **結論**: `src/components/hooks/` 中的文件完全未使用

**推薦操作**: 🗑️ **刪除整個目錄** `src/components/hooks/`

---

### 3. Supabase Integrations 目錄異常

**位置**: `src/integrations/` vs 異常的 `src/integrations:supabase/`

#### 問題描述


| 目錄                         | 文件                | 備註                                        |
| ---------------------------- | ------------------- | ------------------------------------------- |
| `src/integrations/supabase/` | client.ts, types.ts | 正常的目錄結構                              |
| `src/integrations:supabase/` | client.ts, types.ts | ⚠️ 目錄名稱包含冒號，這不是標準的目錄命名 |

**技術分析**:

- 帶冒號的目錄名在 macOS 和 Linux 上是有效的，但在 Windows 上無效
- 這可能是由於複製操作或版本控制問題而意外創建的
- 不是標準配置，應該清理

**推薦操作**:

1. ✅ **保留**: `src/integrations/supabase/` （正常的結構）
2. 🗑️ **刪除**: `src/integrations:supabase/` （異常的目錄）

---

### 4. 配置文件衝突

#### 4.1 `.gitignore` 文件衝突


| 文件            | 位置       | 內容                  | 狀態      |
| --------------- | ---------- | --------------------- | --------- |
| `.gitignore`    | 項目根目錄 | 只有`node_modules`    | ❌ 不完整 |
| `gitignore.txt` | 項目根目錄 | 標準的完整 .gitignore | ✅ 完整   |

**預期內容** (.gitignore 應包含):

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

**推薦操作**:

1. 將 `gitignore.txt` 的內容複製到 `.gitignore`
2. 🗑️ **刪除** `gitignore.txt`
3. 驗證 `.gitignore` 已添加到 git

---

#### 4.2 `.env.local` 文件衝突


| 文件         | 位置       | 內容              | 狀態      |
| ------------ | ---------- | ----------------- | --------- |
| `.env.local` | 項目根目錄 | Supabase 環境變量 | ✅ 有效   |
| `env.txt`    | 項目根目錄 | 完全相同內容      | ⚠️ 重複 |

**內容**:

```
VITE_SUPABASE_PROJECT_ID="cvgttblfbuabhperfbkz"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://cvgttblfbuabhperfbkz.supabase.co"
```

**安全風險**: ⚠️

- `env.txt` 文件會讓敏感信息暴露在版本控制中
- `.env.local` 已在 .gitignore 中（應該被保護）
- `env.txt` 可能意外被提交到 git

**推薦操作**:

1. 🗑️ **刪除** `env.txt`
2. ✅ **保留** `.env.local`
3. 更新 `.gitignore 確保 env.txt 被忽略 (已經是)`

---

## 🎯 清理計畫

### 優先級 1 - 必須執行 (無副作用)

```bash
# 刪除完全重複的目錄
rm -rf src/components/contexts/
rm -rf src/components/hooks/
rm -rf src/integrations:supabase/

# 刪除重複配置文件
rm env.txt
rm gitignore.txt
```

### 優先級 2 - 配置修復 (需驗證後執行)

```bash
# 修復 .gitignore
# 1. 使用 gitignore.txt 的內容替換 .gitignore
# 2. 確認文件已正確保存
```

---

## 📊 清理前後對比

### 清理前

```
src/
├── components/
│   ├── contexts/          ⚠️ 非必要
│   │   ├── MultiViewContext.tsx
│   │   └── SettingsContext.tsx
│   └── hooks/             ⚠️ 非必要
│       ├── use-mobile.tsx
│       ├── use-toast.ts
│       ├── useHolodex.ts
│       └── useSyncWatch.ts
├── contexts/              ✅ 正在使用
│   ├── MultiViewContext.tsx
│   └── SettingsContext.tsx
├── hooks/                 ✅ 正在使用
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   ├── useHolodex.ts
│   └── useSyncWatch.ts
└── integrations/
    ├── supabase/          ✅ 正在使用
    │   ├── client.ts
    │   └── types.ts
    └── integrations:supabase/  ⚠️ 異常目錄名
        ├── client.ts
        └── types.ts

根目錄:
├── .gitignore             ⚠️ 不完整
├── gitignore.txt          ⚠️ 重複
├── .env.local             ✅ 正在使用
└── env.txt                ⚠️ 重複且有安全風險
```

### 清理後

```
src/
├── components/            ✅ 已清理
│   └── (不再有contexts和hooks)
├── contexts/              ✅ 唯一來源
│   ├── MultiViewContext.tsx
│   └── SettingsContext.tsx
├── hooks/                 ✅ 唯一來源
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   ├── useHolodex.ts
│   └── useSyncWatch.ts
└── integrations/
    └── supabase/          ✅ 唯一來源
        ├── client.ts
        └── types.ts

根目錄:
├── .gitignore             ✅ 已修復
├── .env.local             ✅ 唯一來源
└── (env.txt 已刪除)
```

---

## 🔐 安全建議

1. **立即刪除** `env.txt` - 避免敏感數據泄露
2. 確認 `.gitignore` 包含：
   - `.env.local`
   - `env.txt`
   - 所有其他敏感文件
3. 檢查 git 歷史，確保 `env.txt` 未被提交：
   ```bash
   git log --all --full-history -- env.txt
   ```

---

## ✅ 驗證清單

清理後執行以下檢查：

- [ ]  刪除了 `src/components/contexts/`
- [ ]  刪除了 `src/components/hooks/`
- [ ]  刪除了 `src/integrations:supabase/`
- [ ]  刪除了 `env.txt`
- [ ]  更新了 `.gitignore` 為完整版本
- [ ]  刪除了 `gitignore.txt`
- [ ]  執行 `npm run lint` 無錯誤
- [ ]  執行 `npm run build` 成功
- [ ]  本地開發環境 (`npm run dev`) 正常運行
- [ ]  git 狀態檢查無異常

---

## 📝 備註

- 此分析是於 2026年3月22日執行
- 所有重複文件的內容已驗證
- 推薦操作僅影響非必要文件，不會有功能破壞
- 清理完成後項目會更加維護和整潔
