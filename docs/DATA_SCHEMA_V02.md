# Climbing Growth System - Data Schema V0.2

**文件版本：** V0.2  
**建立日期：** 2026-05-18  
**適用範圍：** 攀岩訓練日記工具 MVP  

---

## 📋 資料模型總覽

### 核心實體
- **Entry**: Daily Journal 訓練紀錄
- **Program**: 訓練計畫模板
- **Message**: 留言系統資料

### 儲存機制
- **localStorage**: owner/tester 持久資料
- **sessionStorage**: guest 臨時資料
- **身份隔離**: 不同身份獨立 storage key

---

## 📝 EntrySchemaV02

### 主資料結構
```javascript
{
  // === 核心識別 ===
  "timestamp": {
    "type": "ISO_timestamp_string",
    "required": true,
    "source": "system_generated",
    "cloudDB": "將拆成 id + createdAt",
    "note": "目前兼任 entry 唯一識別碼和建立時間"
  },
  "date": {
    "type": "string (YYYY-MM-DD)",
    "required": true,
    "source": "user_input",
    "cloudDB": true,
    "note": "紀錄日期"
  },

  // === 訓練核心 ===
  "todayCondition": {
    "type": "enum (good|normal|tired|exhausted)",
    "required": true,
    "source": "user_select",
    "cloudDB": true,
    "note": "今日身體狀態"
  },
  "trainingType": {
    "type": "enum (攀岩|功能訓練)",
    "required": true,
    "source": "user_select",
    "cloudDB": true,
    "note": "訓練類型分類"
  },
  "programId": {
    "type": "string",
    "required": true,
    "source": "program_reference",
    "cloudDB": true,
    "note": "關聯 Program 主鍵"
  },
  "completion": {
    "type": "enum (完成|部分|跳過)",
    "required": true,
    "source": "user_select",
    "cloudDB": true,
    "note": "訓練完成度"
  },

  // === Movement 觀察 ===
  "itemStates": {
    "type": "object",
    "required": false,
    "source": "user_interaction",
    "cloudDB": true,
    "note": "新 item 狀態: {itemName: normal|special|stuck|missed}",
    "example": {"Silent Feet": "normal", "高腳練習": "special"}
  },
  "movementNotes": {
    "type": "string",
    "required": false,
    "source": "user_input",
    "cloudDB": true,
    "note": "movement 觀察備註"
  }
}
```

### 相容性資料 (Compatibility Data)
```javascript
{
  // 為向下相容保留，未來雲端可選
  "program": {
    "type": "string",
    "source": "derived_from_programId",
    "cloudDB": false,
    "note": "Program 名稱，與 programId 對應"
  },
  "programName": {
    "type": "string", 
    "source": "duplicate_of_program",
    "cloudDB": false,
    "note": "與 program 重複，歷史原因保留"
  },
  "programCategory": {
    "type": "string",
    "source": "derived_or_snapshot",
    "cloudDB": true,
    "note": "Program 分類快照，即使 Program 刪除仍保留歷史分類"
  },
  "missedItems": {
    "type": "array[string]",
    "source": "converted_from_itemStates",
    "cloudDB": false,
    "note": "從 itemStates 轉換的舊格式"
  },
  "specialItems": {
    "type": "array[string]",
    "source": "converted_from_itemStates", 
    "cloudDB": false,
    "note": "從 itemStates 轉換的舊格式"
  }
}
```

### Legacy 資料 (保留但不使用)
```javascript
{
  // 舊訓練系統 (已廢用)
  "week": "", "mainTraining": "",
  "coreState": "", "legState": "", "shoulderState": "",
  "fatigue": "5", "exercises": "",
  "rpe": "7", "quality": "7",
  "transfer": "", "nextDayFeeling": "", "notes": ""
}
```

---

## 🏗️ ProgramSchemaV02

### 主資料結構
```javascript
{
  "id": {
    "type": "string",
    "required": true,
    "source": "system_generated",
    "cloudDB": true,
    "note": "預設: program_xxx, 自訂: program_custom_timestamp_random"
  },
  "name": {
    "type": "string",
    "required": true,
    "source": "user_input",
    "cloudDB": true,
    "note": "Program 顯示名稱"
  },
  "type": {
    "type": "enum (功能訓練|攀岩)",
    "required": true,
    "source": "user_select",
    "cloudDB": true,
    "note": "Program 分類"
  },
  "items": {
    "type": "array[string]",
    "required": true,
    "source": "user_input_or_predefined",
    "cloudDB": true,
    "note": "Training item 清單"
  },
  "createdAt": {
    "type": "ISO_timestamp",
    "required": true,
    "source": "system_generated",
    "cloudDB": true,
    "note": "Program 建立時間"
  },
  
  // 衍生資料
  "isDefault": {
    "type": "boolean",
    "source": "derived_from_id",
    "cloudDB": true,
    "note": "是否預設 Program: !id.startsWith('program_custom_')"
  }
}
```

### 相容性資料
```javascript
{
  "category": {
    "type": "string",
    "source": "legacy_compatibility",
    "cloudDB": false,
    "note": "通常與 name 或 type 重複，為舊邏輯保留"
  }
}
```

---

## 💬 MessageSchemaV02

### 主資料結構
```javascript
{
  "text": {
    "type": "string",
    "required": true,
    "source": "user_input_or_system_generated",
    "cloudDB": true,
    "note": "留言內容"
  },
  "type": {
    "type": "enum (user|auto|developer|official)",
    "required": true,
    "source": "system_determined",
    "cloudDB": true,
    "note": "留言類型，保留四種以支援 owner→tester 紙條系統"
  },
  "timestamp": {
    "type": "ISO_timestamp",
    "required": true, 
    "source": "system_generated",
    "cloudDB": "將拆成 id + createdAt",
    "note": "目前兼任 message 唯一識別碼和建立時間"
  }
}
```

### Message Type 說明
- **user**: 用戶手動輸入留言
- **auto**: 系統自動回覆留言  
- **developer**: Owner → Tester 開發者紙條
- **official**: Owner → Tester 正式通知

---

## 🗂️ Storage Key 分層

### 必須備份 (核心用戶資料)
```
climbingTrainingEntries_owner    // Owner 訓練紀錄
climbingPrograms_owner           // Owner Programs (含自訂)
```

### 選擇備份 (測試/留言資料)
```
climbingTrainingEntries_tester   // Tester 測試資料
climbingPrograms_tester          // Tester Programs
climbingMessages_owner           // Owner 留言
climbingMessages_tester          // Tester 留言  
```

### 本機狀態 (不進雲端)
```
currentUser                      // 當前身份選擇
messageUnread_tester             // 未讀留言 UI 狀態
climbingMessageOnboardingSeen_*  // Onboarding 完成標記
session_*                        // Guest 臨時資料
```

### Legacy Keys (遷移後清理)
```
climbingTrainingEntries          // 舊版未分身份
climbingPrograms                 // 舊版未分身份
```

---

## 🎯 欄位分類總結

### Primary (主資料)
**進入雲端資料庫，長期維護**
- Entry: timestamp, date, todayCondition, trainingType, programId, completion, itemStates, movementNotes
- Program: id, name, type, items, createdAt, isDefault  
- Message: text, type, timestamp

### Compatibility (相容資料)
**短期保留，雲端可選**
- Entry: program, programName, programCategory, missedItems, specialItems
- Program: category

### Legacy (舊資料)
**停止依賴，僅匯出相容**
- Entry: week, mainTraining, 三大身體狀態, fatigue, exercises, rpe, quality, 舊備註系統

### Derived (衍生資料)
**可從其他欄位計算**
- Program: isDefault (從 id 推導)
- Entry: missedItems/specialItems (從 itemStates 轉換)

---

## 🔮 未來雲端資料庫第一版建議

### Entry Table
```sql
CREATE TABLE entries (
  id VARCHAR PRIMARY KEY,           -- 獨立 entry id  
  date DATE NOT NULL,
  today_condition VARCHAR(20),
  training_type VARCHAR(20), 
  program_id VARCHAR NOT NULL,
  completion VARCHAR(20),
  item_states JSON,
  movement_notes TEXT,
  program_category VARCHAR(50),     -- 歷史分類快照
  created_at TIMESTAMP,             -- 從 timestamp 分離
  updated_at TIMESTAMP,             -- 編輯時間
  user_id VARCHAR NOT NULL
);
```

### Program Table  
```sql
CREATE TABLE programs (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  type VARCHAR(20),
  items JSON,
  is_default BOOLEAN,
  created_at TIMESTAMP,
  user_id VARCHAR NOT NULL
);
```

### Message Table
```sql  
CREATE TABLE messages (
  id VARCHAR PRIMARY KEY,           -- 獨立 message id
  text TEXT NOT NULL,
  type VARCHAR(20),                 -- user/auto/developer/official
  created_at TIMESTAMP,             -- 從 timestamp 分離  
  user_id VARCHAR NOT NULL
);
```

---

*最後更新：2026-05-18*  
*維護者：Climbing Growth System*  
*版本：V0.2 Local Data Schema*