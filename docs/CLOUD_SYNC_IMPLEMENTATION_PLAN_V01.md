# Climbing Growth System - Cloud Sync Implementation Plan V0.1

**建立日期：** 2026-05-21  
**文件版本：** V0.1  
**目標版本：** v0.2-CLOUD 雲端測試版  
**維護者：** Climbing Growth System Team  

---

## 一、雲端測試版核心目標

### 本階段不是：
- ❌ **靜態展示版** - 不是給陌生人隨便看看的 demo
- ❌ **單機 localStorage 版** - 不是只在一台電腦上運作的工具
- ❌ **完整 SaaS 版** - 不是面向大眾的付費服務平台

### 而是：
- ✅ **雲端測試版** - tester 與 owner 可登入的協作測試環境
- ✅ **真實資料留存** - tester 在自己電腦新增的 Daily Journal，owner 在自己電腦可看到
- ✅ **跨裝置同步** - owner / tester 換電腦登入，都能存取完整歷史資料
- ✅ **雙向留言同步** - tester 留言給 owner，owner 回覆，雙向可見
- ✅ **雲端資料主導** - 重要資料存在雲端，localStorage 降為快取角色

### 核心價值主張：
「讓 tester 成為真正的使用者，而不只是本機試玩者。讓 owner 能追蹤真實的測試使用狀況。」

---

## 二、使用者角色與權限

### 1. Owner (Xavier) - 開發者
**權限範圍：**
```javascript
可讀資料: {
  "自己的 entries": "full access - create/read/update/delete",
  "自己的 programs": "full access - create/read/update/archive",
  "自己的 messages": "full access - send/receive",
  "tester 的 entries": "read-only - 查看測試使用狀況",
  "tester 留給自己的 messages": "read-only - 接收 feedback",
  "系統狀態": "debug tools access"
}

可寫資料: {
  "回覆 tester": "可發送 developer/official 類型留言",
  "管理自己的所有資料": "entries/programs CRUD",
  "程式封存": "archive/unarchive custom programs"
}

不可做: {
  "修改 tester entries": "保持資料完整性",
  "刪除 tester messages": "保持溝通記錄",
  "複雜 admin dashboard": "v0.2 暫不開發"
}
```

### 2. Tester (Alice) - 測試員
**權限範圍：**
```javascript
可讀資料: {
  "自己的 entries": "full access - 完整訓練歷史",
  "自己的 programs": "full access - 自訂程式管理",
  "自己的 messages": "full access - 留言歷史",
  "owner 回覆自己的 messages": "read-only - 查看開發者回應",
  "公開預設 programs": "read-only - 使用內建訓練程式"
}

可寫資料: {
  "新增訓練紀錄": "Daily Journal entries",
  "管理自訂程式": "create/archive custom programs",
  "留言給 owner": "user/auto 類型留言"
}

不可做: {
  "查看 owner 私人 entries": "隱私保護",
  "查看其他 tester 資料": "資料隔離",
  "系統管理功能": "非管理員權限"
}
```

### 3. Guest - 訪客
**權限範圍：**
```javascript
運作模式: {
  "不登入": "無需帳號驗證",
  "不進雲端": "完全本機運作",
  "sessionStorage only": "關閉瀏覽器即清除",
  "展示用途": "體驗功能，不留存資料"
}

限制: {
  "無跨裝置同步": "資料僅存當前 session",
  "無留言功能": "無法與其他角色溝通",
  "無雲端備份": "資料遺失風險由用戶承擔"
}
```

---

## 三、Supabase Auth + profiles 設計

### 認證責任分工

**Supabase Auth 負責：**
- ✅ email / password 儲存與驗證
- ✅ session 管理與 token 簽發
- ✅ 登入安全 (hash, salt, 防暴力破解)
- ✅ 密碼重設 / email 驗證 (未來擴展)

**我們的 profiles 表負責：**
- ✅ 使用者角色管理 (owner/tester)
- ✅ 顯示名稱 (Xavier/Alice)
- ✅ 使用者名稱 (owner/tester)
- ✅ 建立時間與更新時間追蹤

### profiles 表設計
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL CHECK (username IN ('owner', 'tester')),
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'tester')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立測試資料
INSERT INTO auth.users (email, password_hash) VALUES 
    ('xavier@climbing.dev', '[由 Supabase Auth 管理]'),
    ('alice@climbing.dev', '[由 Supabase Auth 管理]');

INSERT INTO profiles (id, username, display_name, role) VALUES
    ('[xavier_uuid]', 'owner', 'Xavier', 'owner'),
    ('[alice_uuid]', 'tester', 'Alice', 'tester');
```

### 前端認證流程
```javascript
登入流程: {
  "1. 使用者輸入": "xavier@climbing.dev / password",
  "2. Supabase Auth": "驗證密碼，回傳 session",
  "3. 查詢 profiles": "根據 auth.users.id 取得 role/display_name",
  "4. 設定 app 狀態": "this.currentUser = 'owner', displayName = 'Xavier'",
  "5. 拉取用戶資料": "entries/messages 從 cloud 載入"
}

登出流程: {
  "1. 清除 session": "Supabase Auth signOut()",
  "2. 清除本機快取": "localStorage cache 清空",
  "3. 回到身份選擇": "guest/owner/tester 選擇畫面"
}
```

---

## 四、雲端資料表 MVP 草案

### A. profiles (已設計於上一章節)

### B. entries - 訓練紀錄
```sql
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- 時間資訊
    legacy_timestamp TEXT NOT NULL,           -- 保留前端 ISO string 格式
    date TEXT NOT NULL,                       -- YYYY-MM-DD
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 訓練基本資訊
    today_condition TEXT,                     -- good/normal/tired/exhausted
    training_type TEXT,                       -- 攀岩/功能訓練
    
    -- Program 關聯 (歷史快照)
    program_id TEXT,                          -- program_core, program_custom_xxx
    program_name_snapshot TEXT,               -- "核心", "外攀高腳期" (封存後仍需顯示)
    program_category_snapshot TEXT,           -- "核心", "攀岩技術" (歷史脈絡)
    
    -- 完成度與狀態
    completion TEXT,                          -- all/most/half/little
    item_states JSONB,                        -- 新格式 {"高腳": "strong", "張力": "missed"}
    missed_items JSONB,                       -- 相容格式 ["item1", "item2"]
    special_items JSONB,                      -- 相容格式 ["item3", "item4"]
    
    -- 備註
    movement_notes TEXT,                      -- movement 觀察
    
    -- 索引
    INDEX idx_entries_user_date (user_id, date),
    INDEX idx_entries_user_timestamp (user_id, legacy_timestamp),
    INDEX idx_entries_updated (updated_at)
);
```

**設計說明：**
- `legacy_timestamp TEXT`：保留現有前端 timestamp 格式，避免大幅改動
- `program_*_snapshot`：Program 封存後，Entry 仍需顯示歷史名稱與類別
- `item_states` + `missed_items/special_items`：新舊格式並存，確保相容性
- `user_id` 外鍵：確保資料隔離，owner/tester 分別擁有

### C. messages - 留言系統
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL = 廣播
    
    -- 留言內容
    type TEXT NOT NULL CHECK (type IN ('user', 'auto', 'developer', 'official')),
    text TEXT NOT NULL,
    
    -- 時間與狀態
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,                      -- 已讀時間 (未來功能)
    
    -- 索引
    INDEX idx_messages_conversation (from_user_id, to_user_id, created_at),
    INDEX idx_messages_unread (to_user_id, read_at)
);
```

**type 說明：**
- `user`：tester 一般留言
- `auto`：系統自動回覆 (根據留言次數)
- `developer`：owner 非正式回覆
- `official`：owner 正式回覆

### D. programs - 訓練程式 (後段 Phase)
```sql
CREATE TABLE programs (
    id TEXT PRIMARY KEY,                      -- program_core, program_custom_xxx
    user_id UUID REFERENCES profiles(id),    -- NULL = 預設程式, 有值 = 自訂程式
    
    -- 程式資訊
    name TEXT NOT NULL,                       -- "核心", "外攀高腳期"
    type TEXT NOT NULL,                       -- 攀岩/功能訓練
    category TEXT,                            -- 核心/肩胛/攀岩技術
    items JSONB NOT NULL,                     -- ["高腳", "張力", "route reading"]
    
    -- 狀態管理
    is_default BOOLEAN DEFAULT FALSE,         -- 預設程式標記
    archived BOOLEAN DEFAULT FALSE,           -- 封存狀態
    archived_at TIMESTAMPTZ,                 -- 封存時間
    
    -- 時間追蹤
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 索引
    INDEX idx_programs_user_type (user_id, type),
    INDEX idx_programs_active (archived, is_default)
);
```

---

## 五、RLS 權限概念

### entries 表權限
```sql
-- tester 可管理自己的 entries
CREATE POLICY "Users can manage own entries" 
ON entries FOR ALL 
USING (auth.uid() = user_id);

-- owner 可讀取所有 entries (包含 tester 的)
CREATE POLICY "Owner can read all entries"
ON entries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'owner'
    )
);

-- tester 不可讀取 owner 的 entries
CREATE POLICY "Tester cannot read owner entries"
ON entries FOR SELECT
USING (
    auth.uid() = user_id OR
    NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id AND role = 'owner'
    )
);
```

### messages 表權限
```sql
-- 使用者可看與自己相關的 messages
CREATE POLICY "Users can read own messages"
ON messages FOR SELECT
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- 使用者可發送 messages
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (from_user_id = auth.uid());

-- 使用者可更新自己已讀狀態
CREATE POLICY "Users can update read status"
ON messages FOR UPDATE
USING (to_user_id = auth.uid())
WITH CHECK (to_user_id = auth.uid());
```

### programs 表權限 (後段實作)
```sql
-- 使用者可管理自己的 custom programs
CREATE POLICY "Users can manage own programs"
ON programs FOR ALL
USING (user_id = auth.uid());

-- 所有登入者可讀取預設 programs
CREATE POLICY "Users can read default programs"
ON programs FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());
```

---

## 六、localStorage 與 cloud 關係

### 第一版策略：Cloud Primary, Local Cache

```javascript
資料流向: {
  "cloud": "正式主資料 (source of truth)",
  "localStorage": "快取 / 效能 / fallback / 過渡層",
  "sessionStorage": "guest 模式專用 (不變)"
}

登入後流程: {
  "1. 從 cloud 拉取": "SELECT entries/messages WHERE user_id = current_user",
  "2. 寫入本機快取": "localStorage.setItem('climbingTrainingEntries_owner', json)",
  "3. UI 從本機渲染": "this.entries = loadFromStorage() // 效能優化",
  "4. 顯示同步狀態": "showToast('雲端資料已同步')"
}

儲存時流程: {
  "1. 先更新 UI": "this.entries.push(newEntry) // 即時反應",
  "2. 先存本機": "localStorage.setItem() // 容錯",
  "3. 再寫雲端": "await supabase.from('entries').insert()",
  "4. 處理失敗": "失敗時 showToast('同步失敗，資料已保存本機')"
}
```

### 保留本機的資料類型
```javascript
純本機狀態 (不需雲端): {
  "currentUser": "當前登入身份 (session)",
  "messageUnread_*": "未讀提示 (裝置相關)",
  "onboardingSeen_*": "引導完成 (裝置相關)",
  "form_draft_*": "表單草稿 (會話相關)",
  "ui_collapsed_*": "UI 摺疊狀態 (偏好但不關鍵)",
  "cache_timestamps": "最後同步時間 (效能優化)"
}

雲端快取 (提升效能): {
  "entries_cache": "最近 30 天 entries",
  "messages_cache": "最近 50 則 messages",  
  "programs_cache": "active programs",
  "sync_status": "pending/synced/failed"
}
```

### 暫時不做的複雜同步
```javascript
v0.3_以後: {
  "pending_sync": "離線時儲存，上線後批次同步",
  "conflict_resolution": "兩端都修改時的合併邏輯",
  "real_time": "websocket 即時更新",
  "partial_sync": "只同步變更部分",
  "compression": "大量資料壓縮傳輸"
}
```

---

## 七、MVP 同步策略

### 採用策略：「登入拉取 + 儲存推送 + 重整刷新」

```javascript
同步時機: {
  "登入時": "一次性從 cloud 拉取所有資料",
  "儲存時": "每次新增 entry/message 寫入 cloud",
  "重新整理時": "重新從 cloud 拉取最新資料",
  "登出時": "清除本機快取"
}

不做即時同步原因: {
  "產品需求": "owner/tester 不會同時線上編輯同一筆資料",
  "使用場景": "多為各自記錄，偶爾查看對方資料",
  "開發複雜度": "realtime 需要額外架構，不符合 MVP 快速驗證目標",
  "資源考量": "websocket 連線成本高，刷新頁面即可更新"
}

錯誤處理: {
  "網路斷線": "顯示 '同步失敗，資料已保存本機'",
  "寫入失敗": "保持本機資料，提示稍後重試",
  "讀取失敗": "使用本機快取，顯示 '無法連接雲端'",
  "權限錯誤": "提示重新登入"
}
```

### 第一版同步流程
```javascript
// 登入成功後
async function syncAfterLogin(userId) {
    try {
        // 1. 拉取 entries
        const { data: entries } = await supabase
            .from('entries')
            .select('*')
            .eq('user_id', userId)
            .order('legacy_timestamp', { ascending: false });
        
        // 2. 拉取 messages (owner 可看 tester 的)
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
            .order('created_at', { ascending: true });
            
        // 3. 寫入本機快取
        localStorage.setItem('climbingTrainingEntries_owner', JSON.stringify(entries));
        localStorage.setItem('climbingMessages_owner', JSON.stringify(messages));
        
        // 4. 更新 UI
        this.loadFromStorage();
        this.renderEntries();
        this.renderMessages();
        
        showToast('雲端資料已同步');
    } catch (error) {
        showToast('同步失敗，使用本機資料');
    }
}

// 儲存 entry 時
async function saveEntry(entryData) {
    try {
        // 1. 先更新本機 (即時反應)
        this.entries.push(entryData);
        this.saveData();
        
        // 2. 寫入雲端 (背景同步)
        const { error } = await supabase
            .from('entries')
            .insert({
                user_id: getCurrentUserId(),
                legacy_timestamp: entryData.timestamp,
                date: entryData.date,
                // ... 其他欄位
            });
            
        if (error) throw error;
        
    } catch (error) {
        console.error('雲端同步失敗:', error);
        showToast('資料已保存本機，雲端同步失敗');
    }
}
```

---

## 八、實作 Phase 拆分

### Phase 1：Supabase Project & Schema (3-4 天)
```javascript
目標: "建立雲端基礎架構"

任務清單: [
    "建立 Supabase 專案",
    "設定 profiles/entries/messages 表結構",
    "建立基本 RLS 政策",
    "建立 owner/tester 測試帳號",
    "手動測試 CRUD 操作"
]

驗收標準: [
    "可在 Supabase 介面看到完整 schema",
    "RLS 政策正確限制 owner/tester 權限",
    "測試帳號可正常登入",
    "手動 SQL insert/select 成功"
]

風險評估: {
    "Supabase 學習曲線": "🟡 中風險 - 需熟悉 Auth + RLS",
    "Schema 設計錯誤": "🟢 低風險 - 可後續 migration 調整",
    "測試資料準備": "🟢 低風險 - 手動建立即可"
}
```

### Phase 2：Auth Login MVP (2-3 天)
```javascript
目標: "前端整合 Supabase 認證"

任務清單: [
    "安裝 @supabase/supabase-js",
    "替換現有 hardcode 驗證邏輯",
    "整合 Supabase Auth.signInWithPassword()",
    "查詢 profiles 表取得 role",
    "保留 guest 模式本機邏輯"
]

程式修改範圍: [
    "IDENTITY_CONFIG → Supabase Auth",
    "authenticateUser() → supabase.auth.signIn()",
    "initializeApp() → 增加 cloud 資料拉取",
    "新增 supabaseClient.js 設定檔"
]

驗收標準: [
    "owner@climbing.dev 可成功登入",
    "tester@climbing.dev 可成功登入",
    "guest 模式仍可正常使用",
    "登入後 this.currentUser 正確設定"
]
```

### Phase 3：Entries Cloud Write (2-3 天)
```javascript
目標: "新增 entry 寫入雲端"

任務清單: [
    "修改 saveData() 增加 cloud insert",
    "建立 entry 資料格式轉換函式",
    "處理 legacy_timestamp 與 created_at",
    "錯誤處理與 fallback 邏輯"
]

技術重點: [
    "保持現有 localStorage 邏輯作為備援",
    "確保 program_*_snapshot 正確儲存",
    "item_states 與 missed_items 格式相容",
    "user_id 正確關聯到當前登入者"
]

驗收標準: [
    "tester 新增 entry，Supabase 可看到資料",
    "本機與雲端資料格式一致",
    "網路失敗時本機仍可運作",
    "timestamp 格式正確保留"
]
```

### Phase 4：Entries Cloud Read (2-3 天)
```javascript
目標: "跨裝置讀取 entries"

任務清單: [
    "修改 loadFromStorage() 增加 cloud fetch",
    "owner 可讀取 tester entries",
    "tester 只能讀取自己的 entries",
    "本機快取策略實作"
]

權限驗證: [
    "tester 登入只看到自己的 entries",
    "owner 登入可看到所有 entries",
    "RLS 政策正確阻止未授權存取",
    "entries 按時間正確排序"
]

驗收標準: [
    "owner 換電腦登入看到完整訓練歷史",
    "tester 換電腦登入看到自己的紀錄",
    "owner 可查看 tester 的真實使用資料",
    "entries 顯示格式與本機版本一致"
]
```

### Phase 5：Messages Cloud Sync (3-4 天)
```javascript
目標: "留言跨使用者同步"

任務清單: [
    "修改 addMessage() 寫入 Supabase messages",
    "修改 renderMessages() 拉取雲端留言",
    "實作 owner ↔ tester 雙向可見",
    "保留現有 auto reply 邏輯"
]

溝通流程: [
    "tester 留言 → cloud → owner 可見",
    "owner 回覆 → cloud → tester 可見",  
    "auto reply 仍由前端產生後寫入 cloud",
    "type 欄位正確標記留言類型"
]

驗收標準: [
    "tester 留言，owner 重新整理後可見",
    "owner 回覆，tester 重新整理後可見",
    "留言時間順序正確",
    "auto reply 機制正常運作"
]
```

### Phase 6：Programs Cloud Sync (3-4 天) 
```javascript
目標: "自訂 programs 與封存狀態同步"

任務清單: [
    "修改 createProgram() 寫入 cloud",
    "修改 archiveProgram() 同步封存狀態",
    "確保預設 programs 與自訂分離",
    "entries 與 programs 關聯完整性"
]

複雜邏輯: [
    "archived program 不出現在新增 entry 選單",
    "舊 entry 編輯時 includeArchived 仍正確",
    "program_*_snapshot 歷史資料保留",
    "custom program ID 衝突處理"
]

驗收標準: [
    "tester 建立 custom program，owner 看得到",
    "program 封存後新增紀錄選單正確過濾",
    "編輯舊 entry 時 archived program 仍可選",
    "跨裝置 program 狀態一致"
]
```

### Phase 7：Deploy Cloud Test Version (2-3 天)
```javascript
目標: "生產環境部署測試"

任務清單: [
    "設定 Vercel 環境變數",
    "Supabase production 配置",
    "DNS 設定與 HTTPS",
    "效能與錯誤監控"
]

測試項目: [
    "climbing-system.vercel.app 可正常存取",
    "owner/tester 真機註冊登入",
    "跨裝置資料同步驗證",
    "手機瀏覽器相容性測試"
]

驗收標準: [
    "生產環境穩定運行 48 小時無重大錯誤",
    "owner 可在不同裝置看到 tester 真實資料",
    "tester 可留下真實 feedback 給 owner",
    "guest 模式仍可正常展示功能"
]
```

---

## 九、現在不做清單

### 立即同步與即時功能
- ❌ **Realtime subscription** - websocket 即時更新留言/entries
- ❌ **Live collaboration** - 多人同時編輯同一筆 entry
- ❌ **Push notification** - 新留言即時通知
- ❌ **Auto refresh** - 每分鐘自動檢查更新

### 複雜同步機制
- ❌ **Offline sync queue** - 離線時儲存操作，上線後批次同步
- ❌ **Conflict resolution UI** - 衝突發生時讓使用者選擇版本
- ❌ **Pending sync indicator** - 顯示哪些資料尚未同步
- ❌ **Incremental sync** - 只同步變更部分，減少傳輸量

### 進階使用者管理
- ❌ **多組織管理** - 超過 owner/tester 的複雜權限
- ❌ **教練 dashboard** - 管理多個學員的後台
- ❌ **使用者註冊** - 開放任意用戶自行註冊
- ❌ **付費訂閱** - 不同方案與付款整合

### 資料分析與智能功能
- ❌ **AI 分析** - 訓練模式分析與建議
- ❌ **統計報表** - 複雜的資料視覺化
- ❌ **匯出整合** - 與其他健身 app 的資料同步
- ❌ **機器學習** - 個人化訓練建議

### 大型 UI 重構
- ❌ **全新設計語言** - 保持現有 UI 風格
- ❌ **手機 App** - 仍以 PWA 形式提供
- ❌ **多語言** - 暫保持中文介面
- ❌ **無障礙優化** - 基本功能優先

### 企業功能
- ❌ **單一登入 (SSO)** - OAuth Google/Facebook 等
- ❌ **稽核日誌** - 詳細的操作歷史記錄
- ❌ **資料匯出/備份** - 大量資料定期備份
- ❌ **API 開放** - 第三方整合介面

**重要澄清：**
以上不是「永遠不做」，而是「不放在雲端測試版 MVP」。目標是先驗證核心價值：「tester 真實資料 + owner 可見 + 跨裝置同步」，確認方向正確後再考慮進階功能。

---

## 十、下一步最小動作

### 完成本文件後的立即行動

**下一個任務應該是：**
```
v0.2-CLOUD-2｜Supabase Project Setup Checklist
```

**但本次只產出文件，實作需等待確認：**

1. **架構確認**
   - [ ] 確認 Supabase Auth + profiles 策略
   - [ ] 確認不自己儲存 password_hash
   - [ ] 確認 legacy_timestamp TEXT 欄位設計
   - [ ] 確認 program_*_snapshot 保留歷史脈絡

2. **範圍確認** 
   - [ ] 確認 MVP 只做 owner/tester 雙人協作
   - [ ] 確認不做 realtime，採用刷新策略
   - [ ] 確認 programs sync 放到後段 Phase

3. **技術確認**
   - [ ] 確認選用 Supabase 而非自建 backend
   - [ ] 確認保留 localStorage 作為快取層
   - [ ] 確認錯誤處理採用 fallback 策略

### 預期的後續任務序列
```
v0.2-CLOUD-2｜Supabase Project Setup Checklist
v0.2-CLOUD-3｜Auth Integration Implementation  
v0.2-CLOUD-4｜Entries Cloud Write Implementation
v0.2-CLOUD-5｜Entries Cloud Read Implementation
v0.2-CLOUD-6｜Messages Cloud Sync Implementation
v0.2-CLOUD-7｜Programs Cloud Sync Implementation
v0.2-CLOUD-8｜Production Deployment & Testing
```

### 關鍵里程碑
- **Week 1**: Supabase 設定完成，可手動測試 CRUD
- **Week 2**: Auth 整合完成，owner/tester 可登入
- **Week 3**: Entries 同步完成，跨裝置可見訓練資料  
- **Week 4**: Messages 同步完成，雙向留言可見
- **Week 5**: Programs 同步完成，自訂程式跨裝置管理
- **Week 6**: 生產部署完成，真實環境驗收

**最終目標確認：**
tester 在自己電腦留下的真實訓練紀錄，owner 在自己電腦可以看到並提供有價值的回饋。讓測試不再只是「試玩」，而是真正的「使用」。

---

*最後更新：2026-05-21*  
*下一步：等待架構確認後開始 v0.2-CLOUD-2*