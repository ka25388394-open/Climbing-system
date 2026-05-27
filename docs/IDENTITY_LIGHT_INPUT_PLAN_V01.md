# Identity Light Input Planning V01

**建立日期：** 2026-05-27  
**目標：** 輕量身份識別系統 - 讓測試員可自訂名字/代號  
**範圍：** 測試員模式體驗改善，不碰高風險身份系統  

---

## A. 目前身份系統盤點

### 🔍 **Identity 架構分析**

#### **1. currentUser 設定流程**
- **初始化：** `initializeIdentity()` 檢查 `localStorage.getItem('currentUser')`
- **預設值：** 如無儲存身份，顯示身份選擇器
- **可選值：** `'owner'`, `'tester'`, `'guest'`
- **設定位置：** `setCurrentUser(identity)` → `localStorage.setItem('currentUser', identity)`

#### **2. 三種身份用途**

**Owner (👨‍💻 開發者):**
- 完整功能權限
- Cloud Preview 可見
- Supabase: `xavier@climbing.dev`
- localStorage: `*_owner` keys

**Tester (🧪 測試員):**
- 測試功能權限  
- Message 系統可見
- Supabase: `alice@climbing.dev` ← **硬編碼問題**
- localStorage: `*_tester` keys

**Guest (👁️ 訪客):**
- 基礎功能
- 無 cloud sync
- sessionStorage only

#### **3. localStorage Key 分離機制**
```javascript
// app.js:1364-1371
getStorageKey(baseKey) {
    if (!this.currentUser) return baseKey;
    if (this.currentUser === 'guest') return `session_${baseKey}`;
    return `${baseKey}_${this.currentUser}`;
}
```

**結果：**
- Owner: `climbingPrograms_owner`, `climbingEntries_owner`
- Tester: `climbingPrograms_tester`, `climbingEntries_tester`  
- Guest: `session_climbingPrograms`, `session_climbingEntries`

#### **4. Supabase Sync 身份系統**
```javascript
// app.js:63-66
const SUPABASE_EMAIL_MAP = {
    owner: "xavier@climbing.dev",
    tester: "alice@climbing.dev"  ← 硬編碼
};
```

**Firebase Prefix:**
- Owner: `demo_owner`
- Tester: `demo_tester`
- Guest: 無 sync

#### **5. 密碼系統現狀**
- **真實認證：** 使用 Supabase Auth 真實密碼驗證
- **authenticateWithSupabase()：** 驗證 email + password
- **登入流程：** username input → password input → Supabase Auth API
- **Guest 例外：** 無需密碼，直接進入

---

## B. 為什麼帳號會被寫死

### 🎯 **Root Cause Analysis**

#### **1. 系統設計假設**
目前系統設計為 **「角色型身份」** 而非 **「個人化身份」**：
- Owner = 開發者角色 (單一)
- Tester = 測試員角色 (單一)  
- Guest = 訪客角色 (匿名)

#### **2. Supabase Email 依賴**
```javascript
// 硬編碼原因：Supabase Auth 需要真實 email
const email = SUPABASE_EMAIL_MAP[identity];  // alice@climbing.dev
const loginResult = await window.loginWithSupabase(email, password);
```

#### **3. Cloud Sync 身份需求**
- **Firebase 需要穩定 userId:** `demo_tester`
- **Supabase entries 需要 user_id:** 基於 email
- **一對一映射:** 每個 currentUser 對應固定 cloud identity

#### **4. 系統架構限制**
- **localStorage 按 currentUser 分離**
- **Cloud 資料按 email 分離**  
- **一個 currentUser = 一個雲端身份**

---

## C. 三種方案比較

### 🔵 **方案 A：只改 UI 顯示**

#### **實作概念**
```javascript
// 新增配置
const CUSTOM_DISPLAY_NAMES = {
    tester: localStorage.getItem('testerDisplayName') || 'Alice'
};

// UI 顯示
display.textContent = CUSTOM_DISPLAY_NAMES[this.currentUser] || config.displayName;
```

#### **影響範圍**
- ✅ **currentUser:** 仍為 `'tester'` (不變)
- ✅ **localStorage:** 仍用 `*_tester` keys (不變)
- ✅ **Supabase:** 仍用 `alice@climbing.dev` (不變)
- ✅ **Cloud Sync:** 完全不受影響
- ⚠️ **資料分離:** 所有測試者共用同一 localStorage space

#### **優缺點評估**
- ✅ **低風險:** 零系統架構更動
- ✅ **快速實作:** 只需 UI + displayName storage
- ✅ **向下相容:** 完全不影響現有功能
- ❌ **資料混合:** 多個測試者資料仍會混在一起
- ❌ **體驗限制:** 測試者無法真正「擁有」自己的資料空間

---

### 🟡 **方案 B：Local Identity Key**

#### **實作概念**
```javascript
// 動態 currentUser
function createTesterIdentity(customName) {
    return `tester_${customName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// 例子
// 輸入「瑤瑤」→ currentUser = 'tester_yaoyao'
// 輸入「Alice」→ currentUser = 'tester_alice'
```

#### **影響範圍**
- ⚠️ **currentUser:** 變成動態值 `tester_*`
- ⚠️ **localStorage:** 變成 `climbingPrograms_tester_yaoyao`
- ❌ **Supabase:** 需要解決 email 映射問題
- ❌ **Cloud Sync:** 需要新的 userId 生成邏輯
- ⚠️ **Owner 觀察:** 需要新的測試者資料發現機制

#### **技術挑戰**
```javascript
// 問題 1: SUPABASE_EMAIL_MAP 無法預知所有可能的 tester_*
const SUPABASE_EMAIL_MAP = {
    owner: "xavier@climbing.dev",
    tester_yaoyao: "???"  // 無法預設所有可能 email
};

// 問題 2: IDENTITY_CONFIG 無法預設所有配置
const IDENTITY_CONFIG = {
    tester_yaoyao: { ... }  // 動態配置挑戰
};
```

#### **優缺點評估**
- ✅ **真正分離:** 每個測試者有獨立 localStorage 空間
- ✅ **個人化:** 測試者真正「擁有」自己的資料
- ❌ **高複雜性:** 需重寫身份系統核心邏輯
- ❌ **Cloud Sync 風險:** Supabase Auth 無法支援動態 email
- ❌ **向下相容:** 可能破壞現有 tester 資料
- ❌ **Owner 發現問題:** 無法預知要觀察哪些測試者

---

### 🔴 **方案 C：完整 Supabase Auth**

#### **實作概念**
- 真實用戶註冊/登入系統
- 動態 Supabase Auth users
- 完整權限後台

#### **為什麼不建議**
- 🚫 **超出需求:** 使用者只是想改個顯示名稱
- 🚫 **開發成本:** 需要完整會員系統
- 🚫 **維護負擔:** 密碼重設、email 驗證等
- 🚫 **複雜性爆炸:** 遠超「輕量身份識別」範圍

---

## D. 推薦方案

### 🎯 **推薦：方案 A+ (增強版)**

#### **核心策略**
**先改善體驗，不碰高風險系統**

#### **實作方式**
```javascript
// 1. 新增 displayName 儲存
localStorage.setItem('testerDisplayName', userInput);

// 2. UI 顯示邏輯更新  
updateUserIndicator() {
    const display = document.getElementById('currentUserDisplay');
    if (display && this.currentUser === 'tester') {
        const customName = localStorage.getItem('testerDisplayName');
        display.textContent = customName ? `🧪 ${customName}` : '🧪 測試員';
    }
}

// 3. 其他顯示位置同步更新
renderEntryCard() {
    // owner 看到的測試者名稱
    const testerName = localStorage.getItem('testerDisplayName') || 'Alice';
    // 在 entry cards 顯示自訂名稱
}
```

#### **為什麼選擇 A+**
1. **風險最低:** 零架構更動，不會破壞現有功能
2. **快速上線:** 1-2 小時即可完成實作
3. **體驗改善:** 解決「不像自己帳號」的主要痛點  
4. **向下相容:** 完全不影響現有測試者資料
5. **漸進式:** 未來可逐步演進到方案 B

---

## E. 最小實作步驟

### 📋 **Phase 1: 基礎 Display Name**

#### **Step 1: 新增輸入界面**
- 修改測試員身份選擇流程
- 新增「請輸入你的名字」input field
- 儲存到 `localStorage.setItem('testerDisplayName', name)`

#### **Step 2: 更新顯示邏輯**
```javascript
// 位置：updateUserIndicator()
- 檢查 this.currentUser === 'tester'
- 讀取 localStorage.getItem('testerDisplayName')  
- 顯示 `🧪 ${customName}` 或預設 '🧪 測試員'
```

#### **Step 3: 同步其他顯示位置**
```javascript
// Entry cards, cloud preview, message 系統等
// 將 "Alice" 或 "測試員" 替換為動態名稱
```

### 📋 **Phase 2: 進階功能 (可選)**

#### **Step 4: 名稱驗證**
- 長度限制 (2-20 字元)
- 禁用特殊符號
- 重複檢查 (可選)

#### **Step 5: 重新設定功能**
- 允許測試員更改已設定的名稱
- 在設定或身份切換處新增「修改名稱」

#### **Step 6: Owner 觀察優化**
- Cloud Preview 顯示測試者自訂名稱
- Message 系統顯示自訂名稱

---

## F. 風險與禁止事項

### ⚠️ **技術風險評估**

#### **方案 A 風險 (極低)**
- ✅ **零系統架構風險**
- ✅ **零資料遺失風險**
- ✅ **零向下相容風險**
- ⚠️ **唯一風險:** UI 顯示邏輯錯誤 (易修復)

#### **禁止修改項目**
```javascript
// 🚫 絕對不能碰這些
const IDENTITY_CONFIG = { ... };           // 身份核心配置
const SUPABASE_EMAIL_MAP = { ... };        // Supabase 映射
setCurrentUser(identity) { ... };          // 身份設定邏輯  
getStorageKey(baseKey) { ... };           // localStorage 分離邏輯
authenticateWithSupabase() { ... };        // 認證邏輯
```

### 🛡️ **安全考量**

#### **Input 驗證必須實作**
```javascript
function validateTesterName(name) {
    // 長度檢查
    if (name.length < 2 || name.length > 20) return false;
    
    // 字元檢查 (允許中英文數字)
    const validPattern = /^[a-zA-Z0-9一-龥]+$/;
    return validPattern.test(name);
}
```

#### **XSS 防護**
```javascript
// HTML 顯示時必須 escape
display.textContent = customName;  // ✅ Safe
display.innerHTML = customName;    // ❌ Dangerous
```

---

## G. 驗收標準

### ✅ **功能驗收**

#### **基本功能**
1. **名稱輸入:** 測試員模式進入時可輸入自訂名稱
2. **名稱儲存:** 名稱正確儲存到 localStorage  
3. **UI 顯示:** 所有界面顯示自訂名稱而非 "Alice"
4. **持久性:** 重新載入頁面後名稱保持不變

#### **邊界測試**
1. **空白處理:** 空白名稱使用預設 "測試員"
2. **長度限制:** 過長名稱被截斷或拒絕
3. **特殊字元:** 特殊符號被過濾或拒絕
4. **多語言:** 中文、英文、數字正常支援

### ✅ **系統穩定性**

#### **現有功能不受影響**
1. **Owner 模式:** 完全不受影響，正常運作
2. **Guest 模式:** 完全不受影響，正常運作  
3. **localStorage 分離:** owner/tester/guest 資料仍正確分離
4. **Cloud Sync:** Supabase sync 功能完全正常
5. **Message 系統:** 現有 message 功能正常

#### **資料完整性**
1. **現有測試資料:** 所有 `*_tester` localStorage 資料保持不變
2. **Supabase 資料:** alice@climbing.dev 相關資料不受影響
3. **向下相容:** 未設定自訂名稱的情況下系統正常運作

### 📊 **驗收清單**

#### **UI 測試**
- [ ] 測試員模式顯示自訂名稱 
- [ ] 右上角用戶指示器顯示正確
- [ ] Entry cards 顯示自訂名稱
- [ ] Cloud Preview 中顯示自訂名稱 (如果有)
- [ ] Message 系統顯示自訂名稱

#### **功能測試**  
- [ ] 名稱輸入驗證正常
- [ ] 重新載入保持名稱
- [ ] 切換身份後回到測試員仍保持名稱
- [ ] 清除 localStorage 後回到預設行為

#### **迴歸測試**
- [ ] Owner 功能完全正常
- [ ] Guest 功能完全正常
- [ ] Supabase Auth 正常
- [ ] Program 功能正常
- [ ] Export 功能正常
- [ ] Cloud Preview 功能正常

---

## 🎯 **總結**

**目標達成策略:** 最小風險的體驗改善  
**推薦方案:** 方案 A+ (UI 顯示 + displayName 儲存)  
**預期成果:** 測試員體驗改善，系統穩定性保持  
**實作時間:** 1-2 小時  
**風險等級:** 🟢 極低風險

**核心原則:** 先解決使用者痛點，不破壞現有架構，為未來升級保留空間。