# ECHO_PRESENCE_V1_IMPLEMENTATION_PLAN

**文檔版本：** V1  
**建立日期：** 2026-05-26  
**適用專案：** Climbing Growth System  
**適用範圍：** Echo 出現機制統一實作計劃  

---

## 📋 新機制需求

### **統一出現機制**
- **基礎機率**：70% 顯示 Echo，30% 不顯示
- **適用範圍**：Life、Easy、Challenge 三種 Flow

### **保護規則**
- **Rule 1**：第一次建立記錄 → 100% 顯示 Echo
- **Rule 2**：連續兩筆未出現 Echo → 第三筆強制出現
- **Rule 3**：同一天僅第一筆記錄觸發 Presence 判定

---

## 一、新增欄位分析

### **需要追蹤的新資料**

#### **A. User Level 資料**
```javascript
userPresenceMetadata: {
    firstRecordCreated: boolean,          // 是否已建立過記錄
    consecutiveNoEchoCount: number,       // 連續未出現 Echo 次數
    lastPresenceDecisionDate: string,     // 最後一次觸發判定的日期 (YYYY-MM-DD)
    totalRecordsCount: number            // 總記錄數（用於驗證）
}
```

#### **B. Entry Level 資料**
```javascript
entry: {
    // 既有欄位...
    timestamp: number,
    echoResponse: object,
    
    // 新增欄位
    echoPresence: {
        shouldShow: boolean,              // 是否應該顯示 Echo
        presenceReason: string,           // 出現原因："probability"|"first-record"|"consecutive-protection"|"same-day-skip"
        presenceDecision: boolean,        // 是否觸發了判定流程
        presenceTimestamp: number         // 判定時間戳
    }
}
```

### **欄位設計原則**
- **最小必要** - 只追蹤實作邏輯必需的資料
- **自包含** - entry 包含足夠資訊做獨立驗證
- **可恢復** - 從 entries 陣列可重建 userPresenceMetadata
- **向前相容** - 舊 entries 沒有 echoPresence 視為顯示 Echo

---

## 二、既有資料利用分析

### **可利用的既有欄位**

#### **✅ 完全可利用**
```javascript
entry.timestamp               // 用於日期判斷和排序
entry.echoResponse           // 判斷是否已有 Echo（舊記錄相容）
```

#### **✅ 部分可利用**
```javascript
entries.length               // 粗略判斷是否為第一次（但不精確）
```

#### **❌ 無法利用**
```javascript
entry.flow                   // 新機制不區分 Flow 類型
entry.completion            // 與 Presence 邏輯無關
entry.notes                 // 與 Presence 邏輯無關
```

### **既有資料的限制**

#### **時間區分問題**
```javascript
// 既有 timestamp 是毫秒級，需要轉換為日期
// 需要處理時區問題
const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
```

#### **歷史記錄問題**
```javascript
// 舊記錄沒有 echoPresence 欄位
// 需要向前相容邏輯：沒有 echoPresence = shouldShow: true
```

#### **順序問題**
```javascript
// entries 可能不是時間順序排列
// 需要排序後分析連續性
```

---

## 三、最小修改方案

### **Phase 1：資料結構調整（無業務邏輯變更）**

#### **1.1 增加 UserPresenceMetadata 管理**
```javascript
class ClimbingApp {
    constructor() {
        // 既有程式碼...
        this.userPresenceMetadata = this.loadUserPresenceMetadata();
    }
    
    loadUserPresenceMetadata() {
        const saved = localStorage.getItem('userPresenceMetadata');
        return saved ? JSON.parse(saved) : {
            firstRecordCreated: false,
            consecutiveNoEchoCount: 0,
            lastPresenceDecisionDate: null,
            totalRecordsCount: 0
        };
    }
    
    saveUserPresenceMetadata() {
        localStorage.setItem('userPresenceMetadata', 
            JSON.stringify(this.userPresenceMetadata));
    }
}
```

#### **1.2 增加 Entry EchoPresence 欄位**
```javascript
// 在新建 entry 時加入
function createNewEntry(formData) {
    return {
        // 既有欄位...
        timestamp: Date.now(),
        
        // 新增 echoPresence（先設為預設值）
        echoPresence: {
            shouldShow: true,              // Phase 1: 預設顯示（保持既有行為）
            presenceReason: "legacy",      // 標記為舊邏輯
            presenceDecision: false,       // 尚未觸發新判定
            presenceTimestamp: Date.now()
        }
    };
}
```

### **Phase 2：判定邏輯實作（無 UI 變更）**

#### **2.1 Presence 判定核心邏輯**
```javascript
// 新增 presence 判定函式，但先不改變顯示邏輯
determineEchoPresence(entryData) {
    const today = new Date().toISOString().split('T')[0];
    
    // Rule 3: 同一天第二筆以上，直接沿用第一筆結果
    if (this.userPresenceMetadata.lastPresenceDecisionDate === today) {
        const todayFirstEntry = this.findTodayFirstEntry(today);
        return {
            shouldShow: todayFirstEntry.echoPresence.shouldShow,
            presenceReason: "same-day-skip",
            presenceDecision: false,
            presenceTimestamp: Date.now()
        };
    }
    
    // Rule 1: 第一次建立記錄
    if (!this.userPresenceMetadata.firstRecordCreated) {
        return {
            shouldShow: true,
            presenceReason: "first-record",
            presenceDecision: true,
            presenceTimestamp: Date.now()
        };
    }
    
    // Rule 2: 連續保護機制
    if (this.userPresenceMetadata.consecutiveNoEchoCount >= 2) {
        return {
            shouldShow: true,
            presenceReason: "consecutive-protection",
            presenceDecision: true,
            presenceTimestamp: Date.now()
        };
    }
    
    // 基礎機率判定
    const shouldShow = Math.random() < 0.7;
    return {
        shouldShow,
        presenceReason: "probability",
        presenceDecision: true,
        presenceTimestamp: Date.now()
    };
}
```

#### **2.2 Metadata 更新邏輯**
```javascript
updateUserPresenceMetadata(echoPresence) {
    const today = new Date().toISOString().split('T')[0];
    
    // 只在觸發判定時更新
    if (echoPresence.presenceDecision) {
        this.userPresenceMetadata.firstRecordCreated = true;
        this.userPresenceMetadata.lastPresenceDecisionDate = today;
        
        // 更新連續計數
        if (echoPresence.shouldShow) {
            this.userPresenceMetadata.consecutiveNoEchoCount = 0;
        } else {
            this.userPresenceMetadata.consecutiveNoEchoCount += 1;
        }
        
        this.saveUserPresenceMetadata();
    }
}
```

### **Phase 3：顯示邏輯整合（UI 變更）**

#### **3.1 修改 renderEchoResponse**
```javascript
renderEchoResponse(entry) {
    // 檢查是否應該顯示 Echo
    if (entry.echoPresence && !entry.echoPresence.shouldShow) {
        return ''; // 不顯示 Echo
    }
    
    // 既有顯示邏輯...
    let echoResponse = entry.echoResponse;
    if (!echoResponse) {
        echoResponse = this.generateEchoResponse(entry);
    }
    
    if (echoResponse && echoResponse.message) {
        return `<div class="entry-echo-response">${echoResponse.message}</div>`;
    }
    
    return '';
}
```

#### **3.2 整合到 handleFormSubmit**
```javascript
handleFormSubmit(formData) {
    // 既有表單處理...
    
    // 新增：Presence 判定
    const echoPresence = this.determineEchoPresence(formData);
    formData.echoPresence = echoPresence;
    
    // 更新 Metadata
    this.updateUserPresenceMetadata(echoPresence);
    
    // 既有 Echo 生成邏輯（不變）
    const echoResponse = this.generateEchoResponse(formData);
    formData.echoResponse = echoResponse;
    
    // 儲存和顯示...
}
```

---

## 四、Cloud Sync 影響分析

### **資料同步需求**

#### **✅ 需要同步**
```javascript
entry.echoPresence              // Entry 層級資料必須同步
```

#### **❓ 可能需要同步**
```javascript
userPresenceMetadata           // 使用者層級資料，考慮同步
```

#### **❌ 不需要同步**
```javascript
// 暫時性判定結果（可重新計算）
```

### **同步策略選項**

#### **選項 A：Entry-Only 同步**
```javascript
// 優點：簡單，利用既有同步機制
// 缺點：需要從 entries 重新計算 userPresenceMetadata
// 實作：每次載入時重建 metadata

rebuildUserPresenceMetadata() {
    const sortedEntries = this.entries.sort((a, b) => a.timestamp - b.timestamp);
    // 從 entries 重建 metadata...
}
```

#### **選項 B：雙層同步**
```javascript
// 優點：性能好，不需要重新計算
// 缺點：同步邏輯複雜，可能不一致
// 實作：metadata 和 entries 分別同步
```

#### **選項 C：混合策略（推薦）**
```javascript
// 同步 entries（包含 echoPresence）
// 本地緩存 userPresenceMetadata，失效時重建
// 提供驗證機制確保一致性

validatePresenceMetadata() {
    // 對比 metadata 和 entries，發現不一致時重建
}
```

### **向前相容性**

#### **舊記錄處理**
```javascript
// 舊 entries 沒有 echoPresence 欄位
// 默認策略：視為 shouldShow: true
function getEntryEchoPresence(entry) {
    return entry.echoPresence || {
        shouldShow: true,
        presenceReason: "legacy",
        presenceDecision: false,
        presenceTimestamp: entry.timestamp
    };
}
```

---

## 五、既有 Echo Engine 影響分析

### **✅ 不需要修改的部分**

#### **Echo 生成邏輯**
```javascript
// 以下保持完全不變
initializeEchoPools()          // 回應池
routeEchoResponse()           // 路由邏輯
selectRandomEcho()            // 隨機選擇
buildEchoResponse()           // 建立回應物件
```

#### **Echo 內容系統**
```javascript
// 以下保持完全不變
L1, L2, L3 pools              // Life Flow 回應池
E1, E2, E3, E4 pools          // Easy Flow 回應池  
C1, C2, C3 pools              // Challenge Flow 回應池
F1 pool                       // Fallback 回應池
```

### **🔧 需要調整的部分**

#### **Echo 顯示邏輯**
```javascript
// 原本：永遠顯示 Echo
// 調整：根據 echoPresence.shouldShow 決定
```

#### **Echo 生成時機**
```javascript
// 選項 A：永遠生成，有時不顯示（推薦）
// 選項 B：根據 presence 決定是否生成
// 選項 C：延遲生成（顯示時才生成）
```

### **推薦策略：選項 A**

#### **理由**
1. **向前相容** - 舊記錄已有 echoResponse
2. **邏輯分離** - Presence 和 Generation 獨立
3. **除錯容易** - 可以看到生成了但未顯示的 Echo
4. **性能一致** - 生成時間可預測

#### **實作方式**
```javascript
// 1. 永遠執行 Echo 生成
const echoResponse = this.generateEchoResponse(entry);
entry.echoResponse = echoResponse;

// 2. 根據 presence 決定顯示
if (entry.echoPresence.shouldShow) {
    // 顯示 Echo
} else {
    // 不顯示 Echo，但 echoResponse 仍存在
}
```

---

## 六、風險評估

### **🔴 高風險項目**

#### **R1：資料不一致風險**
**問題：** userPresenceMetadata 與實際 entries 不一致
```
影響：連續計數錯誤，判定邏輯失效
機率：30% （localStorage 清除、同步問題）
緩解：定期驗證，不一致時重建 metadata
```

#### **R2：時區問題**
**問題：** 日期判斷受用戶時區影響
```
影響：同一天判定錯誤，Rule 3 失效
機率：20% （跨時區使用、時區變更）
緩解：統一使用 UTC 日期或本地時區一致性
```

#### **R3：舊記錄相容性**
**問題：** 既有記錄沒有 echoPresence 欄位
```
影響：連續計數從0開始，保護機制失效
機率：100% （必然發生）
緩解：預設舊記錄為顯示 Echo，重建時正確處理
```

### **🟡 中風險項目**

#### **R4：Performance 影響**
**問題：** 大量記錄時重建 metadata 性能問題
```
影響：載入時間增加
機率：10% （重度用戶）
緩解：增量更新，緩存機制
```

#### **R5：邊界條件**
**問題：** 午夜時分建立記錄的日期判定
```
影響：同一天判定可能錯誤
機率：5% （特定時間使用）
緩解：明確定義日期邊界邏輯
```

### **🟢 低風險項目**

#### **R6：隨機數重現**
**問題：** 測試時難以重現特定機率結果
```
影響：測試困難
機率：100% （測試期間）
緩解：提供 seed 機制，測試模式
```

### **風險緩解策略**

#### **立即緩解**
1. **資料驗證機制** - 每次載入時檢查一致性
2. **重建功能** - 提供手動重建 metadata 功能
3. **預設值策略** - 舊記錄安全預設值

#### **中期緩解**
1. **監控機制** - 記錄異常情況
2. **A/B 測試** - 小範圍測試新機制
3. **回滾機制** - 快速回到舊邏輯的能力

---

## 七、實作階段規劃

### **Phase 1：資料準備（Week 1）**
```
□ 設計並實作 echoPresence 資料結構
□ 實作 userPresenceMetadata 管理
□ 建立向前相容性處理
□ 新增資料驗證和重建機制
```

### **Phase 2：邏輯實作（Week 2）**
```
□ 實作 determineEchoPresence 核心邏輯
□ 實作三個保護規則（Rule 1-3）
□ 實作 metadata 更新邏輯
□ 建立測試用例和邊界條件處理
```

### **Phase 3：整合測試（Week 3）**
```
□ 整合到既有表單提交流程
□ 修改 Echo 顯示邏輯
□ 測試各種邊界情況
□ 性能測試和優化
```

### **Phase 4：部署驗證（Week 4）**
```
□ 小範圍測試部署
□ 監控 presence 判定結果
□ 收集用戶體驗回饋
□ 必要時調整參數或邏輯
```

---

## 八、成功驗證指標

### **技術指標**
- **資料一致性**：metadata 與 entries 一致性 > 99%
- **性能影響**：新增邏輯對載入時間影響 < 100ms
- **相容性**：舊記錄正確處理率 100%

### **業務指標**  
- **出現率準確性**：實際 Echo 出現率 = 70% ± 5%
- **保護機制**：連續3次無 Echo 情況 < 1%
- **使用者滿意度**：Echo 頻率滿意度 > 80%

### **風險指標**
- **資料異常**：metadata 重建觸發率 < 5%
- **邊界問題**：日期判定錯誤率 < 1%
- **系統穩定性**：因 presence 邏輯導致的錯誤 < 0.1%

---

*最後更新：2026-05-26*  
*文檔狀態：✅ 規劃完成*  
*實作狀態：⏳ 待開發*  
*風險等級：🟡 中等*