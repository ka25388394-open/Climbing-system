# Climbing Growth System - Backup Plan V0.2

**文件版本：** V0.2  
**建立日期：** 2026-05-18  
**適用範圍：** 完整備份與資料匯入規劃  

---

## 🎯 備份策略總覽

### 備份目標
1. **資料安全** - 防止 localStorage 清除導致資料遺失
2. **跨裝置移轉** - 支援資料在不同裝置間轉移  
3. **雲端準備** - 為未來雲端同步建立標準格式
4. **除錯支援** - 協助問題排查和資料分析

### 備份原則
- **完整性** - 包含所有核心用戶資料
- **可讀性** - JSON 格式，便於檢查和除錯
- **版本化** - 標記備份格式版本，支援未來升級
- **身份隔離** - 不同身份獨立備份檔案

---

## 📋 Storage Key 分類

### 🏆 必須備份 (核心用戶資料)
```javascript
// Owner 主要資料
"climbingTrainingEntries_owner": "Owner Daily Journal 訓練紀錄",
"climbingPrograms_owner": "Owner Programs (預設 + 自訂)"

// Tester 主要資料
"climbingTrainingEntries_tester": "Tester Daily Journal 訓練紀錄",
"climbingPrograms_tester": "Tester Programs (預設 + 自訂)"
```

### 🔧 選擇備份 (用戶體驗資料)
```javascript
// 留言系統
"climbingMessages_owner": "Owner 留言記錄",
"climbingMessages_tester": "Tester 留言記錄",

// 系統狀態
"currentUser": "當前身份選擇 (owner/tester)"
```

### 📱 本機狀態 (不建議備份)
```javascript
// UI 狀態標記
"messageUnread_tester": "Tester 未讀留言標記 (重建即可)",
"climbingMessageOnboardingSeen_owner": "Owner onboarding 完成 (重建即可)",
"climbingMessageOnboardingSeen_tester": "Tester onboarding 完成 (重建即可)",

// 臨時資料
"session_climbingTrainingEntries": "Guest 臨時訓練資料 (不持久)",
"session_climbingPrograms": "Guest 臨時 Programs (不持久)",
"session_climbingMessages": "Guest 臨時留言 (不持久)"
```

### 🗑️ Legacy Keys (遷移後可忽略)
```javascript
"climbingTrainingEntries": "舊版未分身份 entries (已遷移)",
"climbingPrograms": "舊版未分身份 programs (已遷移)"
```

---

## 📄 備份 JSON 格式草案

### 完整備份格式
```javascript
{
  "backupVersion": "v0.2",
  "exportedAt": "2026-05-18T12:34:56.789Z",
  "appName": "Climbing Growth System",
  "appVersion": "v0.2",
  "storageType": "localStorage/sessionStorage mixed",
  
  // 備份主體身份
  "identity": "owner",  // 或 "tester"
  
  // 主要資料 (必須)
  "data": {
    "localStorage": {
      // 核心訓練資料
      "climbingTrainingEntries_owner": "[JSON Array of Entries]",
      "climbingPrograms_owner": "[JSON Array of Programs]",
      
      // 留言資料 (可選)
      "climbingMessages_owner": "[JSON Array of Messages]",
      
      // 系統狀態 (可選)
      "currentUser": "owner"
    },
    
    // Guest 臨時資料 (通常為空)
    "sessionStorage": {
      "session_climbingTrainingEntries": "[JSON Array] or null",
      "session_climbingPrograms": "[JSON Array] or null"
    }
  },
  
  // 備份統計
  "metadata": {
    "entriesCount": 42,
    "programsCount": 8,
    "customProgramsCount": 3,
    "messagesCount": 15,
    "hasLegacyData": false,
    "timestampCoverage": "100%",  // 有多少 % 的 Entry 含有 timestamp
    "oldestEntry": "2026-01-15T10:30:00.000Z",
    "newestEntry": "2026-05-18T12:34:56.789Z",
    "dataIntegrityCheck": "passed"  // passed/failed
  },
  
  // 備份註記
  "notes": [
    "包含 owner 身份的完整資料",
    "Legacy 欄位已保留以確保相容性",
    "itemStates 和 missedItems/specialItems 雙格式並存"
  ]
}
```

### 輕量備份格式 (僅核心資料)
```javascript
{
  "backupVersion": "v0.2-lite",
  "exportedAt": "2026-05-18T12:34:56.789Z",
  "identity": "owner",
  
  "data": {
    // 只包含核心資料，不含留言和系統狀態
    "entries": "[JSON Array of Entries]",
    "programs": "[JSON Array of Programs]"
  },
  
  "metadata": {
    "entriesCount": 42,
    "programsCount": 8,
    "backupType": "core-data-only"
  }
}
```

---

## 🔄 匯入功能未來風險提醒

### 🚨 高風險操作
1. **身份混淆**
   - 風險：owner 資料匯入到 tester 身份
   - 緩解：匯入前確認身份，或提供身份轉換選項

2. **資料覆蓋**  
   - 風險：匯入資料覆蓋現有資料，造成遺失
   - 緩解：匯入前備份現有資料，提供合併選項

3. **格式不相容**
   - 風險：舊版本備份格式與新版本不相容
   - 緩解：版本檢查和格式升級邏輯

### ⚠️ 中風險操作
4. **程式碼依賴**
   - 風險：匯入的 Legacy 資料缺乏某些欄位
   - 緩解：匯入時自動補齊必要預設值

5. **Timestamp 衝突**
   - 風險：匯入資料的 timestamp 與現有資料重複
   - 緩解：檢查 timestamp 唯一性，重複時重新生成

6. **Program 關聯**
   - 風險：Entry 的 programId 在匯入後找不到對應 Program
   - 緩解：匯入時檢查關聯完整性，自動修復或提示

### 🟢 相對安全
7. **增量匯入** - 只匯入新資料，不覆蓋現有
8. **Preview 模式** - 先預覽匯入效果，用戶確認後執行
9. **Rollback 機制** - 匯入失敗時自動回滾

---

## 🛡️ 備份檔案安全建議

### 檔案命名規範
```
climbing_backup_owner_20260518_143456.json      // 完整備份
climbing_backup_tester_20260518_143456.json     // Tester 備份
climbing_backup_owner_20260518_143456_lite.json // 輕量備份
```

### 檔案驗證
```javascript
// 備份檔案完整性檢查
function validateBackupFile(backupData) {
  const issues = [];
  
  // 版本檢查
  if (!backupData.backupVersion) {
    issues.push("缺少備份版本資訊");
  }
  
  // 必要欄位檢查
  if (!backupData.data || !backupData.metadata) {
    issues.push("備份檔案格式不完整");
  }
  
  // 資料一致性檢查
  const actualEntriesCount = JSON.parse(
    backupData.data.localStorage['climbingTrainingEntries_owner'] || '[]'
  ).length;
  
  if (actualEntriesCount !== backupData.metadata.entriesCount) {
    issues.push("Entry 數量不一致");
  }
  
  return issues;
}
```

### 隱私保護
- 備份檔案包含個人訓練資料，應提醒用戶安全保存
- 不建議上傳到公開雲端空間
- 考慮加密選項（未來版本）

---

## 📊 雲端同步準備

### 第一階段：單向上傳
```javascript
// 雲端備份最小欄位
{
  "entries": [
    {
      "id": "從 timestamp 轉換",
      "date": "保持不變",
      "todayCondition": "保持不變", 
      "trainingType": "保持不變",
      "programId": "保持不變",
      "completion": "保持不變",
      "itemStates": "保持不變",
      "movementNotes": "保持不變",
      "programCategory": "歷史快照保留",
      "createdAt": "從 timestamp 轉換",
      "userId": "身份轉用戶ID"
    }
  ],
  "programs": [
    {
      "id": "保持不變",
      "name": "保持不變", 
      "type": "保持不變",
      "items": "保持不變",
      "isDefault": "從 id 推導",
      "createdAt": "保持不變",
      "userId": "身份轉用戶ID"
    }
  ]
}
```

### 不上傳到雲端
```javascript
// 僅本機保留的資料
- 所有 Legacy 欄位 (week, mainTraining, 舊身體狀態等)
- UI 狀態標記 (onboarding, messageUnread 等)
- 重複欄位 (program, programName 等)
- 衍生資料 (missedItems, specialItems 等)
```

---

## 🚀 未來匯入功能規劃

### 匯入選項設計
```javascript
{
  "importType": "merge",  // merge/replace/append
  "targetIdentity": "owner",  // 目標身份
  "includeMessages": true,    // 是否包含留言
  "handleConflicts": "skip",  // skip/overwrite/merge
  "backupBeforeImport": true  // 匯入前自動備份
}
```

### 匯入流程
1. **驗證備份檔案** - 格式、版本、完整性
2. **身份確認** - 確認匯入目標身份
3. **衝突檢查** - timestamp 重複、programId 關聯
4. **預覽變更** - 顯示將新增/修改的資料
5. **執行匯入** - 安全寫入 localStorage  
6. **驗證結果** - 確認匯入成功，資料完整

### 錯誤處理
- **格式錯誤** - 提示檔案格式問題，拒絕匯入
- **版本不相容** - 提供格式升級或降級提示
- **部分失敗** - 回滾已匯入資料，恢復原狀態
- **關聯缺失** - 自動修復或提示用戶處理選項

---

*最後更新：2026-05-18*  
*維護者：Climbing Growth System*  
*版本：V0.2 Backup Plan*