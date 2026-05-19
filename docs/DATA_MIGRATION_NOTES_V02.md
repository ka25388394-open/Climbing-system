# Climbing Growth System - Data Migration Notes V0.2

**文件版本：** V0.2  
**建立日期：** 2026-05-18  
**適用範圍：** 資料遷移與相容性注意事項  

---

## 📦 Legacy 欄位列表

### Entry Legacy 欄位
```javascript
// 舊訓練系統 (v0.1 時代，已廢用)
"week": "",                    // 8週課表系統廢用後設為空值
"mainTraining": "",            // 舊主訓練欄位
  
// 舊身體狀態系統 (改用 todayCondition)
"coreState": "",               // 核心傳導狀態
"legState": "",                // 單腳穩定狀態  
"shoulderState": "",           // 肩胛穩定狀態

// 舊量化系統 (改用 movement 觀察)
"fatigue": "5",                // 疲勞度滑桿 (1-10)
"rpe": "7",                    // RPE 評分 (1-10)
"quality": "7",                // 完成品質評分 (1-10)

// 舊備註系統 (改用 movementNotes)
"exercises": "",               // 舊訓練內容大欄位
"transfer": "",                // 轉移感評估
"nextDayFeeling": "",          // 隔天體感
"notes": ""                    // 一般備註
```

### Message Legacy Type
```javascript
// 目前未實際使用，但保留給未來擴展
"developer": "owner → tester 開發者紙條",
"official": "owner → tester 正式通知"
```

---

## 🔗 Compatibility 欄位列表

### Entry Compatibility 欄位
```javascript
// 顯示邏輯相容 (短期不可刪)
"program": "攀岩技術日",           // 與 programId 對應的名稱
"programName": "攀岩技術日",       // 與 program 重複，歷史原因

// 分類快照 (長期保留)
"programCategory": "攀岩",         // 即使 Program 被刪除，Entry 仍保留當時分類

// 舊格式轉換 (向下相容)
"missedItems": ["路線閱讀"],       // 從 itemStates 轉換: status === 'missed'
"specialItems": ["高腳練習"]       // 從 itemStates 轉換: status === 'special'
```

### Program Compatibility 欄位
```javascript
// 分類輔助 (功能訓練時常與 name 重複)
"category": "核心"                 // 攀岩類別時都是「攀岩」
```

---

## ❌ 現在不能刪的欄位

### 🚨 **絕對不可刪除**
1. **Entry Legacy 欄位** - CSV 匯出功能依賴
2. **program + programName** - 顯示邏輯雙重引用
3. **missedItems + specialItems** - 舊版本 Entry Card 顯示
4. **programCategory** - Entry 歷史分類快照，不可失去

### ⚠️ **暫不可刪除**
5. **Program category** - 現有建立邏輯依賴
6. **Message developer/official type** - 未來紙條系統預留

### 🔍 **需確認風險**
7. **Legacy 欄位預設值** - 確保 CSV 匯出格式穩定
8. **程式碼引用檢查** - 確認無遺漏的 legacy 欄位引用

---

## 🚫 停止主動依賴的欄位

### Entry 停用邏輯
```javascript
// 這些欄位只保留值，不再主動使用
const DEPRECATED_ENTRY_FIELDS = [
  'week', 'mainTraining',           // 舊訓練系統
  'coreState', 'legState', 'shoulderState',  // 舊身體狀態
  'fatigue', 'exercises',           // 舊量化評估
  'rpe', 'quality',                 // 舊評分系統
  'transfer', 'nextDayFeeling', 'notes'  // 舊備註系統
];

// 新 Entry 應設為預設值，不讓用戶填寫
// 舊 Entry 保持現有值，確保匯出相容性
```

### UI 表單停用
- 這些欄位對應的表單元素應隱藏或禁用
- getFormData() 中設為固定預設值
- 只在 CSV 匯出時讀取既有值

---

## 🔄 itemStates 與舊格式關係

### 轉換邏輯
```javascript
// 新格式 → 舊格式 (向下相容)
function convertItemStatesToLegacy(itemStates) {
  const missedItems = [];
  const specialItems = [];
  
  Object.entries(itemStates || {}).forEach(([item, status]) => {
    if (status === 'missed') missedItems.push(item);
    if (status === 'special') specialItems.push(item); 
    // 'normal', 'stuck' 不進入舊格式
  });
  
  return { missedItems, specialItems };
}

// 舊格式 → 新格式 (資料升級)
function convertLegacyToItemStates(missedItems, specialItems, programItems) {
  const itemStates = {};
  
  programItems.forEach(item => {
    if (missedItems.includes(item)) {
      itemStates[item] = 'missed';
    } else if (specialItems.includes(item)) {
      itemStates[item] = 'special';
    } else {
      itemStates[item] = 'normal';  // 預設狀態
    }
  });
  
  return itemStates;
}
```

### 相容性維護
- 新 Entry 主要依賴 `itemStates`
- `missedItems` / `specialItems` 從 `itemStates` 自動產生
- 舊 Entry 顯示時可從 `missedItems` / `specialItems` 重建 `itemStates`

---

## 🔑 timestamp 與未來 id 關係

### 現況問題
```javascript
// 目前 timestamp 身兼多職
"timestamp": "2026-05-18T12:34:56.789Z"  // 同時是：
// 1. Entry 唯一識別碼 (editEntry 定位)
// 2. Entry 建立時間 (顯示排序)
// 3. CSV 匯出的「建立時間」欄位
```

### 未來分離計畫
```javascript
// 雲端資料庫分離方案
{
  "id": "entry_uuid_generated",           // 獨立唯一識別碼
  "createdAt": "2026-05-18T12:34:56.789Z", // 建立時間 (來自原 timestamp)
  "updatedAt": "2026-05-18T14:20:15.123Z"  // 最後編輯時間 (新增)
}
```

### 遷移策略
1. **Phase 1**: 保持 `timestamp` 作為 entry 定位
2. **Phase 2**: 雲端同步時，`timestamp` → `createdAt`，另外生成 `id`
3. **Phase 3**: 本地 MVP 可持續用 `timestamp` 定位

---

## 🎯 program.id 與 name__type fallback 關係

### ID 穩定性檢查
```javascript
// 預設 Program - ID 穩定
"id": "program_core"              ✅ 固定不變
"id": "program_shoulder"          ✅ 固定不變
"id": "program_leg"               ✅ 固定不變

// 自訂 Program - ID 自動生成
"id": "program_custom_1716123456789_abc123"  ✅ 唯一生成
```

### Fallback 機制必要性
```javascript
// 情境 1: 舊版本 Program 可能缺 id
const program = programs.find(p => p.id === targetId) ||          // 主要查找
               programs.find(p => `${p.name}__${p.type}` === fallbackKey);  // fallback

// 情境 2: Entry 中 programId 可能使用舊格式  
"programId": "核心__功能訓練"      // 舊格式，需 fallback 支援
"programId": "program_core"        // 新格式，直接 id 查找
```

### 風險與維護
- **Fallback 機制不可移除** - 舊資料依賴
- **Name__Type 重複風險** - 自訂 Program 可能與預設重複名稱
- **查找優先序** - 永遠優先 id，再 fallback name__type

---

## ⚠️ 遷移風險提醒

### 高風險操作
1. **刪除 Compatibility 欄位** - 會破壞向下相容
2. **修改 timestamp 格式** - 會破壞 editEntry 定位
3. **清理 Legacy 欄位** - 會破壞 CSV 匯出
4. **移除 name__type fallback** - 會破壞舊 Entry 顯示

### 中風險操作  
5. **修改 itemStates 格式** - 需同步更新轉換邏輯
6. **調整 program.id 生成規則** - 需確保唯一性
7. **變更 Message type** - 需確認紙條系統相容

### 安全操作
8. **新增欄位** - 只要有預設值處理即可
9. **標記 deprecated** - 不影響現有功能
10. **文檔化 schema** - 純粹資訊整理

---

## 🛠️ 遷移最佳實踐

### 資料完整性檢查
```javascript
// 建議的資料健康檢查
function validateDataIntegrity() {
  const issues = [];
  
  // 檢查 timestamp 存在性
  entries.forEach((entry, index) => {
    if (!entry.timestamp) {
      issues.push(`Entry ${index}: 缺少 timestamp`);
    }
  });
  
  // 檢查 programId 有效性  
  entries.forEach((entry, index) => {
    const program = findProgramById(entry.programId);
    if (!program) {
      issues.push(`Entry ${index}: programId '${entry.programId}' 找不到對應 Program`);
    }
  });
  
  return issues;
}
```

### 漸進式清理策略
1. **標記 Legacy** - 先停止依賴，不立即刪除
2. **雙軌運行** - 新舊格式並存一段時間  
3. **驗證完整** - 確認新邏輯完全替換舊邏輯
4. **逐步移除** - 最後階段才清理 Legacy 欄位

---

*最後更新：2026-05-18*  
*維護者：Climbing Growth System*  
*版本：V0.2 Migration Notes*