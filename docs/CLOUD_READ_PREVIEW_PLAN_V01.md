# CLOUD_READ_PREVIEW_PLAN_V01

**文檔版本：** V01  
**建立日期：** 2026-05-27  
**適用專案：** Climbing Growth System  
**適用範圍：** Cloud Read Preview 最小可行方案規劃  

---

## 📋 規劃目的

**目標：** 規劃「只讀預覽」雲端資料的最小可行實作方案。

**核心原則：**
- ✅ **只讀 Supabase** - 不修改雲端資料
- ✅ **不覆蓋 this.entries** - 保持本地資料完整性
- ✅ **不寫 localStorage** - 不影響現有儲存機制
- ✅ **不做 merge** - 避免複雜的資料合併邏輯
- ✅ **不做 conflict resolution** - 避免衝突處理複雜度
- ✅ **不做 realtime** - 靜態預覽即可
- ✅ **不影響現有記錄列表** - 不干擾主要使用流程

---

## 一、目前雲端狀態盤點

### **已完成功能 ✅**

#### **1.1 Supabase Auth 完整運作**
```
✅ owner 登入：xavier@climbing.dev
✅ tester 登入：alice@climbing.dev  
✅ guest 模式：完全本地，不接雲端
✅ authenticateWithSupabase() 函式運作正常
```

#### **1.2 Cloud Write 功能運作**
```
✅ syncEntryToCloud(entry) - 手動同步單筆
✅ syncEntryToCloudSilently(entry) - 背景靜默同步
✅ convertEntryToSupabaseFormat() - 格式轉換
✅ 整合到表單提交流程（owner/tester 自動雲端寫入）
```

#### **1.3 Cloud Read Test Helper**
```
✅ loadCloudEntries() - 基礎讀取函式
✅ convertSupabaseRowToEntry() - 格式轉換
✅ window.testLoadCloudEntries() - 手動測試介面
✅ RLS 權限正確：owner 讀全部，tester 讀自己
```

#### **1.4 資料表結構**
```
✅ entries 表：user_id, legacy_timestamp, date, movement_notes 等
✅ RLS 政策：owner 可讀 owner+tester，tester 只讀自己
✅ UNIQUE 約束：(user_id, legacy_timestamp)
✅ 完整 CRUD 權限設定
```

### **未完成功能 ❌**

#### **2.1 Cloud Read 正式 UI**
```
❌ 沒有 Cloud Read 的用戶介面
❌ 沒有預覽雲端資料的按鈕或入口
❌ 沒有雲端資料的顯示格式
```

#### **2.2 進階同步功能**
```
❌ local / cloud merge - 本地與雲端資料合併
❌ conflict resolution - 衝突解決機制
❌ pending sync - 離線同步佇列
❌ realtime - 即時同步更新
```

---

## 二、當前權限與資料存取分析

### **2.1 目前 Cloud Write 流程函式**

#### **主要函式位置**
```javascript
// app.js 中的雲端寫入相關函式：
syncEntryToCloud(entry)                    // 手動同步
syncEntryToCloudSilently(entry)           // 背景同步  
convertEntryToSupabaseFormat(entry, userId) // 格式轉換

// 整合位置：
handleFormSubmit() → syncEntryToCloudSilently() // 自動整合
handleLifeFormSubmit() → syncEntryToCloudSilently()
handleEasyFormSubmit() → syncEntryToCloudSilently()
```

#### **觸發時機**
```
owner 建立記錄 → 自動寫入 Supabase
tester 建立記錄 → 自動寫入 Supabase  
guest 建立記錄 → 只寫 sessionStorage，不寫雲端
```

### **2.2 目前 window.testLoadCloudEntries() 功能**

#### **核心邏輯**
```javascript
async testLoadCloudEntries() {
    // 1. 檢查 guest 模式 → 直接返回 guest_mode
    // 2. 檢查 Supabase client 存在性
    // 3. 檢查 Supabase session 有效性
    // 4. 執行 loadCloudEntries() → 讀取 Supabase entries
    // 5. convertSupabaseRowToEntry() → 轉換為本地格式
    // 6. console.log 顯示結果統計和樣本資料
}
```

#### **權限驗證結果**
```
✅ owner 執行：可讀到 owner + tester 的 entries
✅ tester 執行：只能讀到 tester 自己的 entries  
✅ guest 執行：返回 guest_mode，不嘗試讀取
```

### **2.3 owner / tester / guest 權限差異**

#### **Cloud Write 權限**
```
owner:  ✅ 可寫入 Supabase entries (user_id = owner)
tester: ✅ 可寫入 Supabase entries (user_id = tester)  
guest:  ❌ 完全阻擋，不寫入雲端
```

#### **Cloud Read 權限**
```
owner:  ✅ 可讀 owner entries + tester entries (RLS 政策)
tester: ✅ 只能讀 tester 自己的 entries (RLS 限制)
guest:  ❌ 完全阻擋，不讀取雲端
```

#### **資料隔離機制**
```
✅ 基於 user_id 的完全隔離
✅ RLS 政策確保權限邊界
✅ guest 模式與雲端完全隔離
```

---

## 三、Supabase entries 可讀欄位分析

### **3.1 完整欄位列表**
```sql
-- entries 表結構（基於 DEV_LOG 記錄）
id UUID PRIMARY KEY
user_id UUID REFERENCES profiles(id)
legacy_timestamp TEXT                    -- 對應 entry.timestamp
date TEXT                               -- 對應 entry.date  
today_condition TEXT                    -- 對應 entry.todayCondition
training_type TEXT                      -- 對應 entry.trainingType
program_id TEXT                         -- 對應 entry.programId
program_name_snapshot TEXT              -- 對應 entry.programName
program_category_snapshot TEXT          -- 對應 entry.programCategory
item_states JSONB                       -- 對應 entry.itemStates
missed_items JSONB                      -- 對應 entry.missedItems (舊格式)
special_items JSONB                     -- 對應 entry.specialItems (舊格式)
movement_notes TEXT                     -- 對應 entry.movementNotes
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### **3.2 關鍵識別欄位**
```
✅ user_id - 用戶身份識別
✅ legacy_timestamp - 本地時間戳對應
✅ date - 日期字串
✅ created_at / updated_at - 雲端時間戳
```

### **3.3 內容欄位**
```
✅ movement_notes - 使用者輸入的運動筆記
✅ today_condition - 今日狀態（good/normal/tired/exhausted）
✅ training_type - 訓練類型
✅ program_*_snapshot - 課表快照資料
✅ item_states - 新格式狀態資料
✅ missed_items / special_items - 舊格式相容欄位
```

### **3.4 是否已有 cloud_id / identity 欄位**
```
❌ 沒有 cloud_id 欄位
✅ 有 user_id（UUID）作為雲端身份標識  
✅ 有 id（UUID）作為記錄唯一標識
❌ 沒有 identity 欄位（使用 user_id 對應 profiles.role）
```

---

## 四、最小 Cloud Read Preview 可行 UI

### **4.1 最簡 MVP 方案**

#### **選項 A：低調測試按鈕（推薦）**
```html
<!-- 加入資料管理區域，與既有功能並列 -->
<div class="data-management-section">
    <!-- 既有功能：匯出CSV、JSON... -->
    
    <div class="cloud-preview-section">
        <button id="cloudPreviewBtn" class="secondary-btn">
            📖 預覽雲端記錄
        </button>
    </div>
</div>
```

#### **選項 B：開發者工具函式（最簡）**
```javascript
// 直接擴充現有測試函式
window.testLoadCloudEntries() // 已存在
window.showCloudPreview()     // 新增，帶 UI 顯示
```

#### **選項 C：Modal 彈窗（較完整）**
```html
<!-- 新增 Modal 結構 -->
<div id="cloudPreviewModal" class="modal">
    <div class="modal-content">
        <h3>雲端記錄預覽</h3>
        <div id="cloudEntriesList"></div>
        <button class="close-btn">關閉</button>
    </div>
</div>
```

### **4.2 顯示形式對比**

#### **形式 1：console.table（開發導向）**
```javascript
// 優點：實作最簡單，0 UI 工作
// 缺點：使用者體驗不佳，需要開 F12
window.showCloudPreview = async () => {
    const result = await this.loadCloudEntries();
    console.table(result.convertedEntries);
}
```

#### **形式 2：簡單列表（推薦）**
```html
<!-- 優點：平衡簡單與易用性 -->
<div class="cloud-preview-list">
    <div class="cloud-entry-item">
        <div class="entry-date">2026-05-27</div>
        <div class="entry-user">👨‍💻 owner</div>
        <div class="entry-notes">今天試了 V3...</div>
    </div>
</div>
```

#### **形式 3：卡片格式（較完整）**
```html
<!-- 優點：與現有記錄卡片一致的視覺體驗 -->
<!-- 缺點：實作工作量較大 -->
<div class="cloud-preview-cards">
    <div class="cloud-entry-card">
        <!-- 類似現有 entry card 但標註來源 -->
    </div>
</div>
```

---

## 五、不可做事項清單

### **5.1 資料寫入限制 🚫**
```
❌ 不可寫入 localStorage
❌ 不可寫入 sessionStorage  
❌ 不可修改 this.entries 陣列
❌ 不可覆蓋現有記錄資料
❌ 不可寫回 Supabase（純讀取）
```

### **5.2 邏輯複雜度限制 🚫**
```
❌ 不做 local / cloud merge 合併邏輯
❌ 不做 conflict resolution 衝突解決
❌ 不做 pending sync 離線同步佇列
❌ 不做 automatic sync 自動同步
❌ 不做 realtime updates 即時更新
```

### **5.3 UI 影響限制 🚫**
```
❌ 不修改現有記錄列表顯示
❌ 不混合本地與雲端記錄於同一列表
❌ 不修改現有表單提交流程
❌ 不修改現有 Entry 卡片樣式
❌ 不影響 guest 模式體驗
```

### **5.4 功能範圍限制 🚫**
```
❌ 不做 programs cloud sync 課表同步
❌ 不做 messages cloud sync 留言同步
❌ 不做 user management 用戶管理
❌ 不做 permissions management 權限管理
❌ 不做 data export from cloud 雲端匯出
```

---

## 六、風險評估

### **6.1 🟢 低風險項目**

#### **R1：純讀取操作**
```
風險：Cloud Read Preview 為純讀取，不修改任何資料
影響：最小，不會破壞既有功能
機率：幾乎為 0
緩解：已有 window.testLoadCloudEntries() 驗證讀取邏輯正確
```

#### **R2：權限隔離完善**
```
風險：RLS 政策確保權限邊界，guest 完全阻擋
影響：不會有越權存取問題
機率：極低（已驗證）
緩解：依賴已驗證的 Supabase RLS 政策
```

#### **R3：UI 影響最小**
```
風險：新增獨立的預覽功能，不修改既有 UI
影響：不會破壞現有使用流程
機率：極低
緩解：採用獨立按鈕 + Modal 或簡單列表方式
```

### **6.2 🟡 中風險項目**

#### **R4：網路相依性**
```
風險：需要網路連線才能預覽雲端記錄
影響：離線時功能無法使用
機率：30%（用戶離線使用情境）
緩解：明確提示需要網路，失敗時友善錯誤訊息
```

#### **R5：效能考量**
```
風險：讀取大量雲端記錄可能較慢
影響：使用者體驗下降
機率：20%（資料量大時）
緩解：加入 loading 提示，限制讀取筆數
```

#### **R6：用戶體驗混淆**
```
風險：用戶可能混淆本地記錄與雲端預覽
影響：認知負荷增加
機率：25%（特別是新用戶）
緩解：明確標示「雲端預覽」，視覺區隔明顯
```

### **6.3 🔴 高風險項目**
```
無高風險項目 - Cloud Read Preview 為低風險功能
```

---

## 七、建議實作順序

### **Phase 1：基礎讀取整合（1-2 小時）**

#### **步驟 1.1：包裝現有 loadCloudEntries()**
```javascript
// 在 app.js 中新增用戶友善的包裝函式
async showCloudPreview() {
    // 1. 檢查 guest 模式 → 顯示不支援訊息
    // 2. 顯示 loading 提示
    // 3. 呼叫 this.loadCloudEntries()
    // 4. 處理成功/失敗情況
    // 5. 格式化顯示結果
}
```

#### **步驟 1.2：新增 UI 按鈕**
```html
<!-- 在 index.html 資料管理區域新增按鈕 -->
<button id="cloudPreviewBtn">📖 預覽雲端記錄</button>
```

#### **步驟 1.3：基本事件綁定**
```javascript
// 在 app.js initializeApp() 中綁定事件
document.getElementById('cloudPreviewBtn')?.addEventListener('click', 
    () => this.showCloudPreview()
);
```

### **Phase 2：簡單顯示實作（2-3 小時）**

#### **步驟 2.1：選擇顯示形式**
```
建議：簡單列表（平衡實作複雜度與使用體驗）
避免：console.table（用戶體驗差）
避免：複雜卡片（實作工作量大）
```

#### **步驟 2.2：建立基礎 Modal 結構**
```html
<div id="cloudPreviewModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>雲端記錄預覽</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div id="cloudPreviewContent"></div>
    </div>
</div>
```

#### **步驟 2.3：實作簡單列表渲染**
```javascript
renderCloudEntriesList(entries) {
    // 1. 根據用戶權限過濾顯示
    // 2. 按日期排序
    // 3. 簡單 HTML 格式化
    // 4. 明確標示資料來源（本地 vs 雲端）
}
```

### **Phase 3：體驗優化（1-2 小時）**

#### **步驟 3.1：Loading 與錯誤處理**
```javascript
// 加入完整的狀態管理
showCloudPreview() {
    // 1. 顯示 loading spinner
    // 2. 處理網路錯誤
    // 3. 處理權限錯誤  
    // 4. 處理空資料情況
    // 5. 友善錯誤訊息
}
```

#### **步驟 3.2：用戶權限提示**
```javascript
// 根據用戶身份顯示不同提示
showPermissionInfo() {
    // owner: "您可以看到開發者和測試員的記錄"
    // tester: "您只能看到自己的記錄"  
    // guest: "訪客模式不支援雲端預覽"
}
```

#### **步驟 3.3：基本樣式調整**
```css
/* 新增 cloud preview 相關樣式 */
.cloud-preview-modal { /* Modal 樣式 */ }
.cloud-entry-list { /* 列表樣式 */ }
.cloud-entry-item { /* 項目樣式 */ }
.cloud-source-label { /* 來源標示 */ }
```

### **Phase 4：測試與驗收（1 小時）**

#### **驗收清單**
```
□ owner 點擊「預覽雲端記錄」→ 看到 owner + tester 記錄
□ tester 點擊「預覽雲端記錄」→ 只看到 tester 記錄
□ guest 點擊按鈕 → 顯示「guest 不支援雲端預覽」訊息
□ 網路錯誤時 → 顯示友善錯誤訊息
□ 無雲端記錄時 → 顯示空狀態提示
□ 本地記錄完全不受影響 → this.entries 保持原樣
□ 關閉 Modal 後功能正常 → 不影響其他功能
```

---

## 八、是否會影響 Echo / Entry / Cloud Write

### **8.1 Echo System 影響分析**

#### **✅ 完全不影響**
```
✅ Echo 生成邏輯：不變（依賴 this.entries）
✅ Echo 顯示邏輯：不變（依賴本地記錄）  
✅ Echo Presence 機制：不變（基於本地記錄順序）
✅ Echo 內容池：不變
✅ Echo 路由規則：不變
```

#### **原因**
```
Cloud Read Preview 為純讀取預覽功能，
不修改 this.entries，不影響 Echo 依賴的資料來源
```

### **8.2 Entry System 影響分析**

#### **✅ 完全不影響**
```
✅ Entry 建立流程：不變
✅ Entry 儲存邏輯：不變（localStorage 流程保持）
✅ Entry 顯示邏輯：不變（依賴 this.entries）
✅ Entry 編輯功能：不變  
✅ Entry 刪除功能：不變
✅ Entry 匯出功能：不變
```

#### **原因**
```
Cloud Read Preview 為獨立預覽功能，
不接入既有 Entry 管理流程，完全不修改 this.entries
```

### **8.3 Cloud Write 影響分析**

#### **✅ 完全不影響**
```
✅ syncEntryToCloud()：不變（既有函式保持）
✅ syncEntryToCloudSilently()：不變（背景同步保持）
✅ convertEntryToSupabaseFormat()：不變（共用但只讀）
✅ 表單提交雲端寫入：不變（自動同步保持）
```

#### **可能複用的函式**
```
✅ loadCloudEntries() - 直接複用既有函式
✅ convertSupabaseRowToEntry() - 直接複用既有轉換邏輯
✅ Supabase client - 共用連線，但 Preview 只做 SELECT
```

#### **隔離保證**
```
✅ Cloud Read Preview 只使用 SELECT 操作
✅ 不會觸發任何 INSERT / UPDATE / DELETE
✅ 不會修改 Supabase 任何資料
✅ 不會干擾既有 Cloud Write 流程
```

---

## 九、總結與建議

### **9.1 實作可行性評估**

#### **✅ 高度可行**
```
✅ 基礎設施完備 - Supabase Auth + RLS + 讀取邏輯已完成
✅ 測試函式可用 - window.testLoadCloudEntries() 已驗證
✅ 權限機制清楚 - owner/tester/guest 邊界明確  
✅ 風險極低 - 純讀取操作，不影響既有功能
✅ 工作量適中 - 預估 6-8 小時可完成 MVP
```

### **9.2 MVP 建議方案**

#### **推薦實作**
```
1. 按鈕位置：資料管理區域，與匯出功能並列
2. 顯示形式：簡單 Modal + 列表，不使用 console.table
3. 功能範圍：純預覽，不做 merge/sync/realtime
4. 用戶體驗：明確標示來源，友善錯誤處理
5. 實作順序：漸進式，每階段可測試
```

#### **成功指標**
```
✅ owner 可預覽 owner + tester 雲端記錄
✅ tester 可預覽 tester 雲端記錄
✅ guest 顯示不支援提示
✅ 本地功能完全不受影響
✅ 實作工作量控制在 8 小時內
```

### **9.3 下一步行動**

#### **立即可行**
```
✅ 可立即開始實作 Phase 1（基礎整合）
✅ 風險極低，不需要額外的架構設計
✅ 基於已驗證的 cloud read 邏輯
```

#### **實作建議**
```
1. 先做 console.table 版本快速驗證（30分鐘）
2. 再做簡單 UI 版本提升體驗（3-4小時）  
3. 最後加入 loading 和錯誤處理（2-3小時）
4. 每階段獨立測試，確保穩定性
```

---

*最後更新：2026-05-27*  
*文檔狀態：✅ 規劃完成*  
*風險等級：🟢 低風險*  
*預估工作量：6-8 小時*  
*建議開始時間：立即可行*