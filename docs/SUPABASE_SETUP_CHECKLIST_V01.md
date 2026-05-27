# Climbing Growth System - Supabase Setup Checklist V0.1

**建立日期：** 2026-05-21  
**文件版本：** V0.1  
**階段：** v0.2-CLOUD Phase 1 - Database Setup  
**前置需求：** docs/CLOUD_SYNC_IMPLEMENTATION_PLAN_V01.md  
**下一階段：** v0.2-CLOUD-3｜Create Supabase Project & Tables  

---

## 一、Supabase 專案建立步驟

### 1.1 建立專案流程
```
1. 前往 https://supabase.com/dashboard
2. 點擊 "New Project"
3. 選擇 Organization (個人帳戶或團隊)
4. 輸入專案資訊：

Project Name: climbing-growth-system
Database Name: climbing-growth-db  
Password: <產生強密碼，記錄在安全位置>
Region: Asia Pacific (Singapore) ap-southeast-1
Pricing Plan: Free tier (Development)
```

### 1.2 地區選擇建議
```
推薦選擇: Asia Pacific (Singapore) ap-southeast-1

原因:
✅ 台灣用戶延遲最低
✅ 支援所有 Supabase 功能
✅ 穩定性與可靠性佳
✅ 符合資料在地化考量

備選: Asia Pacific (Tokyo) ap-northeast-1
不推薦: 歐美地區 (延遲過高)
```

### 1.3 需要保存的關鍵資訊
```javascript
必須記錄: {
    "Project URL": "https://[project-id].supabase.co",
    "API URL": "https://[project-id].supabase.co/rest/v1/",
    "Anon Key": "eyJ0eXAi... (可放前端)",
    "Service Role Key": "eyJ0eXAi... (絕對不可放前端!)"
}

安全位置: {
    "本機 .env 檔案": "開發環境使用",
    "Vercel 環境變數": "生產環境使用",
    "密碼管理工具": "備份 service key"
}
```

### 1.4 環境變數規劃
```bash
# .env.local (可放前端的公開資訊)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAi...

# .env (後端/私密資訊，不可放前端)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://...

# 安全原則
✅ NEXT_PUBLIC_ 前綴的可以放前端
❌ 沒有前綴的不可放前端
❌ SERVICE_ROLE_KEY 絕對不可放前端
❌ .env 檔案不可上傳到 Git
```

---

## 二、資料表建立順序

### 建立順序與理由

```javascript
Phase_1_必要表: {
    "1. profiles": "使用者身份管理，Auth 的基礎",
    "2. entries": "核心功能，訓練紀錄同步",
    "3. messages": "留言系統，owner ↔ tester 溝通"
}

Phase_2_進階表: {
    "4. programs": "自訂程式同步，較複雜但非核心"
}
```

### 優先順序說明
```
entries / messages 優先原因:
✅ 直接滿足核心需求: "tester 資料 owner 可見"
✅ 複雜度適中，容易驗證
✅ 與現有 localStorage 格式相近
✅ 可以快速看到跨裝置同步效果

programs 後段原因:
⚠️ 涉及預設程式 vs 自訂程式權限
⚠️ 封存狀態同步邏輯較複雜  
⚠️ 與 entries 關聯性需要仔細處理
⚠️ 非最小可行產品的關鍵路徑
```

---

## 三、SQL Schema 草案

### 3.1 profiles 表
```sql
-- 使用者設定檔表
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL CHECK (username IN ('owner', 'tester')),
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'tester')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自動更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- 建立索引
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 註解說明
COMMENT ON TABLE profiles IS '使用者設定檔，連接 Supabase Auth';
COMMENT ON COLUMN profiles.username IS 'owner 或 tester，用於前端身份識別';
COMMENT ON COLUMN profiles.display_name IS '顯示名稱，如 Xavier, Alice';
COMMENT ON COLUMN profiles.role IS '角色權限，決定資料存取範圍';
```

### 3.2 entries 表
```sql
-- 訓練紀錄表
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- 時間資訊 (保持前端相容性)
    legacy_timestamp TEXT NOT NULL,           -- 前端 ISO string
    date TEXT NOT NULL,                       -- YYYY-MM-DD
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 訓練基本資訊
    today_condition TEXT,                     -- good/normal/tired/exhausted
    training_type TEXT,                       -- 攀岩/功能訓練
    
    -- Program 關聯 (歷史快照保存)
    program_id TEXT,                          -- program_core, program_custom_xxx
    program_name_snapshot TEXT,               -- "核心", "外攀高腳期"
    program_category_snapshot TEXT,           -- "核心", "攀岩技術"
    
    -- 完成度與狀態
    completion TEXT,                          -- all/most/half/little
    item_states JSONB,                        -- 新格式 {"高腳": "strong", "張力": "missed"}
    missed_items JSONB,                       -- 相容格式 ["item1", "item2"]
    special_items JSONB,                      -- 相容格式 ["item3", "item4"]
    
    -- 備註
    movement_notes TEXT,                      -- movement 觀察備註
    
    CONSTRAINT entries_valid_condition CHECK (
        today_condition IN ('good', 'normal', 'tired', 'exhausted')
    ),
    CONSTRAINT entries_valid_training_type CHECK (
        training_type IN ('攀岩', '功能訓練')
    ),
    CONSTRAINT entries_valid_completion CHECK (
        completion IN ('all', 'most', 'half', 'little')
    )
);

-- 更新觸發器
CREATE TRIGGER entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- 建立索引 (查詢效能)
CREATE INDEX idx_entries_user_date ON entries(user_id, date DESC);
CREATE INDEX idx_entries_user_timestamp ON entries(user_id, legacy_timestamp DESC);
CREATE INDEX idx_entries_training_type ON entries(user_id, training_type);
CREATE INDEX idx_entries_updated ON entries(updated_at DESC);

-- 註解說明
COMMENT ON TABLE entries IS '訓練紀錄，Daily Journal 核心資料';
COMMENT ON COLUMN entries.legacy_timestamp IS '保留前端 ISO string 格式時間戳記';
COMMENT ON COLUMN entries.program_name_snapshot IS 'Program 封存後仍需顯示歷史名稱';
COMMENT ON COLUMN entries.item_states IS '新格式狀態記錄 {item: state}';
COMMENT ON COLUMN entries.missed_items IS '相容舊格式的錯失項目';
```

### 3.3 messages 表
```sql
-- 留言系統表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = 廣播
    
    -- 留言內容與類型
    type TEXT NOT NULL CHECK (type IN ('user', 'auto', 'developer', 'official')),
    text TEXT NOT NULL,
    
    -- 時間與狀態
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,                      -- 已讀時間 (未來功能)
    
    CONSTRAINT messages_not_empty CHECK (LENGTH(TRIM(text)) > 0),
    CONSTRAINT messages_valid_type CHECK (type IN ('user', 'auto', 'developer', 'official'))
);

-- 建立索引
CREATE INDEX idx_messages_conversation ON messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON messages(to_user_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(from_user_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(to_user_id, read_at) WHERE read_at IS NULL;

-- 註解說明
COMMENT ON TABLE messages IS '留言系統，owner ↔ tester 雙向溝通';
COMMENT ON COLUMN messages.type IS 'user=一般留言, auto=自動回覆, developer=非正式, official=正式回覆';
COMMENT ON COLUMN messages.to_user_id IS 'NULL 表示廣播給所有人';
COMMENT ON COLUMN messages.read_at IS '已讀時間，NULL=未讀';
```

### 3.4 programs 表 (草案，Phase 2 實作)
```sql
-- 訓練程式表 (後段實作)
CREATE TABLE programs (
    id TEXT PRIMARY KEY,                      -- program_core, program_custom_xxx
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = 預設程式
    
    -- 程式基本資訊
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
    
    CONSTRAINT programs_valid_type CHECK (type IN ('攀岩', '功能訓練')),
    CONSTRAINT programs_items_not_empty CHECK (jsonb_array_length(items) > 0),
    CONSTRAINT programs_archived_logic CHECK (
        (archived = FALSE AND archived_at IS NULL) OR
        (archived = TRUE AND archived_at IS NOT NULL)
    )
);

-- 註解：此表暫時不實作 RLS，Phase 2 階段處理
COMMENT ON TABLE programs IS 'Phase 2 實作：訓練程式管理';
```

---

## 四、RLS 設定草案

### 4.1 RLS 啟用
```sql
-- 啟用 Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- programs 表 Phase 2 再啟用
```

### 4.2 profiles 表權限
```sql
-- 使用者可以讀取自己的 profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- owner 可以讀取 tester profiles (查看溝通對象)
CREATE POLICY "Owner can read tester profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'owner'
    )
);

-- 使用者可以更新自己的 display_name (不可更改 role)
CREATE POLICY "Users can update own display name"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM profiles WHERE id = auth.uid())  -- role 不可變更
);

-- 註：新使用者建立由後端觸發器處理，一般用戶不可直接 INSERT
```

### 4.3 entries 表權限
```sql
-- tester 可以完全管理自己的 entries
CREATE POLICY "Users can manage own entries"
ON entries FOR ALL
USING (
    user_id = auth.uid()
);

-- owner 可以讀取所有 entries (包含 tester 的)
CREATE POLICY "Owner can read all entries"
ON entries FOR SELECT
USING (
    user_id = auth.uid() OR  -- 自己的 entries
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'owner'
    )
);

-- 防止 tester 讀取 owner 的私人 entries (雙重保險)
CREATE POLICY "Tester cannot read owner private entries"
ON entries FOR SELECT
USING (
    user_id = auth.uid() OR  -- 只能看自己的
    NOT EXISTS (
        SELECT 1 FROM profiles owner_profile
        WHERE owner_profile.id = entries.user_id 
        AND owner_profile.role = 'owner'
    )
);

-- tester 只能 INSERT/UPDATE/DELETE 自己的 entries
CREATE POLICY "Users can only modify own entries"
ON entries FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own entries"
ON entries FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only delete own entries"
ON entries FOR DELETE
USING (user_id = auth.uid());
```

### 4.4 messages 表權限
```sql
-- 使用者可以讀取與自己相關的 messages
CREATE POLICY "Users can read own messages"
ON messages FOR SELECT
USING (
    from_user_id = auth.uid() OR 
    to_user_id = auth.uid() OR
    to_user_id IS NULL  -- 廣播訊息
);

-- 使用者只能發送自己的 messages
CREATE POLICY "Users can send own messages"
ON messages FOR INSERT
WITH CHECK (from_user_id = auth.uid());

-- 使用者可以更新自己收到的 messages 已讀狀態
CREATE POLICY "Users can mark messages as read"
ON messages FOR UPDATE
USING (to_user_id = auth.uid())
WITH CHECK (
    to_user_id = auth.uid() AND
    -- 只能更新 read_at，不能改變 message 內容
    text = (SELECT text FROM messages WHERE id = messages.id) AND
    type = (SELECT type FROM messages WHERE id = messages.id) AND
    from_user_id = (SELECT from_user_id FROM messages WHERE id = messages.id)
);
```

### 4.5 RLS 測試語法
```sql
-- 測試 RLS 是否正確運作 (在 SQL Editor 執行)

-- 測試 1: owner 可以看到 tester entries
SELECT COUNT(*) FROM entries;  -- 以 owner 身份應該看到所有

-- 測試 2: tester 只能看到自己的 entries  
SELECT COUNT(*) FROM entries WHERE user_id != auth.uid();  -- 以 tester 身份應該回傳 0

-- 測試 3: message 權限
SELECT * FROM messages WHERE to_user_id = auth.uid();  -- 應該只看到發給自己的
```

---

## 五、測試帳號規劃

### 5.1 Auth 使用者建立
```sql
-- 注意：以下僅為規劃，實際透過 Supabase Auth UI 或程式建立

測試帳號規劃: {
    "owner_account": {
        "email": "xavier@climbing.dev",
        "password": "<在 Supabase Auth 中設定>",
        "role": "owner",
        "display_name": "Xavier"
    },
    "tester_account": {
        "email": "alice@climbing.dev", 
        "password": "<在 Supabase Auth 中設定>",
        "role": "tester",
        "display_name": "Alice"
    }
}

安全原則: {
    "密碼強度": "至少 12 字元，包含大小寫英數字特殊符號",
    "密碼儲存": "只記錄在 password manager，不寫入文件",
    "測試用途": "僅開發測試使用，非正式生產帳戶"
}
```

### 5.2 profiles 資料同步
```sql
-- 建立對應的 profiles 記錄 (手動 INSERT 或觸發器)
-- 注意：auth.users.id 需要在建立 Auth 使用者後取得

INSERT INTO profiles (id, username, display_name, role) VALUES
(
    '<xavier_auth_user_id>',  -- 從 auth.users 表查詢實際 UUID
    'owner', 
    'Xavier', 
    'owner'
),
(
    '<alice_auth_user_id>',   -- 從 auth.users 表查詢實際 UUID
    'tester', 
    'Alice', 
    'tester'
);

-- 驗證是否建立成功
SELECT 
    p.username,
    p.display_name, 
    p.role,
    u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id;
```

### 5.3 自動 Profile 建立觸發器 (推薦)
```sql
-- 當新使用者在 auth.users 建立時自動建立 profile
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 根據 email 判斷角色 (簡化版本)
    INSERT INTO profiles (id, username, display_name, role) VALUES (
        NEW.id,
        CASE 
            WHEN NEW.email = 'xavier@climbing.dev' THEN 'owner'
            WHEN NEW.email = 'alice@climbing.dev' THEN 'tester'
            ELSE NULL  -- 其他帳號需要手動處理
        END,
        CASE 
            WHEN NEW.email = 'xavier@climbing.dev' THEN 'Xavier'
            WHEN NEW.email = 'alice@climbing.dev' THEN 'Alice'
            ELSE SPLIT_PART(NEW.email, '@', 1)  -- 預設使用 email 前綴
        END,
        CASE 
            WHEN NEW.email = 'xavier@climbing.dev' THEN 'owner'
            WHEN NEW.email = 'alice@climbing.dev' THEN 'tester'
            ELSE 'tester'  -- 預設為 tester
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_profile_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_user();
```

---

## 六、手動驗收清單

### 6.1 Supabase 後台驗證步驟

```
Phase 1 - 基礎設定驗證:
✅ Supabase 專案建立成功 (Climbing-system, Tokyo 區域)
✅ 資料庫連線正常
✅ SQL Editor 可以執行查詢
✅ Authentication 設定啟用

Phase 2 - 表結構驗證:
✅ profiles 表建立成功 (含索引與觸發器)
✅ entries 表建立成功 (含索引與觸發器)
✅ messages 表建立成功 (含索引)
✅ 所有索引建立成功
✅ 觸發器運作正常 (updated_at 自動更新)

Phase 3 - 權限驗證:
✅ RLS 政策全部啟用 (profiles/entries/messages)
✅ profiles 權限測試通過 (2條政策)
✅ entries 權限測試通過 (4條政策)
✅ messages 權限測試通過 (3條政策)
```

### 6.2 Auth 功能測試
```sql
-- 在 Supabase Auth UI 驗證:
□ xavier@climbing.dev 可以註冊/登入
□ alice@climbing.dev 可以註冊/登入  
□ 登入後 auth.uid() 正確取得
□ profiles 記錄自動建立
□ role 欄位正確設定

-- SQL 驗證 (以不同身份執行):
□ SELECT * FROM profiles;  -- owner 應該看到兩筆，tester 看到自己
□ SELECT auth.uid();       -- 應該回傳當前登入用戶 UUID
□ SELECT current_setting('request.jwt.claims', true)::json;  -- JWT 解析
```

### 6.3 資料存取測試
```sql
-- 以 tester 身份測試:
□ INSERT INTO entries (...) VALUES (...);  -- 應該成功
□ SELECT * FROM entries;                    -- 只看到自己的
□ INSERT INTO messages (from_user_id, to_user_id, type, text) VALUES (auth.uid(), <owner_id>, 'user', 'test');  -- 應該成功

-- 以 owner 身份測試:
□ SELECT * FROM entries;                    -- 應該看到所有 entries
□ SELECT * FROM messages;                   -- 應該看到相關 messages
□ INSERT INTO entries (...) VALUES (...);  -- 應該成功
□ INSERT INTO messages (from_user_id, to_user_id, type, text) VALUES (auth.uid(), <tester_id>, 'developer', 'reply');  -- 應該成功

-- 權限邊界測試:
□ tester 嘗試 SELECT owner 的 entries     -- 應該失敗或看不到
□ tester 嘗試修改 owner 的 entries       -- 應該失敗
□ tester 嘗試修改自己的 role             -- 應該失敗
```

### 6.4 資料完整性驗證
```sql
-- 約束條件測試:
□ 插入無效的 today_condition             -- 應該失敗
□ 插入無效的 training_type              -- 應該失敗  
□ 插入無效的 message type               -- 應該失敗
□ 插入空的 message text                 -- 應該失敗
□ 建立重複的 username                   -- 應該失敗

-- 外鍵關聯測試:
□ 刪除 profile 後相關 entries 也刪除    -- CASCADE 正常
□ 刪除 profile 後相關 messages 處理     -- to_user_id SET NULL
□ entries.user_id 參照正確的 profile    -- 關聯完整
```

---

## 七、安全注意事項

### 7.1 Key 管理安全
```
❌ 絕對不可做:
- 將 service_role key 放到前端程式碼
- 將 service_role key 上傳到 Git repository  
- 在文件中記錄真實密碼
- 在 localStorage 儲存敏感 token
- 在 console.log 輸出 service key

✅ 必須要做:
- service_role key 只存在伺服器環境變數
- anon key 可以放前端但依賴 RLS 保護
- 所有敏感資訊使用 password manager 管理
- .env 檔案加入 .gitignore  
- 定期 rotate API keys
```

### 7.2 認證安全
```
不自己實作: {
    "password_hash": "交給 Supabase Auth 處理",
    "session_management": "使用 Supabase JWT",
    "password_reset": "使用 Supabase Email Auth",
    "brute_force_protection": "Supabase 內建防護"
}

我們負責: {
    "RLS 權限設計": "確保資料存取範圍正確",
    "business_logic": "角色與權限業務邏輯",
    "frontend_validation": "UI 層級驗證與提示",
    "error_handling": "認證失敗的友善處理"
}
```

### 7.3 資料庫安全
```sql
-- RLS 必須啟用
✅ ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
✅ ALTER TABLE entries ENABLE ROW LEVEL SECURITY;  
✅ ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 敏感操作限制
❌ 不允許: DROP TABLE, TRUNCATE, ALTER TABLE schema
❌ 不允許: 直接操作 auth.users 表
❌ 不允許: 繞過 RLS 的 service_role 查詢
✅ 允許: 透過 RLS 保護的 CRUD 操作
✅ 允許: 透過觸發器的自動化邏輯
```

### 7.4 開發環境安全
```bash
# .gitignore 必須包含
.env
.env.local
.env.production
.env.*.local
supabase/.env
supabase/config.toml

# 開發者須知
❌ 不在 Slack/Discord 貼上完整 API key
❌ 不在螢幕分享時顯示 .env 內容  
❌ 不將測試帳號密碼寫入程式碼註解
✅ 使用環境變數注入敏感資訊
✅ 本機開發使用 .env.local
✅ 生產部署使用 Vercel 環境變數
```

---

## 八、下一步

### 8.1 完成本階段後
```
驗收標準:
✅ Supabase 專案建立完成 (Climbing-system @ Tokyo)
✅ 所有資料表 schema 建立完成 (profiles/entries/messages)
✅ RLS 權限設定完成 (9條政策運作正常)
✅ 測試帳號建立完成 (xavier@climbing.dev, alice@climbing.dev)
✅ 手動驗收測試全數通過 (權限控制正確)
✅ API keys 安全保存完成 (service_role 未放前端)

產出文件:
✅ Supabase project URL 記錄 (安全位置)
✅ API keys 安全儲存 (分離 anon/service_role)
✅ 測試帳號資訊記錄 (profiles 正確建立)
✅ 驗收測試結果記錄 (見 DEV_LOG_V01.md)
```

### 8.2 下一階段任務
```
v0.2-CLOUD-3｜Frontend Auth Integration

目標: 前端整合 Supabase Auth
範圍: 
- 安裝 @supabase/supabase-js
- 替換 hardcode 認證邏輯
- 整合登入/登出流程
- 保留 guest 模式
- 測試認證功能

預估時間: 2-3 工作天
依賴項目: 本階段 Supabase setup 完成
```

### 8.3 風險評估與預防
```javascript
潛在風險: {
    "Supabase 學習曲線": {
        "風險": "RLS 語法不熟悉導致權限設定錯誤",
        "預防": "詳細測試每個權限政策，參考官方文件"
    },
    "測試資料污染": {
        "風險": "開發測試影響正式資料",  
        "預防": "使用獨立測試帳號，clear data 流程"
    },
    "API key 洩漏": {
        "風險": "service key 意外提交到 Git",
        "預防": "設定 .gitignore，使用環境變數"
    }
}

成功標準: {
    "技術驗證": "RLS 權限測試 100% 通過",
    "安全確認": "無敏感資訊洩漏",
    "功能驗證": "owner/tester 角色行為正確",
    "準備完成": "前端整合所需資訊齊全"
}
```

### 8.4 緊急聯絡與支援
```
Supabase 官方資源:
📖 文件: https://supabase.com/docs
💬 Discord: https://discord.supabase.com
📧 Support: 付費方案有 email 支援

開發團隊內部:
📋 將問題記錄在開發日誌
🔍 無法解決時暫停，避免破壞已有進度
🎯 專注 MVP 核心功能，避免過度設計
```

---

*最後更新：2026-05-21*  
*階段：Phase 1 - Supabase Database Setup*  
*下一步：等待驗收通過後執行 v0.2-CLOUD-3*