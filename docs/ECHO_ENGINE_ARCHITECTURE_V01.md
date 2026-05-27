# ECHO_ENGINE_ARCHITECTURE_V01

**文檔版本：** V01  
**建立日期：** 2026-05-26  
**適用專案：** Climbing Growth System  
**適用範圍：** Echo 回應引擎架構設計  

---

## 📋 文檔目的

本文檔定義 Echo 回應引擎的完整架構，確保「留下紀錄後的一句安靜回應」功能的技術實現符合產品定位。

**核心理念：**
Echo 不是 AI 教練、心理分析、成長課程，而是純粹的「生活見證者」。

---

## 一、完整資料流設計

### **主要資料流程圖**

```
用戶提交 Entry
       ↓
   Entry 儲存成功
       ↓
   triggerEcho()
       ↓
   extractEntryData()
       ↓
   routeEcho(entryData)
       ↓
   getEchoPool(poolId)
       ↓
   pickRandomMessage(pool)
       ↓
   buildEchoResponse()
       ↓
   renderEcho(echoResponse)
       ↓
   顯示於指定 UI 位置
```

### **詳細流程說明**

#### **階段 1：觸發條件**
```
觸發時機：Entry 成功儲存到 localStorage/cloud 後
觸發函式：triggerEcho(entryData)
責任：決定是否產生 Echo，過濾異常情況
```

#### **階段 2：資料提取**
```
函式：extractEntryData(entry)
輸入：完整 entry object
輸出：Echo 所需的關鍵資料
處理：提取 Flow 類型、選項、completion 等
```

#### **階段 3：路由判斷**
```
函式：routeEcho(entryData)
輸入：提取後的關鍵資料
輸出：目標回應池 ID（如 "L1", "E2", "C3", "F1"）
依據：ECHO_ROUTING_RULES_V01
```

#### **階段 4：回應池取得**
```
函式：getEchoPool(poolId)
輸入：回應池 ID
輸出：對應的回應句子陣列
來源：ECHO_POOLS 常數
```

#### **階段 5：隨機選擇**
```
函式：pickRandomMessage(pool)
輸入：回應句子陣列
輸出：單一回應句子
邏輯：真隨機或偽隨機（避免重複）
```

#### **階段 6：回應建構**
```
函式：buildEchoResponse(poolId, message, entryData)
輸入：池ID、訊息、原始資料
輸出：標準化 Echo Response Object
格式：統一的回應資料結構
```

#### **階段 7：UI 渲染**
```
函式：renderEcho(echoResponse)
輸入：Echo Response Object
輸出：更新 DOM 顯示
位置：根據 MVP 決策的最佳位置
```

---

## 二、責任分工定義

### **triggerEcho(entryData)**
```
✅ 只負責：
- 判斷是否應該產生 Echo
- 過濾 guest 模式、測試資料、異常情況
- 統一 Echo 生成流程入口

❌ 不負責：
- 路由邏輯判斷
- UI 顯示
- 回應池管理
```

### **extractEntryData(entry)**
```
✅ 只負責：
- 從 entry object 提取 Echo 所需資料
- 識別 Flow 類型（Challenge/Easy/Life）
- 整理為路由判斷所需格式

❌ 不負責：
- 分類邏輯
- 資料驗證
- 默認值設定
```

### **routeEcho(entryData)**
```
✅ 只負責：
- 執行 ECHO_ROUTING_RULES_V01 判斷邏輯
- 回傳目標回應池 ID
- 處理 Fallback 情況

❌ 不負責：
- 抽取句子
- 建構回應物件
- UI 顯示
- 回應池內容管理
```

### **getEchoPool(poolId)**
```
✅ 只負責：
- 根據池 ID 取得對應句子陣列
- 驗證池 ID 有效性
- 回傳完整回應池內容

❌ 不負責：
- 隨機選擇邏輯
- 路由判斷
- 句子內容管理
```

### **pickRandomMessage(pool)**
```
✅ 只負責：
- 從句子陣列中選擇一句
- 隨機選擇邏輯（真隨機或偽隨機）
- 回傳單一句子字串

❌ 不負責：
- 池內容驗證
- 回應物件建構
- 分類邏輯
```

### **buildEchoResponse(poolId, message, entryData)**
```
✅ 只負責：
- 建立統一 Echo Response Object 格式
- 補充 metadata（時間、來源等）
- 標準化資料結構

❌ 不負責：
- 路由判斷
- UI 渲染
- 句子選擇
```

### **renderEcho(echoResponse)**
```
✅ 只負責：
- 將 Echo Response 渲染到 DOM
- 處理顯示動畫、樣式
- 管理 UI 狀態更新

❌ 不負責：
- 回應內容邏輯
- 路由判斷
- 資料處理
```

---

## 三、Echo Response Object 設計

### **統一資料格式**

```javascript
const echoResponse = {
  // 核心資料
  pool: string,           // 回應池 ID："L1", "E2", "C3", "F1"
  category: string,       // 分類名稱："安穩型", "觀察型", "留痕型"
  message: string,        // 實際回應句子
  source: string,         // 來源 Flow："life", "easy", "challenge", "fallback"
  
  // 元資料
  createdAt: string,      // ISO 時間戳
  entryId: string,        // 對應的 Entry ID
  version: string,        // Echo Engine 版本："v1.0"
  
  // 未來擴充（預留）
  confidence?: number,    // 路由判斷信心值（AI 分析用）
  keywords?: string[],    // 關鍵字標籤（文字分析用）
  sentiment?: string,     // 情緒標籤（語意分析用）
  
  // 除錯資料（開發環境）
  debug?: {
    routingPath: string[],  // 路由決策路徑
    poolSize: number,       // 原始池大小
    selectionIndex: number, // 選中的句子索引
  }
}
```

### **欄位說明**

#### **必要欄位**
- **pool**: 技術識別，用於除錯和統計
- **category**: 使用者友善名稱，用於顯示
- **message**: 核心內容，Echo 的本體
- **source**: 來源識別，用於分類統計
- **createdAt**: 時間戳，用於記錄和除錯
- **entryId**: 關聯性，連結原始 Entry

#### **可選欄位**
- **version**: 版本管理，用於相容性
- **confidence/keywords/sentiment**: 未來 AI 功能預留
- **debug**: 開發除錯資訊，生產環境可移除

---

## 四、Pool Storage Structure 設計

### **儲存結構方案 A：平面物件（推薦）**

```javascript
const ECHO_POOLS = {
  // Life Flow
  L1: [
    "穩穩的，挺好的。",
    "今天的節奏剛好。",
    "沒有勉強，真好。",
    // ... 其他 7 句
  ],
  L2: [
    "味覺也是一種記憶。",
    "今天記住了一個味道。",
    // ... 其他 8 句  
  ],
  L3: [
    "今天見到了重要的人。",
    "有些相遇被記下來了。",
    // ... 其他 8 句
  ],
  
  // Easy Flow
  E1: [
    "今天留下了一些痕跡。",
    // ... 9 句
  ],
  E2: [
    "今天看見了。",
    // ... 9 句
  ],
  E3: [
    "今天慢下來了。",
    // ... 9 句
  ],
  E4: [
    "今天有各種。",
    // ... 9 句
  ],
  
  // Challenge Flow
  C1: [
    "今天做完了。",
    // ... 9 句
  ],
  C2: [
    "今天做了一些。",
    // ... 9 句
  ],
  C3: [
    "今天有難度。",
    // ... 9 句
  ],
  
  // Fallback
  F1: [
    "今天留下了一些痕跡。",
    "這一天被記下來了。",
    // ... 其他 8 句
  ]
}
```

### **儲存結構方案 B：層級物件（備選）**

```javascript
const ECHO_POOLS = {
  life: {
    L1: { name: "安穩型", messages: [...] },
    L2: { name: "生活型", messages: [...] },
    L3: { name: "陪伴型", messages: [...] }
  },
  easy: {
    E1: { name: "累積型", messages: [...] },
    E2: { name: "觀察型", messages: [...] },
    E3: { name: "恢復型", messages: [...] },
    E4: { name: "平衡型", messages: [...] }
  },
  challenge: {
    C1: { name: "完成型", messages: [...] },
    C2: { name: "持續型", messages: [...] },
    C3: { name: "留痕型", messages: [...] }
  },
  fallback: {
    F1: { name: "通用型", messages: [...] }
  }
}
```

### **方案比較與推薦**

#### **推薦方案 A：平面物件**

**優點：**
- ✅ 存取簡單：`ECHO_POOLS[poolId]`
- ✅ 性能高效：無需二次查找
- ✅ 易於維護：結構清晰
- ✅ 易於擴充：直接新增 key-value

**缺點：**
- ❌ 缺少分類 metadata
- ❌ ID 與名稱分離

#### **備選方案 B：層級物件**

**優點：**
- ✅ 包含完整 metadata
- ✅ 邏輯分組清晰

**缺點：**
- ❌ 存取路徑複雜
- ❌ 路由需要兩層查找
- ❌ 性能稍差

**最終決策：採用方案 A**
理由：MVP 優先簡單高效，metadata 可以單獨維護

---

## 五、UI 掛載點分析

### **候選位置分析**

#### **選項 A：紀錄建立完成後 Toast**
```
優點：
✅ 即時反饋，使用者剛完成記錄
✅ 不佔用固定空間
✅ 實作簡單

缺點：
❌ 短暫顯示，可能錯過
❌ 無法回顧查看  
❌ 打斷使用者流程

適用性：⭐⭐⭐
```

#### **選項 B：紀錄卡片下方**
```
優點：
✅ 與紀錄內容緊密關聯
✅ 可以隨時查看
✅ 符合日記感

缺點：
❌ 增加頁面長度
❌ 可能影響其他卡片
❌ 需要考慮響應式設計

適用性：⭐⭐⭐⭐⭐
```

#### **選項 C：詳細頁**
```
優點：
✅ 有專門空間展示
✅ 不影響列表頁
✅ 可以有更豐富設計

缺點：
❌ 需要點擊進入才能看到
❌ 降低可見性
❌ 增加頁面複雜度

適用性：⭐⭐
```

#### **選項 D：首頁最近一則**
```
優點：
✅ 高可見性
✅ 鼓勵持續使用
✅ 簡潔有效

缺點：
❌ 只能看到最新一則
❌ 與紀錄內容脫節
❌ 佔用首頁空間

適用性：⭐⭐⭐
```

### **MVP 推薦方案**

**第一選擇：選項 B - 紀錄卡片下方**

**理由：**
1. **符合日記感** - Echo 就像紙條夾在日記頁面裡
2. **內容關聯強** - 與對應的記錄緊密相關
3. **隨時可見** - 不會錯過，可以回顧
4. **實作適中** - 不需要複雜的 UI 邏輯

**實作方式：**
```html
<div class="entry-card">
  <!-- 原有紀錄內容 -->
  <div class="entry-content">...</div>
  
  <!-- Echo 顯示區域 -->
  <div class="echo-response">
    <span class="echo-message">今天留下了一個味道。</span>
  </div>
</div>
```

**後續考慮：**
- Phase 2 可以增加 Toast 即時反饋
- Phase 3 可以考慮詳細頁擴展

---

## 六、未來擴充點標記

### **擴充點 Alpha：智能路由層**
```
位置：routeEcho() 函式內部
時機：Phase 2+ 
功能：在基礎路由後增加 AI 修正邏輯

// 基礎路由
const basicPoolId = applyBasicRoutingRules(entryData);

// 【擴充點 Alpha】智能修正層
const enhancedPoolId = enhanceWithAI(basicPoolId, entryData);

return enhancedPoolId || basicPoolId; // Fallback 到基礎路由
```

### **擴充點 Beta：文字分析層**
```
位置：extractEntryData() 函式內部
時機：Phase 3+
功能：分析 movementNotes 文字內容

// 基礎資料提取  
const basicData = extractBasicFields(entry);

// 【擴充點 Beta】文字分析層
const textAnalysis = analyzeMovementNotes(entry.movementNotes);
basicData.sentiment = textAnalysis.sentiment;
basicData.keywords = textAnalysis.keywords;

return basicData;
```

### **擴充點 Gamma：智能選句層**
```
位置：pickRandomMessage() 函式內部
時機：Phase 4+
功能：根據分析結果選擇最適合的句子

// 基礎隨機選擇
const randomMessage = selectRandom(pool);

// 【擴充點 Gamma】智能選句層
const smartMessage = selectByContext(pool, entryData.sentiment);

return smartMessage || randomMessage; // Fallback 到隨機
```

### **擴充點 Delta：動態回應生成**
```
位置：buildEchoResponse() 函式後
時機：Phase 5+（遠期功能）
功能：基於模板動態生成個性化回應

// 靜態回應池選擇
const staticResponse = buildEchoResponse(poolId, message, entryData);

// 【擴充點 Delta】動態生成層  
const dynamicResponse = generatePersonalizedEcho(entryData);

return dynamicResponse || staticResponse; // Fallback 到靜態
```

### **擴充原則**
- **向下相容** - 新功能不影響基礎功能
- **Fallback 安全** - AI 失效時回到確定性邏輯
- **漸進啟用** - 可以選擇性開啟智能功能
- **性能優先** - 不影響基礎回應速度

---

## 七、MVP 實作建議

### **Phase 1：最小可行版本**

#### **必要功能清單**
```
✅ 必須實作：
1. triggerEcho() - 基礎觸發邏輯
2. extractEntryData() - 基礎資料提取  
3. routeEcho() - 確定性路由規則
4. getEchoPool() - 靜態回應池存取
5. pickRandomMessage() - 真隨機選擇
6. buildEchoResponse() - 標準化回應物件
7. renderEcho() - 基礎 UI 渲染

❌ 暫不實作：
- AI 分析功能
- NLP 文字處理
- 關鍵字匹配
- 情緒識別
- 動態回應生成
- 複雜動畫效果
```

#### **開發優先順序**
```
Week 1: 
- 建立 ECHO_POOLS 常數
- 實作 routeEcho() 核心邏輯
- 實作 Life Flow 路由（最簡單）

Week 2:
- 實作 Easy Flow 路由（最複雜）
- 實作 Challenge Flow 路由
- 實作 Fallback 機制

Week 3:
- 實作 UI 渲染邏輯
- 整合到現有表單提交流程
- 基礎測試覆蓋

Week 4:
- 全流程測試
- 邊界情況處理
- 性能優化
```

#### **技術債務管理**
```
可接受的技術債務（MVP 階段）:
- 硬編碼回應池內容
- 簡單隨機算法
- 基礎 CSS 樣式
- 最小錯誤處理

必須避免的技術債務：
- 緊耦合的函式設計
- 缺少 Fallback 機制  
- 不可擴展的資料結構
- 沒有版本管理
```

### **Phase 1+ 後續規劃**

#### **Phase 1.5：體驗優化**
- 改善 UI 樣式和動畫
- 增加 Toast 即時反饋
- 優化隨機算法（避免重複）
- 增加使用統計

#### **Phase 2：智能增強**
- 導入 movementNotes 分析
- 增加關鍵字檢測
- 實作路由修正邏輯

#### **Phase 3：高級功能**
- AI 語意理解
- 個性化回應選擇
- 動態回應生成

---

## 八、實作指導原則

### **代碼組織原則**

#### **文件結構建議**
```
app.js 中新增：
- EchoEngine 物件
- 所有 Echo 相關函式封裝在內
- 與現有功能解耦

或獨立文件：
- echoEngine.js（如果內容較多）
- 在 app.js 中引用
```

#### **函式命名規範**
```
主要函式：
- triggerEcho()
- routeEcho() 
- renderEcho()

輔助函式：
- extractEntryData()
- getEchoPool()
- pickRandomMessage()
- buildEchoResponse()

常數：
- ECHO_POOLS
- ECHO_CATEGORIES
- ECHO_CONFIG
```

### **測試策略**

#### **單元測試優先級**
```
高優先級：
- routeEcho() 路由邏輯
- extractEntryData() 資料提取
- buildEchoResponse() 物件建構

中優先級：
- pickRandomMessage() 隨機選擇  
- getEchoPool() 池存取

低優先級：
- renderEcho() UI 渲染
- triggerEcho() 觸發邏輯
```

#### **整合測試場景**
```
必測場景：
- Life Flow 三種選項完整流程
- Easy Flow 多選組合邏輯
- Challenge Flow 四種完成度
- Fallback 異常處理

邊界測試：
- 空資料、null 值
- 無效 Flow 類型
- 不存在的 poolId
- 空的回應池
```

---

## 九、性能與安全考量

### **性能要求**
```
回應速度：
- 路由判斷：< 5ms
- 句子選擇：< 2ms
- 回應建構：< 3ms  
- UI 渲染：< 10ms
- 總 Echo 生成：< 20ms

記憶體使用：
- ECHO_POOLS 預載入到記憶體
- 單一 Echo Response < 1KB
- 總記憶體增量 < 50KB
```

### **安全考量**
```
資料安全：
- 不記錄敏感個人資訊
- Echo Response 不包含原始 movementNotes
- 統計資料匿名化

邏輯安全：
- 所有用戶輸入都經過路由驗證
- Fallback 機制確保永遠有回應
- 不信任前端傳入的 poolId
```

---

## 十、監控與維護

### **運行時監控**
```
關鍵指標：
- 各回應池使用頻率
- Fallback 觸發率
- 平均回應生成時間
- UI 渲染成功率

異常監控：
- 路由失敗事件
- 空回應池事件
- 渲染錯誤事件
```

### **內容維護**
```
回應池管理：
- 定期審核回應句子品質
- 根據使用統計調整內容
- 確保符合 ECHO_STYLE_CHARTER

版本管理：
- Echo Engine 版本追蹤
- 回應池內容版本化
- 向下相容性保證
```

---

## 🔒 架構決策記錄

### **重要技術決策**

#### **決策 1：採用確定性路由**
- **理由**：MVP 階段確保穩定可預測
- **影響**：相同輸入永遠產生相同輸出
- **未來**：保留 AI 擴充接口但不影響基礎邏輯

#### **決策 2：選擇平面物件儲存**
- **理由**：存取效率高，結構簡單
- **影響**：犧牲部分 metadata 但提升性能
- **未來**：可以透過獨立 mapping 補充 metadata

#### **決策 3：卡片下方顯示位置**
- **理由**：最符合日記小紙條概念
- **影響**：需要修改現有卡片樣式
- **未來**：可以增加其他顯示位置作為補充

#### **決策 4：同步而非異步生成**  
- **理由**：MVP 階段保持簡單，用戶期望即時回應
- **影響**：如果未來加入 AI 分析可能需要改為異步
- **未來**：預留異步接口但 Fallback 到同步

---

# MVP Implementation Scope

## 📋 MVP 邊界定義

### **MVP 只做這件事**

```
Entry 儲存成功後：
1. 根據 entry 判斷 flow/pool
2. 從對應 pool 抽一句
3. 建立最小 Echo Response Object  
4. 顯示在該 entry 卡片底部
```

**核心目標：** 讓使用者在完成記錄後，在卡片底部看到一句溫和的回應。

---

## 🎯 MVP 做什麼

### **保留的核心函式**
```javascript
// 核心邏輯函式（簡化版）
routeEcho(entry)                    // 判斷對應的 pool ID
pickRandomMessage(pool)             // 從 pool 隨機選一句
buildEchoResponse(entry, pool, message)  // 建立最小回應物件  
renderEcho(entry, echoResponse)     // 在卡片底部顯示
```

### **最小資料流**
```
Entry 儲存成功
       ↓
   routeEcho(entry) 
       ↓
   取得 pool ID（"L1", "E2", "C3", "F1"）
       ↓
   pickRandomMessage(ECHO_POOLS[poolId])
       ↓
   buildEchoResponse() 
       ↓
   renderEcho() 在該 entry 卡片底部顯示
```

### **最小 Echo Response Object**
```javascript
{
  pool: "L2",                        // pool ID
  category: "生活型",                // 分類名稱
  message: "今天留下了一個味道。",    // 實際句子
  source: "life",                    // 來源 flow
  entryId: entry.id                  // 對應 entry ID
}
```

### **唯一 UI 掛載點**
- **位置：** 紀錄卡片底部
- **樣式：** 淡淡的一句話，不搶奪主視覺
- **行為：** 靜態顯示，無互動

---

## ❌ MVP 不做什麼

### **AI 相關功能**
```
❌ AI 分析
❌ NLP 處理  
❌ movementNotes 文字分析
❌ 關鍵字判斷
❌ 智能選句
❌ 動態生成
❌ 語意分析
❌ 情緒識別
❌ 機器學習
```

### **雲端功能**
```
❌ Echo Cloud Sync
❌ 新 Supabase table
❌ 新 entry 欄位
❌ 跨裝置同步
❌ Echo 歷史記錄
❌ Echo 統計分析
```

### **複雜 UI 功能**
```
❌ Toast 通知
❌ 首頁大提示  
❌ 彈窗顯示
❌ 複雜動畫
❌ 詳細頁展示
❌ Dashboard
❌ 週期報告
❌ 互動功能（點讚、收藏）
```

### **進階資料欄位**
```
❌ AI 相關欄位（confidence, sentiment, keywords）
❌ Metadata（debug, routing path, selection index）
❌ 時間戳（createdAt, updatedAt）
❌ 版本管理（version, schema）
❌ 使用者行為（viewCount, interaction）
```

---

## 📊 MVP 實作邊界

### **ECHO_POOLS 常數**
```javascript
// 只需要這樣簡單的結構
const ECHO_POOLS = {
  L1: [10句安穩型回應],
  L2: [10句生活型回應], 
  L3: [10句陪伴型回應],
  E1: [10句累積型回應],
  E2: [10句觀察型回應],
  E3: [10句恢復型回應],
  E4: [10句平衡型回應],
  C1: [10句完成型回應],
  C2: [10句持續型回應], 
  C3: [10句留痕型回應],
  F1: [10句通用回應]
}
```

### **路由邏輯**
```javascript
// 只實作 ECHO_ROUTING_RULES_V01 的確定性規則
function routeEcho(entry) {
  // 識別 Flow 類型
  if (entry.lifeChoice) return routeLifeFlow(entry.lifeChoice);
  if (entry.easyChoice) return routeEasyFlow(entry.easyChoice);  
  if (entry.completion) return routeChallengeFlow(entry.completion);
  return "F1"; // Fallback
}
```

### **UI 渲染**
```html
<!-- 只在 entry card 底部加這一行 -->
<div class="entry-card">
  <!-- 現有紀錄內容 -->
  
  <!-- MVP Echo 顯示 -->
  <div class="echo-response">
    <span class="echo-message">今天留下了一個味道。</span>
  </div>
</div>
```

### **CSS 樣式要求**
```css
.echo-response {
  /* 淡淡的、不搶視覺、像小紙條 */
  font-size: 0.85rem;
  color: #888;
  opacity: 0.7;
  text-align: center;
  margin-top: 0.8rem;
  font-style: italic;
}
```

---

## 🔧 下一步 ECHO-4B 實作邊界

### **v0.2-ECHO-4B 只需要完成**

#### **1. 建立 ECHO_POOLS 常數**
- 將所有回應池句子硬編碼到 app.js
- 使用簡單的物件結構
- 不需要動態載入或外部檔案

#### **2. 實作核心函式**
```javascript
// 只需要這4個函式
function routeEcho(entry) { ... }           // 30行以內
function pickRandomMessage(pool) { ... }    // 5行以內  
function buildEchoResponse(...) { ... }     // 10行以內
function renderEcho(entry, response) { ... } // 15行以內
```

#### **3. 整合到現有表單流程**
- 在 handleFormSubmit() 成功後呼叫
- 在 createEntryCard() 中顯示 Echo
- 不修改 entry object 結構
- 不新增資料庫欄位

#### **4. 基礎樣式**
- 最簡單的 CSS
- 符合現有深色主題
- 不需要動畫效果

### **驗收標準**
```
✅ 提交 Life Flow 記錄後，卡片底部出現對應 L1/L2/L3 回應
✅ 提交 Easy Flow 記錄後，卡片底部出現對應 E1/E2/E3/E4 回應
✅ 提交 Challenge Flow 記錄後，卡片底部出現對應 C1/C2/C3 回應
✅ 異常情況觸發 F1 Fallback 回應
✅ 每次重新整理頁面，Echo 依然正確顯示
✅ 樣式符合日記小紙條感覺
```

### **不在 ECHO-4B 範圍內**
- 任何 AI 功能擴充點的實作
- 複雜的錯誤處理機制
- 使用統計或分析功能
- 除了卡片底部以外的任何 UI 位置
- 任何雲端同步功能

---

## ⚖️ 與完整架構的關係

### **MVP 是完整架構的子集**
- 保留核心資料流概念
- 保留函式職責分工
- 保留未來擴充點標記
- 簡化實作但不違背設計原則

### **未來升級路徑**
```
MVP (v0.2) → 體驗優化 (v0.3) → 智能增強 (v0.4) → 高級功能 (v0.5)
```

**MVP 完成後可以：**
- 逐步增加 Echo Response Object 欄位
- 逐步實作預留的擴充點
- 逐步增加其他 UI 掛載點
- 逐步引入 AI 分析功能

**但現在專注於：**
讓第一個版本穩定運行，使用者能看到基礎的 Echo 回應功能。

---

*最後更新：2026-05-26*  
*文檔狀態：✅ MVP 範圍已定義*  
*實作狀態：⏳ 待開發（v0.2-ECHO-4B MVP）*  
*MVP 目標：Entry 卡片底部顯示一句溫和回應*