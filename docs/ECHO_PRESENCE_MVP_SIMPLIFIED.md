# ECHO_PRESENCE_MVP_SIMPLIFIED

**文檔版本：** MVP  
**建立日期：** 2026-05-26  
**適用專案：** Climbing Growth System  
**適用範圍：** Echo 出現機制 - 最小實作版本  

---

## 📋 設計原則

### **極簡目標**
- **讓 Echo 偶爾出現**，不要每次都出現
- **零複雜度** - 不增加任何資料結構
- **零風險** - 不影響既有功能
- **一次修改** - 只修改顯示邏輯

### **嚴格限制**
- ❌ 不修改 entry schema
- ❌ 不修改 Supabase
- ❌ 不新增 localStorage metadata
- ❌ 不影響既有 Echo Engine
- ✅ 僅於 render 階段直接判定

---

## 一、最小實作方案

### **核心策略：確定性隨機**

#### **概念**
```javascript
// 使用 entry.timestamp 作為隨機種子
// 相同 entry 永遠得到相同結果
// 不同 entry 得到不同結果
// 不需要儲存任何狀態
```

#### **實作邏輯**
```javascript
function shouldShowEcho(entry) {
    // 使用 timestamp 最後幾位數字作為種子
    const seed = entry.timestamp % 10000;
    
    // 將種子轉換為 0-1 的浮點數
    const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280;
    
    // 70% 機率顯示 Echo
    return pseudoRandom < 0.7;
}
```

#### **為什麼這樣設計**
1. **確定性** - 相同 entry 永遠相同結果，避免頁面刷新時閃爍
2. **無狀態** - 不需要儲存任何額外資料
3. **分布均勻** - 大量 entries 會趨近 70% 顯示率
4. **不可預測** - 用戶無法預測下一筆記錄是否會出現

### **最小保護機制**

#### **新用戶友好**
```javascript
function shouldShowEcho(entry) {
    // 保護：確保前3筆記錄都有 Echo（新用戶體驗）
    const allEntries = this.entries || [];
    const entryIndex = allEntries.findIndex(e => e.timestamp === entry.timestamp);
    
    if (entryIndex < 3) {
        return true; // 前3筆一定顯示
    }
    
    // 其他情況使用確定性隨機
    const seed = entry.timestamp % 10000;
    const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280;
    return pseudoRandom < 0.7;
}
```

---

## 二、修改檔案清單

### **唯一修改：app.js**

#### **修改位置：renderEchoResponse 函式**
```javascript
// 修改前（第 4271-4288 行）
renderEchoResponse(entry) {
    let echoResponse = entry.echoResponse;

    // 向後相容：為舊 entry 動態生成 echo response
    if (!echoResponse) {
        echoResponse = this.generateEchoResponse(entry);
    }

    // 渲染 Echo 回應
    if (echoResponse && echoResponse.message) {
        return `
            <div class="entry-echo-response">
                ${echoResponse.message}
            </div>
        `;
    }

    return '';
}
```

```javascript
// 修改後
renderEchoResponse(entry) {
    // 新增：Echo Presence 判定
    if (!this.shouldShowEcho(entry)) {
        return ''; // 不顯示 Echo
    }

    let echoResponse = entry.echoResponse;

    // 向後相容：為舊 entry 動態生成 echo response
    if (!echoResponse) {
        echoResponse = this.generateEchoResponse(entry);
    }

    // 渲染 Echo 回應
    if (echoResponse && echoResponse.message) {
        return `
            <div class="entry-echo-response">
                ${echoResponse.message}
            </div>
        `;
    }

    return '';
}
```

#### **新增函式：shouldShowEcho**
```javascript
// 在 ClimbingApp class 中新增
shouldShowEcho(entry) {
    // MVP 簡化版本：確定性隨機 + 新用戶保護
    
    // 保護：前3筆記錄一定顯示（新用戶體驗）
    const allEntries = this.entries || [];
    const sortedEntries = allEntries.sort((a, b) => a.timestamp - b.timestamp);
    const entryIndex = sortedEntries.findIndex(e => e.timestamp === entry.timestamp);
    
    if (entryIndex !== -1 && entryIndex < 3) {
        return true;
    }
    
    // 確定性隨機：基於 timestamp
    const seed = entry.timestamp % 10000;
    const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280;
    
    // 70% 機率顯示 Echo
    return pseudoRandom < 0.7;
}
```

### **修改總結**
- **修改檔案數量**：1 個 (app.js)
- **新增程式碼行數**：約 15 行
- **修改既有程式碼**：2 行（renderEchoResponse 開頭加判定）
- **其他檔案影響**：0 個

---

## 三、風險評估

### **🟢 極低風險項目**

#### **R1：邏輯錯誤**
```
問題：shouldShowEcho 函式邏輯錯誤
影響：Echo 顯示異常（完全不顯示或永遠顯示）
機率：5% （邏輯簡單，易測試）
緩解：充分測試，有 fallback 邏輯
```

#### **R2：性能影響**
```
問題：每次 render 都要執行判定邏輯
影響：頁面載入速度變慢
機率：2% （邏輯極簡單，幾乎無性能開銷）
緩解：函式邏輯極簡，運算量極小
```

#### **R3：用戶體驗變化**
```
問題：用戶習慣每次都有 Echo，突然改變會困惑
影響：用戶可能以為功能壞了
機率：15% （但這是預期的產品改進）
緩解：觀察用戶反應，必要時調整機率
```

### **🟢 零風險項目**

#### **資料完整性**
- ✅ 不修改任何既有資料結構
- ✅ 不影響 Echo 生成邏輯
- ✅ 不影響儲存邏輯

#### **系統穩定性**
- ✅ 純邏輯修改，無外部依賴
- ✅ 有明確 fallback（顯示 Echo）
- ✅ 不影響其他功能

#### **向前相容性**
- ✅ 舊記錄完全正常運作
- ✅ 新記錄正常運作
- ✅ 無需資料遷移

### **風險總評：🟢 極低風險**

---

## 四、驗收方式

### **自動化測試**

#### **Test 1：基本功能測試**
```javascript
// 測試 shouldShowEcho 邏輯
function testShouldShowEcho() {
    const mockApp = new ClimbingApp();
    
    // 測試前3筆記錄（應該都顯示）
    const entries = [
        { timestamp: 1000 },
        { timestamp: 2000 }, 
        { timestamp: 3000 },
        { timestamp: 4000 }
    ];
    mockApp.entries = entries;
    
    // 前3筆應該都是 true
    assert(mockApp.shouldShowEcho(entries[0]) === true);
    assert(mockApp.shouldShowEcho(entries[1]) === true);
    assert(mockApp.shouldShowEcho(entries[2]) === true);
    
    // 第4筆開始使用機率（確定性，可預測結果）
    const result4 = mockApp.shouldShowEcho(entries[3]);
    assert(typeof result4 === 'boolean');
    
    console.log('✅ 基本功能測試通過');
}
```

#### **Test 2：確定性測試**
```javascript
// 測試相同 entry 永遠得到相同結果
function testDeterministic() {
    const mockApp = new ClimbingApp();
    mockApp.entries = Array.from({length: 10}, (_, i) => ({timestamp: i * 1000}));
    
    const entry = { timestamp: 12345 };
    
    // 多次呼叫應該得到相同結果
    const result1 = mockApp.shouldShowEcho(entry);
    const result2 = mockApp.shouldShowEcho(entry);
    const result3 = mockApp.shouldShowEcho(entry);
    
    assert(result1 === result2);
    assert(result2 === result3);
    
    console.log('✅ 確定性測試通過');
}
```

#### **Test 3：分布測試**
```javascript
// 測試大量記錄的顯示率分布
function testDistribution() {
    const mockApp = new ClimbingApp();
    
    // 建立大量測試記錄
    const entries = Array.from({length: 1000}, (_, i) => ({
        timestamp: Date.now() + i * 60000 // 每分鐘一筆
    }));
    mockApp.entries = entries;
    
    let showCount = 0;
    for (let i = 3; i < entries.length; i++) { // 跳過前3筆保護記錄
        if (mockApp.shouldShowEcho(entries[i])) {
            showCount++;
        }
    }
    
    const showRate = showCount / (entries.length - 3);
    console.log(`顯示率: ${(showRate * 100).toFixed(1)}%`);
    
    // 應該接近 70%，允許 10% 誤差
    assert(showRate > 0.6 && showRate < 0.8);
    
    console.log('✅ 分布測試通過');
}
```

### **手動測試清單**

#### **場景 1：新用戶體驗**
```
□ 建立第1筆記錄 → 應該有 Echo
□ 建立第2筆記錄 → 應該有 Echo  
□ 建立第3筆記錄 → 應該有 Echo
□ 建立第4筆記錄 → 可能有或沒有 Echo
□ 建立第5-10筆 → 約 70% 有 Echo
```

#### **場景 2：既有記錄顯示**
```
□ 刷新頁面 → Echo 顯示狀態保持不變
□ 編輯記錄 → Echo 顯示狀態保持不變
□ 查看所有記錄 → 約 70% 有 Echo（忽略前3筆）
```

#### **場景 3：邊界情況**
```
□ 沒有記錄時 → 不影響功能
□ 只有1筆記錄 → Echo 正常顯示
□ entries 為空陣列 → 不造成錯誤
□ entry 缺少 timestamp → 有 fallback 處理
```

### **驗收標準**

#### **功能性需求**
- ✅ Echo 不再每次都出現
- ✅ 大量記錄中約 70% 顯示 Echo
- ✅ 前3筆記錄保證顯示 Echo
- ✅ 相同記錄永遠有一致的顯示狀態

#### **非功能性需求**
- ✅ 頁面載入速度無明顯變化
- ✅ 既有功能完全不受影響
- ✅ 無 JavaScript 錯誤
- ✅ 所有瀏覽器正常運作

---

## 五、部署策略

### **Phase 1：內部測試（1-2 天）**
```
□ 開發環境部署和自動化測試
□ 手動測試所有場景
□ 確認無 JavaScript 錯誤
□ 確認顯示率符合預期
```

### **Phase 2：小範圍部署（3-5 天）**
```
□ 部署到測試環境
□ 邀請 2-3 位測試用戶試用
□ 觀察用戶反應和回饋
□ 監控是否有異常情況
```

### **Phase 3：正式部署（1 天）**
```
□ 生產環境部署
□ 監控系統穩定性
□ 收集用戶對新體驗的反應
□ 記錄實際 Echo 顯示率數據
```

### **回滾計劃**
```javascript
// 緊急回滾：註釋掉判定邏輯
renderEchoResponse(entry) {
    // 緊急回滾：註釋下面這行
    // if (!this.shouldShowEcho(entry)) return '';
    
    // 其他邏輯保持不變...
}
```

---

## 六、未來演進路徑

### **v0.2-ECHO-PRESENCE-MVP**
- ✅ 確定性隨機 + 新用戶保護
- ✅ 約 70% 顯示率
- ✅ 零複雜度實作

### **v0.3-ECHO-PRESENCE-ENHANCED（未來）**
```
可考慮增加：
- 連續保護機制（避免連續3次無 Echo）
- 特殊日子加權（第一次使用、重要里程碑）
- 用戶偏好設置（開啟/關閉，調整機率）
```

### **v0.4-ECHO-PRESENCE-SMART（更遠未來）**
```
可考慮增加：
- 基於記錄內容的智能判定
- 情感狀態感知調整
- 個人化顯示頻率學習
```

### **升級原則**
- **向前相容** - 新版本不破壞既有邏輯
- **漸進增強** - 保持 MVP 版本作為基礎
- **用戶選擇** - 提供關閉複雜功能的選項

---

*最後更新：2026-05-26*  
*文檔狀態：✅ 規劃完成*  
*實作狀態：⏳ 待開發*  
*風險等級：🟢 極低*