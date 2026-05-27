# MESSAGE_CLOUD_SYNC_PLAN_V01

**文檔版本：** V01  
**建立日期：** 2026-05-27  
**適用專案：** Climbing Growth System  
**適用範圍：** 留言板雲端同步規劃  

---

## 📋 規劃目的

**目標：** 讓 owner 和 tester 的留言可以跨裝置同步，解決目前純 localStorage 的限制。

**核心原則：**
- ✅ **不做 realtime** - 靜態同步即可
- ✅ **不做複雜 merge** - 簡單的雲端優先策略
- ✅ **不改 UI** - 保持現有留言板介面
- ✅ **不刪 localStorage** - 保留作為 fallback
- ✅ **不影響 entries cloud sync** - 獨立的同步機制

---

## 一、目前留言資料結構分析

### **1.1 localStorage 儲存鍵值**

#### **留言資料**
```javascript
'climbingMessages_owner'   // owner 留言陣列
'climbingMessages_tester'  // tester 留言陣列
```

#### **狀態資料**
```javascript
'messageUnread_tester'                     // tester 未讀狀態 (boolean string)
'climbingMessageOnboardingSeen_owner'      // owner onboarding 狀態
'climbingMessageOnboardingSeen_tester'     // tester onboarding 狀態
```

### **1.2 Message Object 結構**

#### **標準留言格式**
```javascript
// addMessage() 產生的標準格式
{
    text: "留言內容",
    type: "user" | "auto",              // user: 用戶留言, auto: 系統自動回覆
    timestamp: "2026-05-27T10:30:00.000Z"
}
```

#### **跨用戶留言格式**
```javascript
// addMessageToTester() 產生的格式
{
    text: "留言內容", 
    type: "developer" | "official",     // developer: 開發者留言, official: 正式回覆
    timestamp: "2026-05-27T10:30:00.000Z",
    fromUser: "owner",                  // 來源用戶
    fromName: "Xavier",                 // 來源顯示名
    targetUser: "tester"                // 目標用戶
}
```

#### **系統自動回覆格式**
```javascript
// getAutoReply() 產生的格式
{
    text: "📨 開發者已收到訊號！...",
    type: "auto",
    timestamp: "2026-05-27T10:30:00.000Z"
}
```

---

## 二、目前留言流程分析

### **2.1 addMessage() 流程**

#### **觸發場景**
- 用戶在留言輸入框發送留言
- tester 模式自動回覆觸發

#### **執行邏輯**
```javascript
addMessage(text, type) {
    // 1. 載入當前用戶留言陣列
    const messages = this.loadMessages();
    
    // 2. 建立新留言物件
    const message = {
        text: text,
        type: type,
        timestamp: new Date().toISOString()
    };
    
    // 3. 加入陣列
    messages.push(message);
    
    // 4. 寫入 localStorage
    const messagesKey = 'climbingMessages_' + this.currentUser;
    localStorage.setItem(messagesKey, JSON.stringify(messages));
}
```

#### **儲存位置**
- **owner 留言** → `climbingMessages_owner`
- **tester 留言** → `climbingMessages_tester`

### **2.2 addMessageToTester() 流程**

#### **觸發場景**
- owner 透過「發送給 Alice」功能

#### **執行邏輯**
```javascript
addMessageToTester(text) {
    // 1. 直接讀取 tester 留言陣列（跨用戶操作）
    const testerMessages = JSON.parse(localStorage.getItem('climbingMessages_tester') || '[]');
    
    // 2. 建立跨用戶留言物件
    const message = {
        text: text,
        type: 'developer',
        timestamp: new Date().toISOString(),
        fromUser: 'owner',
        fromName: 'Xavier',
        targetUser: 'tester'
    };
    
    // 3. 加入 tester 留言陣列
    testerMessages.push(message);
    
    // 4. 寫入 tester 留言空間
    localStorage.setItem('climbingMessages_tester', JSON.stringify(testerMessages));
    
    // 5. 設定 tester 未讀狀態
    localStorage.setItem('messageUnread_tester', 'true');
}
```

#### **特殊性質**
- 跨用戶寫入 (owner → tester 留言空間)
- 設定未讀狀態通知

### **2.3 loadMessages() 流程**

#### **執行邏輯**
```javascript
loadMessages() {
    // 1. 基於當前用戶決定讀取哪個鍵值
    const messagesKey = 'climbingMessages_' + this.currentUser;
    
    // 2. 從 localStorage 讀取
    const stored = localStorage.getItem(messagesKey);
    
    // 3. 解析並回傳陣列
    return stored ? JSON.parse(stored) : [];
}
```

#### **使用場景**
- tester 模式讀取自己的留言
- 系統檢查用戶留言數量
- 資料品質檢查

### **2.4 loadMessagesForOwnerView() 流程**

#### **執行邏輯**
```javascript
loadMessagesForOwnerView() {
    // 1. 分別讀取 owner 和 tester 留言
    const ownerMessages = JSON.parse(localStorage.getItem('climbingMessages_owner') || '[]');
    const testerMessages = JSON.parse(localStorage.getItem('climbingMessages_tester') || '[]');
    
    // 2. 為留言添加來源標籤（不寫回儲存）
    const ownerWithSource = ownerMessages.map(msg => ({
        ...msg,
        sourceName: msg.type === 'auto' ? '小留言本的回覆' :
                   msg.type === 'official' ? '小留言本的正式回覆' :
                   'Xavier'
    }));
    
    const testerWithSource = testerMessages.map(msg => ({
        ...msg, 
        sourceName: msg.type === 'auto' ? '小留言本的回覆' :
                   msg.type === 'official' ? '小留言本的正式回覆' :
                   msg.type === 'developer' ? 'Xavier' : 'Alice'
    }));
    
    // 3. 合併並按時間排序
    return [...ownerWithSource, ...testerWithSource]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
```

#### **特殊性質**
- 跨用戶讀取 (owner 可看到 tester 留言)
- 動態添加 sourceName 標籤
- 時間排序合併顯示

---

## 三、Supabase Messages Table Schema

### **3.1 資料表結構**
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    from_user_id UUID REFERENCES profiles(id),
    to_user_id UUID REFERENCES profiles(id), 
    type TEXT,  -- 'user', 'auto', 'developer', 'official'
    text TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### **3.2 索引和約束**
- **主鍵**: `id` (UUID)
- **外鍵**: `from_user_id`, `to_user_id` → `profiles(id)`
- **自動時間戳**: `created_at`, `updated_at`

### **3.3 欄位映射分析**

#### **本機 → Supabase 映射**
```javascript
// 標準留言映射
localStorage message = {
    text: "內容",
    type: "user",  
    timestamp: "2026-05-27T10:30:00.000Z"
}

Supabase row = {
    from_user_id: session.user.id,
    to_user_id: session.user.id,     // 自己留言給自己
    type: "user",
    text: "內容", 
    created_at: "2026-05-27T10:30:00.000Z",
    read_at: null
}
```

#### **跨用戶留言映射**
```javascript
// addMessageToTester() 映射
localStorage message = {
    text: "內容",
    type: "developer",
    fromUser: "owner", 
    targetUser: "tester",
    timestamp: "2026-05-27T10:30:00.000Z"
}

Supabase row = {
    from_user_id: owner_uuid,
    to_user_id: tester_uuid,
    type: "developer", 
    text: "內容",
    created_at: "2026-05-27T10:30:00.000Z",
    read_at: null
}
```

---

## 四、RLS Policies 分析

### **4.1 目前政策狀況**
**數量**: 3 條 messages RLS 政策  
**功能**: 雙向溝通 + 已讀更新  
**狀態**: ✅ 已建立但需驗證具體內容

### **4.2 預期政策需求**

#### **Policy 1: Message Select (讀取)**
```sql
-- owner 可讀取所有 messages
-- tester 只能讀取與自己相關的 messages
CREATE POLICY messages_select ON messages FOR SELECT 
USING (
    -- owner 可讀全部
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    OR 
    -- tester 可讀與自己相關的
    (from_user_id = auth.uid() OR to_user_id = auth.uid())
);
```

#### **Policy 2: Message Insert (寫入)**
```sql
-- 只能寫入自己作為 from_user_id 的訊息
CREATE POLICY messages_insert ON messages FOR INSERT 
WITH CHECK (from_user_id = auth.uid());
```

#### **Policy 3: Message Update (已讀更新)**
```sql
-- 只能更新 read_at 欄位，且限制為接收者
CREATE POLICY messages_update ON messages FOR UPDATE 
USING (to_user_id = auth.uid()) 
WITH CHECK (to_user_id = auth.uid());
```

### **4.3 政策驗證清單**
```
□ 確認 Policy 1 允許 owner 讀取 owner + tester messages
□ 確認 Policy 1 限制 tester 只讀自己相關 messages  
□ 確認 Policy 2 允許 owner 寫入 from=owner 的 messages
□ 確認 Policy 2 允許 tester 寫入 from=tester 的 messages
□ 確認 Policy 3 允許已讀狀態更新
□ 確認沒有 DELETE 政策（留言不可刪除）
```

---

## 五、最小同步策略

### **5.1 核心策略原則**

#### **同步時機**
- **寫入時同步** - 每次留言立即寫入雲端
- **面板開啟時同步** - 每次開啟留言面板從雲端讀取
- **定期靜默同步** - 不實作 (避免複雜度)

#### **衝突處理**
- **雲端優先策略** - 雲端資料覆蓋本機資料
- **不做複雜 merge** - 避免三方合併邏輯
- **保留 localStorage 作為 fallback** - 雲端失效時回到本機

#### **錯誤處理**
- **靜默失敗** - 雲端同步失敗不影響主要功能
- **本機優先** - 同步失敗時仍然儲存到 localStorage
- **用戶不感知** - 同步過程對用戶透明

### **5.2 資料流設計**

#### **寫入流程**
```
用戶發送留言
↓
寫入 localStorage (立即完成)
↓  
嘗試寫入 Supabase (背景執行)
↓
成功: 靜默完成
失敗: 記錄但不影響用戶體驗
```

#### **讀取流程**
```
開啟留言面板
↓
嘗試從 Supabase 讀取 (優先)
↓
成功: 顯示雲端資料 + 更新 localStorage
失敗: 顯示 localStorage 資料
```

---

## 六、MVP 三階段實作方案

### **Phase 1: 留言寫入雲端**

#### **目標**
每次新增留言時同步到 Supabase，但不改變讀取邏輯

#### **修改函式**
```javascript
// 1. 新增雲端同步函式
async syncMessageToCloud(message, targetUser = null)

// 2. 修改現有函式加入同步
addMessage(text, type) {
    // 既有 localStorage 邏輯保持不變
    // 新增: this.syncMessageToCloud(message)
}

addMessageToTester(text) {
    // 既有 localStorage 邏輯保持不變  
    // 新增: this.syncMessageToCloud(message, 'tester')
}
```

#### **新增 Supabase API**
```javascript
// supabaseClient.js 新增
window.insertMessage = async (messageData) => {
    // 插入 message 到 Supabase
}
```

#### **Phase 1 驗收標準**
```
□ owner 發送留言 → localStorage + Supabase 都有資料
□ tester 發送留言 → localStorage + Supabase 都有資料
□ owner 發給 tester → localStorage + Supabase 都有資料
□ 網路失敗時 → localStorage 照常運作，雲端同步靜默失敗
□ 留言顯示邏輯完全不變 → 用戶體驗無感
```

### **Phase 2: 開啟留言板時讀取雲端**

#### **目標** 
每次開啟留言面板時從 Supabase 載入最新留言

#### **修改函式**
```javascript
// 1. 新增雲端讀取函式
async loadMessagesFromCloud()
async loadMessagesForOwnerViewFromCloud()

// 2. 修改面板顯示邏輯
showMessagePanel() {
    // 既有邏輯保持
    // 新增: 嘗試從雲端載入，成功則更新顯示
}

// 3. 保留原始函式作為 fallback
loadMessages() // 保持不變，作為離線 fallback
loadMessagesForOwnerView() // 保持不變，作為離線 fallback
```

#### **新增 Supabase API**
```javascript
// supabaseClient.js 新增
window.loadMessagesForUser = async (userId) => {
    // 載入用戶相關留言
}

window.loadAllMessagesForOwner = async () => {
    // 載入 owner 可見的所有留言
}
```

#### **Phase 2 驗收標準**
```
□ owner 開啟留言板 → 顯示雲端最新的 owner + tester 留言
□ tester 開啟留言板 → 顯示雲端最新的 tester 留言
□ A 裝置留言，B 裝置開啟留言板 → 可以看到 A 的留言
□ 網路失敗時 → 回到 localStorage 顯示，功能不中斷
□ 雲端有新留言 → 自動更新 localStorage
```

### **Phase 3: 本機保留 Fallback**

#### **目標**
完善錯誤處理和離線支援，確保系統穩定性

#### **增強功能**
```javascript
// 1. 連線狀態檢測
async checkCloudConnectivity()

// 2. 智能 fallback 邏輯
async loadMessagesWithFallback()

// 3. 同步狀態指示
showSyncStatus(status) // 'synced', 'syncing', 'offline'

// 4. 手動同步觸發
async forceSyncMessages()
```

#### **Fallback 策略**
```javascript
// 讀取優先順序
1. 嘗試 Supabase (網路 + 認證正常)
2. Fallback 到 localStorage (網路失敗)
3. 空陣列 (localStorage 也無資料)

// 寫入優先順序  
1. 寫入 localStorage (立即完成)
2. 背景同步 Supabase (非阻塞)
3. 失敗記錄但不影響用戶
```

#### **Phase 3 驗收標準**
```
□ 離線狀態 → 留言功能完全正常（localStorage）
□ 網路恢復 → 自動同步本機未同步的留言
□ 認證失效 → 自動回到 localStorage 模式
□ 同步狀態 → 用戶可選擇性看到同步指示
□ 手動同步 → 提供手動強制同步選項
□ 錯誤恢復 → 各種錯誤情況都有優雅處理
```

---

## 七、技術實作細節

### **7.1 用戶身份映射**

#### **localStorage User → Supabase User ID**
```javascript
// 需要建立映射函式
async getCurrentSupabaseUserId() {
    const { data: { session }, error } = await window.climbingSupabaseClient.auth.getSession();
    return session?.user?.id || null;
}

async getUserIdByRole(role) {
    // 查詢 profiles 表取得對應 user_id
    const { data, error } = await window.climbingSupabaseClient
        .from('profiles')
        .select('id')
        .eq('role', role)
        .single();
    return data?.id || null;
}
```

### **7.2 資料格式轉換**

#### **localStorage → Supabase**
```javascript
convertMessageToSupabaseFormat(message, fromUserId, toUserId) {
    return {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        type: message.type,
        text: message.text,
        created_at: message.timestamp,
        read_at: null
    };
}
```

#### **Supabase → localStorage**
```javascript
convertSupabaseToLocalMessage(row, profiles) {
    const baseMessage = {
        text: row.text,
        type: row.type,
        timestamp: row.created_at
    };
    
    // 如果是跨用戶留言，添加額外欄位
    if (row.from_user_id !== row.to_user_id) {
        const fromProfile = profiles[row.from_user_id];
        return {
            ...baseMessage,
            fromUser: fromProfile.role,
            fromName: fromProfile.display_name,
            targetUser: profiles[row.to_user_id].role
        };
    }
    
    return baseMessage;
}
```

### **7.3 同步邏輯實作**

#### **寫入同步**
```javascript
async syncMessageToCloud(message, currentUser, targetUser = null) {
    try {
        // 1. 取得當前用戶 ID
        const fromUserId = await this.getCurrentSupabaseUserId();
        if (!fromUserId) return { success: false, reason: 'no_auth' };
        
        // 2. 決定目標用戶 ID
        const toUserId = targetUser ? 
            await this.getUserIdByRole(targetUser) : 
            fromUserId;
        
        // 3. 轉換格式
        const supabaseMessage = this.convertMessageToSupabaseFormat(
            message, fromUserId, toUserId
        );
        
        // 4. 寫入 Supabase
        const { data, error } = await window.climbingSupabaseClient
            .from('messages')
            .insert(supabaseMessage);
            
        return { success: !error, error };
    } catch (error) {
        console.error('Message sync failed:', error);
        return { success: false, error };
    }
}
```

#### **讀取同步**
```javascript
async loadMessagesFromCloud(userRole) {
    try {
        // 1. 檢查認證
        const { data: { session } } = await window.climbingSupabaseClient.auth.getSession();
        if (!session) return { success: false, reason: 'no_auth' };
        
        // 2. 讀取 messages（依 RLS 政策自動過濾）
        const { data: messages, error } = await window.climbingSupabaseClient
            .from('messages')
            .select(`
                *,
                from_profile:profiles!messages_from_user_id_fkey(role, display_name),
                to_profile:profiles!messages_to_user_id_fkey(role, display_name)
            `)
            .order('created_at', { ascending: true });
            
        if (error) return { success: false, error };
        
        // 3. 轉換格式為 localStorage 格式
        const convertedMessages = this.convertCloudMessagesToLocal(messages);
        
        return { success: true, messages: convertedMessages };
    } catch (error) {
        console.error('Load cloud messages failed:', error);
        return { success: false, error };
    }
}
```

---

## 八、風險評估與緩解

### **8.1 🟡 中風險項目**

#### **R1: 資料不一致風險**
**問題**: localStorage 與 Supabase 資料可能不同步
```
影響: 用戶在不同裝置看到不同留言
機率: 30% (網路問題、認證失效)
緩解: 雲端優先策略 + localStorage fallback
```

#### **R2: RLS 政策權限風險**
**問題**: 目前 RLS 政策未經詳細驗證
```
影響: 可能出現越權存取或權限不足
機率: 20% (政策設定錯誤)
緩解: Phase 1 前詳細測試 RLS 政策
```

#### **R3: 認證狀態同步風險**
**問題**: 用戶認證失效但本機狀態未更新
```
影響: 雲端同步靜默失敗，用戶不知情
機率: 15% (認證 token 過期)
緩解: 認證狀態檢查 + 自動 fallback
```

### **8.2 🟢 低風險項目**

#### **R4: 效能影響**
**問題**: 每次留言都要寫入雲端
```
影響: 留言發送延遲
機率: 5% (網路慢)
緩解: 非阻塞背景同步 + localStorage 優先
```

#### **R5: 舊資料相容性**
**問題**: 既有 localStorage 留言格式不相容
```
影響: 舊留言無法正確同步
機率: 10% (資料格式差異)
緩解: 格式轉換函式 + 向前相容設計
```

---

## 九、成功指標與驗收標準

### **9.1 功能指標**

#### **基本功能**
- ✅ owner 在裝置 A 發送留言，裝置 B 可以看到
- ✅ tester 在裝置 A 發送留言，owner 在裝置 B 可以看到
- ✅ 網路斷線時留言功能正常運作
- ✅ 網路恢復時自動同步

#### **權限控制**
- ✅ owner 可以看到所有留言（owner + tester）
- ✅ tester 只能看到自己相關的留言
- ✅ guest 模式完全不使用雲端留言

#### **資料完整性**
- ✅ 雲端與本機留言數量一致
- ✅ 留言時間順序正確
- ✅ 留言內容和類型正確保存

### **9.2 技術指標**

#### **效能指標**
- 留言發送延遲 < 500ms (本機儲存)
- 雲端同步時間 < 2 秒
- 開啟留言面板載入時間 < 1 秒

#### **穩定性指標**
- 雲端同步成功率 > 95% (正常網路環境)
- 離線模式功能正常率 100%
- 認證失效自動 fallback 正常率 > 98%

### **9.3 用戶體驗指標**

#### **無感知同步**
- 用戶發送留言後立即顯示 (不等待雲端同步)
- 同步失敗不影響留言功能
- 跨裝置留言同步對用戶透明

#### **錯誤處理**
- 網路錯誤時有適當提示 (可選)
- 認證失效時自動回到本機模式
- 所有錯誤情況都不導致功能中斷

---

## 十、下一步行動建議

### **10.1 實作前準備 (1-2 小時)**

#### **RLS 政策驗證**
```
□ 登入 Supabase 後台檢查現有 messages 政策
□ 測試 owner 讀取權限（可否看到 tester messages）
□ 測試 tester 讀取權限（是否被限制）
□ 測試寫入權限（from_user_id 限制）
□ 確認政策設定正確無誤
```

#### **測試資料準備**
```
□ 在 Supabase 手動插入測試 messages
□ 驗證 profiles 表 owner/tester 身份正確
□ 確認 auth.users 與 profiles 關聯正常
□ 測試不同權限下的資料可見性
```

### **10.2 Phase 1 實作建議 (4-6 小時)**

#### **開發優先順序**
```
1. 新增 supabaseClient.js message API 包裝
2. 實作 syncMessageToCloud() 核心邏輯
3. 修改 addMessage() 加入同步呼叫
4. 修改 addMessageToTester() 加入同步呼叫
5. 測試各種留言場景的雲端同步
```

#### **測試驗收清單**
```
□ owner 發送留言 → Supabase 有對應記錄
□ tester 發送留言 → Supabase 有對應記錄
□ owner 發給 tester → Supabase 有跨用戶記錄
□ 網路關閉測試 → localStorage 功能正常
□ 網路恢復測試 → 同步恢復正常
```

### **10.3 整體規劃時程**

#### **預估工作量**
```
Phase 1: 寫入雲端同步    - 4-6 小時
Phase 2: 讀取雲端整合    - 6-8 小時  
Phase 3: Fallback 完善   - 4-6 小時
總計:                   - 14-20 小時
```

#### **里程碑規劃**
```
Week 1: Phase 1 完成 + 基本測試
Week 2: Phase 2 完成 + 跨裝置驗證
Week 3: Phase 3 完成 + 穩定性測試
Week 4: 整體驗收 + 部署準備
```

---

*最後更新：2026-05-27*  
*文檔狀態：✅ 規劃完成*  
*實作狀態：⏳ 待開始*  
*預估工作量：14-20 小時*  
*風險等級：🟡 中等（主要是 RLS 政策驗證）*