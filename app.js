// Firebase Lite Backup - 雲端備份層
class CloudBackup {
    constructor(userId) {
        this.userId = userId;
        this.db = null;
        this.isInitialized = false;
        this.initFirebase();
    }

    // Firebase 初始化
    async initFirebase() {
        try {
            // Firebase 配置 - 需要設置真實的 Firebase 專案
            // 📝 TODO: 替換為實際的 Firebase 配置
            const firebaseConfig = {
                apiKey: "YOUR_API_KEY",
                authDomain: "your-project.firebaseapp.com",
                projectId: "your-project-id",
                storageBucket: "your-project.appspot.com",
                messagingSenderId: "123456789012",
                appId: "1:123456789012:web:your-app-id"
            };

            // 使用 window.firebaseModules 中的模組
            if (typeof window.firebaseModules !== 'undefined') {
                const { initializeApp, getFirestore } = window.firebaseModules;
                const app = initializeApp(firebaseConfig);
                this.db = getFirestore(app);
                this.isInitialized = true;
            }
        } catch (error) {
            console.log('Firebase 初始化失敗，僅使用本地存儲:', error);
            this.isInitialized = false;
        }
    }

    // 異步備份數據到 Firebase
    async backup(entries, programs) {
        if (!this.isInitialized || !this.db) {
            return { success: false, message: '備份服務未可用' };
        }

        try {
            // 動態導入 Firestore 方法
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');

            const backupData = {
                entries: entries,
                programs: programs,
                updatedAt: new Date().toISOString()
            };

            await setDoc(doc(this.db, 'users', this.userId, 'backup', 'main'), backupData);
            return { success: true, message: '已備份' };
        } catch (error) {
            console.log('Firebase 備份失敗:', error);
            return { success: false, message: '備份失敗，本地已保存' };
        }
    }
}

// Supabase Email 映射
const SUPABASE_EMAIL_MAP = {
    owner: "xavier@climbing.dev",
    tester: "alice@climbing.dev"
};

// 身份配置
const IDENTITY_CONFIG = {
    owner: {
        name: "Xavier",
        username: "Xavier",
        displayName: "👨‍💻 開發者",
        firebasePrefix: "demo_owner"
    },
    tester: {
        name: "Alice",
        username: "Alice",
        displayName: "🧪 測試員",
        firebasePrefix: "demo_tester"
    },
    guest: {
        name: "訪客",
        displayName: "👁️ 訪客",
        noAuth: true,
        useSessionStorage: true
    }
};

// 攀岩生活日記 - 功能邏輯
class ClimbingTrainingJournal {
    constructor() {
        // 初始化身份系統
        this.currentUser = null;
        this.showAllMessages = false;
        this.newMessageTimestamps = [];
        this.isAuthenticating = false; // 防重複登入提交
        this.currentEntryFlow = null; // 當前入口流程

        console.log('TRACE CONSTRUCTOR', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: this.programsByType,
            localPrograms: localStorage.getItem('climbingPrograms_owner')
        });

        this.initializeIdentity();
    }

    // 取得用戶ID - Firebase Backup 用戶分離
    getUserIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user');
        return userParam ? `demo_${userParam}` : 'demo_main';
    }

    // === 身份管理系統 ===

    // 初始化身份系統
    initializeIdentity() {
        // 檢查是否有 URL 參數 (朋友測試模式優先)
        const urlUser = this.getUserIdFromUrl();
        if (urlUser !== 'demo_main') {
            // 有 URL 參數，使用朋友測試模式
            this.userId = urlUser;
            this.currentUser = 'owner'; // 預設為 owner 模式
            this.initializeApp();
            return;
        }

        // 檢查本地身份
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser && IDENTITY_CONFIG[savedUser]) {
            // 已有身份，直接進入
            this.currentUser = savedUser;
            this.userId = this.getUserIdForFirebase();
            this.initializeApp();
        } else {
            // 首次使用或身份無效，顯示身份選擇
            this.migrateLegacyData();
            this.showIdentitySelector();
        }
    }

    // 初始化主應用
    initializeApp() {
        // 初始化雲端備份
        this.cloudBackup = new CloudBackup(this.userId);

        // 清理混合舊/新版 program cache
        this.cleanupMixedProgramCache();

        this.entries = [];
        this.trainingTemplates = this.initializeTemplates();
        this.program8Week = this.initialize8WeekProgram();
        this.programsByType = this.initializeProgramsByType();
        this.editingEntryTimestamp = null; // v0.2-E-1: 編輯模式狀態
        this.loadFromStorage();
        this.initializeEventListeners();
        this.renderEntries();
        this.setTodayDate();
        this.updateUserIndicator();

        // TODO: 考慮移除以下 debug logs (lines 145, 152)
        console.log('[BeforeInitializeMessageSystem]', {
            currentUser: this.currentUser,
            aboutToInitializeMessageSystem: true
        });

        this.initializeMessageSystem();

        console.log('[AfterInitializeMessageSystem]', {
            currentUser: this.currentUser,
            messageIconDisplay: document.getElementById('messageIcon')?.style.display
        });

        // v0.2-DB-3: 掛載資料品質檢查工具
        window.debugDataQuality = () => this.generateDataQualityReport();

        // v0.2-DB-5: 掛載安全資料修復工具 (添加方法存在檢查)
        if (typeof this.repairLocalDataQuality === 'function') {
            window.repairLocalDataQuality = () => this.repairLocalDataQuality();
        } else {
            console.warn('repairLocalDataQuality 方法未找到，稍後重新綁定...');
            // 延遲綁定以防時序問題
            setTimeout(() => {
                if (typeof this.repairLocalDataQuality === 'function') {
                    window.repairLocalDataQuality = () => this.repairLocalDataQuality();
                    console.log('✅ window.repairLocalDataQuality 已成功綁定');
                }
            }, 100);
        }

        // v0.2-CLOUD-5-1: Entry Cloud Write 測試函式
        window.testSyncFirstEntryToCloud = async () => this.testSyncFirstEntryToCloud();
        window.testConvertFirstEntryToCloudFormat = async () => this.testConvertFirstEntryToCloudFormat();

        // v0.2-CLOUD-6-1: Entry Cloud Read 測試函式
        window.testLoadCloudEntries = async () => this.testLoadCloudEntries();

        // v0.2-CLOUD-6-2A: Cloud Preview 測試函式
        window.showCloudPreview = async () => this.showCloudPreview();
    }

    // 取得 Firebase 用戶ID
    getUserIdForFirebase() {
        if (!this.currentUser) return 'demo_main';

        const config = IDENTITY_CONFIG[this.currentUser];
        return config.firebasePrefix || 'demo_main';
    }

    // 遷移舊資料到 owner
    migrateLegacyData() {
        const oldEntries = localStorage.getItem('climbingTrainingEntries');
        const oldPrograms = localStorage.getItem('climbingPrograms');

        console.log('TRACE MIGRATE_LEGACY_DATA', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: this.programsByType,
            localPrograms: localStorage.getItem('climbingPrograms_owner')
        });

        if (oldEntries || oldPrograms) {
            console.log('遷移舊資料到 owner 帳號...');

            if (oldEntries) {
                localStorage.setItem('climbingTrainingEntries_owner', oldEntries);
                localStorage.removeItem('climbingTrainingEntries');
            }

            // Program cache migration disabled after v1.1.1 to prevent overwriting updated programs
            if (oldPrograms) {
                console.log('發現舊 climbingPrograms，已停用自動遷移，避免覆蓋新版課表');
                localStorage.removeItem('climbingPrograms');
            }

            // 設定為 owner 用戶
            localStorage.setItem('currentUser', 'owner');

            console.log('資料遷移完成');
        }
    }

    // 清理混合舊/新版 Program Cache
    cleanupMixedProgramCache() {
        const oldProgramIndicators = [
            '攀岩技術',
            '攀岩整合',
            '死蟲式',
            '核心穩定',
            '張力傳導',
            '肩胛控制',
            'lock off'
        ];

        const userTypes = ['owner', 'tester'];

        userTypes.forEach(userType => {
            const key = `climbingPrograms_${userType}`;
            const stored = localStorage.getItem(key);

            if (!stored) return;

            try {
                const programs = JSON.parse(stored);
                let hasOldPrograms = false;

                // 檢查是否包含舊版 program names 或 items
                if (Array.isArray(programs)) {
                    // 新格式：array of program objects
                    hasOldPrograms = programs.some(program =>
                        oldProgramIndicators.some(indicator =>
                            program.name?.includes(indicator) ||
                            (program.items && program.items.some(item => item.includes(indicator)))
                        )
                    );
                } else if (typeof programs === 'object') {
                    // 舊格式：nested object by type
                    for (const [type, programList] of Object.entries(programs)) {
                        if (Array.isArray(programList)) {
                            hasOldPrograms = programList.some(program =>
                                oldProgramIndicators.some(indicator =>
                                    program.name?.includes(indicator) ||
                                    (program.items && program.items.some(item => item.includes(indicator)))
                                )
                            );
                            if (hasOldPrograms) break;
                        }
                    }
                }

                if (hasOldPrograms) {
                    console.log(`🧹 清理混合舊版 program cache: ${key}`);
                    localStorage.removeItem(key);
                }

            } catch (error) {
                console.error(`解析 ${key} 時發生錯誤，清理該 cache:`, error);
                localStorage.removeItem(key);
            }
        });
    }

    // 顯示身份選擇器
    showIdentitySelector() {
        document.body.classList.add('identity-active');
        const selector = document.getElementById('identitySelector');
        if (selector) {
            selector.style.display = 'flex';
            this.setupIdentityEvents();
        }
    }

    // 隱藏身份選擇器
    hideIdentitySelector() {
        document.body.classList.remove('identity-active');
        const selector = document.getElementById('identitySelector');
        if (selector) {
            selector.style.display = 'none';
        }
    }

    // 設定身份事件
    setupIdentityEvents() {
        // 身份卡片點擊
        document.querySelectorAll('.identity-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const identity = e.currentTarget.dataset.identity;
                this.handleIdentitySelection(identity);
            });
        });

        // 驗證對話框事件 (防重複綁定)
        const authSubmit = document.getElementById('authSubmit');
        const authCancel = document.getElementById('authCancel');
        const authPassword = document.getElementById('authPassword');

        if (authSubmit && !authSubmit.hasAttribute('data-bound')) {
            authSubmit.setAttribute('data-bound', 'true');
            authSubmit.addEventListener('click', () => this.handleAuthSubmit());
        }

        if (authCancel && !authCancel.hasAttribute('data-bound')) {
            authCancel.setAttribute('data-bound', 'true');
            authCancel.addEventListener('click', () => this.hideAuthDialog());
        }

        // Enter 鍵提交支援 (防重複綁定)
        if (authPassword && !authPassword.hasAttribute('data-bound-keydown')) {
            authPassword.setAttribute('data-bound-keydown', 'true');
            authPassword.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !this.isAuthenticating) {
                    this.handleAuthSubmit();
                }
            });
        }

        // 身份切換事件
        const switchBtn = document.getElementById('switchIdentity');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => this.switchIdentity());
        }
    }

    // 處理身份選擇
    handleIdentitySelection(identity) {
        if (identity === 'guest') {
            // 訪客模式直接進入
            this.setCurrentUser('guest');
            this.hideIdentitySelector();
            this.initializeApp();
            this.showToast('進入訪客模式 - 資料僅供體驗');
        } else {
            // 需要驗證
            this.showAuthDialog(identity);
        }
    }

    // 顯示驗證對話框
    showAuthDialog(identity) {
        const dialog = document.getElementById('authDialog');
        const title = document.getElementById('authTitle');
        const usernameInput = document.getElementById('authUsername');
        const passwordInput = document.getElementById('authPassword');

        if (dialog && title) {
            const config = IDENTITY_CONFIG[identity];
            const modeText = identity === 'owner' ? '開發者' : identity === 'tester' ? '測試員' : '訪客';
            title.textContent = `進入 ${modeText} 模式`;

            // 自動填入對應 email (方案 A)
            if (usernameInput && SUPABASE_EMAIL_MAP[identity]) {
                usernameInput.value = SUPABASE_EMAIL_MAP[identity];
            }

            // 清空密碼框
            if (passwordInput) passwordInput.value = '';

            dialog.style.display = 'flex';
            dialog.dataset.identity = identity;

            // 聚焦到密碼輸入框 (email 已自動填入且 readonly)
            if (passwordInput) passwordInput.focus();
        }
    }

    // 隱藏驗證對話框
    hideAuthDialog() {
        const dialog = document.getElementById('authDialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    // 處理驗證提交
    async handleAuthSubmit() {
        // 防重複提交
        if (this.isAuthenticating) {
            console.log('正在登入中，忽略重複提交');
            return;
        }

        const dialog = document.getElementById('authDialog');
        const identity = dialog.dataset.identity;
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value.trim();
        const submitBtn = document.getElementById('authSubmit');

        try {
            this.isAuthenticating = true;

            // 暫時禁用提交按鈕
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '登入中...';
            }

            // 使用 Supabase Auth 驗證 owner/tester
            const authResult = await this.authenticateWithSupabase(identity, password);

            if (authResult.success) {
                this.setCurrentUser(identity);
                this.hideAuthDialog();
                this.hideIdentitySelector();

                console.log('[BeforeInitializeApp]', {
                    currentUser: this.currentUser,
                    setCurrentUserCompleted: true,
                    aboutToCallInitializeApp: true
                });

                this.initializeApp();

                console.log('[AfterInitializeApp]', {
                    currentUser: this.currentUser,
                    initializeAppCompleted: true
                });

                const config = IDENTITY_CONFIG[identity];
                const modeText = identity === 'owner' ? '開發者' : identity === 'tester' ? '測試員' : '訪客';
                this.showToast(`歡迎回來，${modeText}！`);
            } else {
                this.showToast(authResult.message || '登入失敗，請重試');
                // 清空密碼框
                document.getElementById('authPassword').value = '';
            }

        } finally {
            // 恢復按鈕狀態
            this.isAuthenticating = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '進入';
            }
        }
    }

    // 驗證身份 (保留，guest 模式使用)
    validateIdentity(identity, username, password) {
        const config = IDENTITY_CONFIG[identity];
        if (!config || config.noAuth) return false;

        // guest 不使用此函式，owner/tester 現在使用 Supabase Auth
        return false;
    }

    // Supabase Auth 驗證 (owner/tester 使用)
    async authenticateWithSupabase(identity, password) {
        try {
            // guest 不走 Supabase Auth
            if (identity === 'guest') {
                throw new Error('Guest 模式不需要 Supabase Auth');
            }

            // 取得對應 email
            const email = SUPABASE_EMAIL_MAP[identity];
            if (!email) {
                throw new Error('未知身份: ' + identity);
            }

            // 步驟 1: Supabase Auth 登入
            const loginResult = await window.loginWithSupabase(email, password);
            if (!loginResult.success) {
                throw new Error(loginResult.message || '登入失敗');
            }

            // 步驟 2: 取得 Profile
            const profileResult = await window.getCurrentSupabaseProfile();
            if (!profileResult.success) {
                // 登入成功但無法取得 profile，清理 session
                await window.logoutSupabase();
                throw new Error('無法取得使用者資料');
            }

            // 步驟 3: 檢查 role 一致性
            if (profileResult.profile.role !== identity) {
                // role 不符，清理 session
                await window.logoutSupabase();
                throw new Error(`身份不符: 您是 ${profileResult.profile.role}，無法進入 ${identity} 模式`);
            }

            // 驗證成功
            return {
                success: true,
                profile: profileResult.profile
            };

        } catch (error) {
            console.error('Supabase Auth 驗證失敗:', error.message);
            return {
                success: false,
                message: error.message || '驗證失敗'
            };
        }
    }

    // === Entry Cloud Write Helpers (v0.2-CLOUD-5-1) ===

    // 轉換本地 entry 為 Supabase entries 格式
    convertEntryToSupabaseFormat(entry, userId) {
        return {
            user_id: userId,
            legacy_timestamp: entry.timestamp,
            date: entry.date,
            today_condition: entry.todayCondition,
            training_type: entry.trainingType,
            program_id: entry.programId,
            program_name_snapshot: entry.programName,
            program_category_snapshot: entry.programCategory,
            completion: entry.completion,
            item_states: entry.itemStates || {},
            missed_items: entry.missedItems || [],
            special_items: entry.specialItems || [],
            movement_notes: entry.movementNotes || ''
        };
    }

    // 同步單筆 entry 到 Supabase (不接正式流程)
    async syncEntryToCloud(entry) {
        try {
            // 檢查 guest 模式
            if (this.currentUser === 'guest') {
                return {
                    success: false,
                    reason: 'guest_mode'
                };
            }

            // 檢查 Supabase client
            if (!window.climbingSupabaseClient) {
                return {
                    success: false,
                    reason: 'no_client'
                };
            }

            // 取得 Supabase session
            const { data: { session }, error: sessionError } = await window.climbingSupabaseClient.auth.getSession();

            if (sessionError || !session) {
                return {
                    success: false,
                    reason: 'no_session'
                };
            }

            // 轉換格式
            const supabaseRow = this.convertEntryToSupabaseFormat(entry, session.user.id);

            // Insert 到 Supabase entries 表 (暫時使用 insert，未啟用 upsert)
            const { data, error } = await window.climbingSupabaseClient
                .from('entries')
                .insert(supabaseRow);

            if (error) {
                return {
                    success: false,
                    error: error
                };
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('syncEntryToCloud 發生錯誤:', error.message);
            return {
                success: false,
                error: error
            };
        }
    }

    // 背景靜默同步單筆 entry 到 Supabase (自動整合用)
    async syncEntryToCloudSilently(entry) {
        try {
            const result = await this.syncEntryToCloud(entry);
            if (result.success) {
                // 成功時靜默，不打擾用戶
                console.log('✅ Entry 已同步至雲端:', entry.timestamp);
            } else {
                // 失敗時低調提示，不阻斷流程
                this.showCloudSyncWarning();
            }
        } catch (error) {
            console.error('雲端同步發生錯誤:', error);
            this.showCloudSyncWarning();
        }
    }

    // 顯示雲端同步失敗的低壓警告
    showCloudSyncWarning() {
        // 延遲顯示，避免與主要成功訊息重疊
        setTimeout(() => {
            this.showToast('已儲存在本機，雲端同步暫時失敗');
        }, 100);
    }

    // 從 Supabase 讀取目前登入者可讀的 entries (測試用)
    async loadCloudEntries() {
        try {
            // 檢查 guest 模式
            if (this.currentUser === 'guest') {
                return {
                    success: false,
                    reason: 'guest_mode'
                };
            }

            // 檢查 Supabase client
            if (!window.climbingSupabaseClient) {
                return {
                    success: false,
                    reason: 'no_client'
                };
            }

            // 取得 Supabase session
            const { data: { session }, error: sessionError } = await window.climbingSupabaseClient.auth.getSession();

            if (sessionError || !session) {
                return {
                    success: false,
                    reason: 'no_session'
                };
            }

            // 從 Supabase entries 表讀取資料
            const { data: rows, error } = await window.climbingSupabaseClient
                .from('entries')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) {
                return {
                    success: false,
                    error: error
                };
            }

            return {
                success: true,
                rows: rows || []
            };

        } catch (error) {
            console.error('loadCloudEntries 發生錯誤:', error.message);
            return {
                success: false,
                error: error
            };
        }
    }

    // 轉換 Supabase entries row 為本地 entry object (測試用)
    convertSupabaseRowToEntry(row) {
        return {
            timestamp: row.legacy_timestamp,
            date: row.date,
            todayCondition: row.today_condition,
            trainingType: row.training_type,
            programId: row.program_id,
            programName: row.program_name_snapshot,
            programCategory: row.program_category_snapshot,
            completion: row.completion,
            itemStates: row.item_states || {},
            missedItems: row.missed_items || [],
            specialItems: row.special_items || [],
            movementNotes: row.movement_notes || ''
        };
    }

    // 測試從 Supabase 讀取 entries 並轉換格式 (手動測試用)
    async testLoadCloudEntries() {
        console.log('🔍 開始測試從 Supabase 讀取 entries...');

        try {
            // 呼叫 loadCloudEntries()
            const result = await this.loadCloudEntries();

            if (!result.success) {
                const failResult = {
                    success: false,
                    reason: result.reason || 'unknown',
                    currentUser: this.currentUser
                };
                console.log('❌ Cloud entries 讀取失敗:', failResult);
                return failResult;
            }

            const { rows } = result;

            // 轉換所有 rows 為本地格式
            const convertedEntries = rows.map(row => this.convertSupabaseRowToEntry(row));

            // 顯示結果統計
            console.log('✅ Cloud entries 讀取成功');
            console.log(`📊 Cloud rows 數量: ${rows.length}`);
            console.log(`📊 Converted entries 數量: ${convertedEntries.length}`);
            console.log(`👤 Current user: ${this.currentUser}`);

            // 顯示第一筆 sample（如果存在）
            if (convertedEntries.length > 0) {
                console.log('📋 第一筆 sample (converted):');
                console.log({
                    timestamp: convertedEntries[0].timestamp,
                    date: convertedEntries[0].date,
                    todayCondition: convertedEntries[0].todayCondition,
                    trainingType: convertedEntries[0].trainingType,
                    programName: convertedEntries[0].programName,
                    completion: convertedEntries[0].completion,
                    movementNotes: convertedEntries[0].movementNotes
                });
            }

            const successResult = {
                success: true,
                rows: rows,
                convertedEntries: convertedEntries,
                count: convertedEntries.length,
                currentUser: this.currentUser
            };

            console.log('🎯 完整結果:', successResult);
            return successResult;

        } catch (error) {
            console.error('❌ 測試過程發生錯誤:', error);
            const errorResult = {
                success: false,
                error: error.message,
                currentUser: this.currentUser
            };
            return errorResult;
        }
    }

    // v0.2-CLOUD-6-2A: 雲端紀錄預覽 (用戶友善版本)
    async showCloudPreview() {
        // 檢查 guest 模式
        if (this.currentUser === 'guest') {
            this.showToast('guest 不支援雲端預覽', 'error');
            return;
        }

        try {
            // 顯示載入提示
            this.showToast('正在讀取雲端紀錄...', 'info');

            // 複用現有 testLoadCloudEntries() 邏輯
            const result = await this.testLoadCloudEntries();

            if (result.success) {
                const { convertedEntries, count, currentUser } = result;

                // 顯示成功訊息
                let permissionInfo = '';
                if (currentUser === 'owner') {
                    permissionInfo = '（您可以看到開發者和測試員的記錄）';
                } else if (currentUser === 'tester') {
                    permissionInfo = '（您只能看到自己的記錄）';
                }

                this.showToast(`✅ 雲端紀錄讀取成功：${count} 筆 ${permissionInfo}`, 'success');

                // 使用 console.table 顯示資料 (開發者用)
                if (convertedEntries.length > 0) {
                    console.log('📖 雲端紀錄預覽:');
                    console.table(convertedEntries.map(entry => ({
                        日期: entry.date,
                        狀態: entry.todayCondition || '未設定',
                        類型: entry.trainingType || '未設定',
                        課表: entry.programName || '未設定',
                        筆記: entry.movementNotes?.substring(0, 30) + (entry.movementNotes?.length > 30 ? '...' : '') || '無'
                    })));
                } else {
                    console.log('📖 雲端紀錄預覽: 無資料');
                }

                // 新增: 顯示 UI 預覽 (owner 專用)
                if (this.currentUser === 'owner') {
                    this.renderCloudPreviewUI(convertedEntries, currentUser);
                }
            } else {
                // 處理失敗情況
                let errorMsg = '雲端紀錄讀取失敗';
                if (result.reason === 'guest_mode') {
                    errorMsg = 'guest 不支援雲端預覽';
                } else if (result.reason === 'no_client') {
                    errorMsg = '雲端服務未初始化';
                } else if (result.reason === 'no_session') {
                    errorMsg = '未登入雲端服務';
                }
                this.showToast(errorMsg, 'error');
            }

        } catch (error) {
            console.error('❌ 雲端預覽發生錯誤:', error);
            this.showToast('雲端預覽發生錯誤', 'error');
        }
    }

    // 渲染雲端預覽 UI (owner 專用)
    renderCloudPreviewUI(entries, userRole) {
        const section = document.getElementById('cloudPreviewSection');
        const info = document.getElementById('cloudPreviewInfo');
        const list = document.getElementById('cloudEntriesList');

        // 顯示預覽區塊
        section.style.display = 'block';

        // 更新資訊列
        const roleText = userRole === 'owner' ? '開發者' : '測試員';
        const permissionText = userRole === 'owner' ? '（包含開發者和測試員紀錄）' : '（僅自己紀錄）';
        info.innerHTML = `<p>📍 來源：Supabase | 👤 身份：${roleText} | 📅 最近10筆 ${permissionText}</p>`;

        // 取最近10筆並渲染
        const recentEntries = entries.slice(0, 10);
        if (recentEntries.length > 0) {
            list.innerHTML = recentEntries.map(entry => this.createCloudPreviewCard(entry)).join('');
        } else {
            list.innerHTML = '<div class="cloud-empty-state">☁️ 目前沒有雲端紀錄</div>';
        }

        // 滾動到預覽區塊
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 建立雲端預覽卡片
    createCloudPreviewCard(entry) {
        const date = this.formatDate(entry.date);
        const type = this.getEntryTypeDisplay(entry);
        const program = entry.programName || '自由訓練';
        const notes = this.truncateText(entry.movementNotes || '無筆記', 30);

        return `
            <div class="cloud-entry-card">
                <div class="cloud-entry-header">
                    <span class="cloud-entry-date">${date}</span>
                    <span class="cloud-entry-type">${type}</span>
                </div>
                <div class="cloud-entry-content">
                    <div class="cloud-entry-program">📋 ${program}</div>
                    <div class="cloud-entry-notes">${notes}</div>
                </div>
            </div>
        `;
    }

    // 隱藏雲端預覽
    hideCloudPreview() {
        const section = document.getElementById('cloudPreviewSection');
        section.style.display = 'none';
    }

    // 截斷文字工具函式
    truncateText(text, maxLength) {
        if (!text) return '無';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // 取得 Entry 類型顯示文字
    getEntryTypeDisplay(entry) {
        // 依據 entry 內容判斷類型
        if (entry.flow) {
            const flowTypes = {
                'challenge': 'Challenge',
                'easy': 'Easy',
                'life': 'Life'
            };
            return flowTypes[entry.flow] || entry.trainingType || '未分類';
        }

        // 舊 entry 透過 trainingType 判斷
        return entry.trainingType || '未分類';
    }

    // 測試同步第一筆 entry 到 Supabase (手動測試用)
    async testSyncFirstEntryToCloud() {
        console.log('🧪 開始測試同步第一筆 entry 到 Supabase...');

        try {
            // 檢查是否有本地資料
            if (!this.entries || this.entries.length === 0) {
                const result = {
                    success: false,
                    message: '目前沒有本地 entry 可測試'
                };
                console.log('❌ 測試結果:', result);
                return result;
            }

            const firstEntry = this.entries[0];
            console.log('📊 準備同步的 entry:', {
                timestamp: firstEntry.timestamp,
                date: firstEntry.date,
                todayCondition: firstEntry.todayCondition,
                trainingType: firstEntry.trainingType
            });

            // 呼叫同步函式
            const result = await this.syncEntryToCloud(firstEntry);

            console.log('🎯 同步結果:', result);
            return result;

        } catch (error) {
            console.error('❌ 測試過程發生錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 測試格式轉換 (不寫入資料庫)
    async testConvertFirstEntryToCloudFormat() {
        console.log('🔄 開始測試 entry 格式轉換...');

        try {
            // 檢查是否有本地資料
            if (!this.entries || this.entries.length === 0) {
                console.log('❌ 目前沒有本地 entry 可測試');
                return { success: false, message: '沒有資料' };
            }

            // 取得 Supabase session
            if (!window.climbingSupabaseClient) {
                console.log('❌ Supabase client 不存在');
                return { success: false, message: 'no_client' };
            }

            const { data: { session }, error } = await window.climbingSupabaseClient.auth.getSession();

            if (error || !session) {
                console.log('❌ 沒有 Supabase session');
                return { success: false, message: 'no_session' };
            }

            const firstEntry = this.entries[0];
            console.log('📊 原始 entry 格式:', firstEntry);

            // 轉換格式
            const convertedRow = this.convertEntryToSupabaseFormat(firstEntry, session.user.id);
            console.log('✅ 轉換後 Supabase row 格式:', convertedRow);

            return {
                success: true,
                original: firstEntry,
                converted: convertedRow
            };

        } catch (error) {
            console.error('❌ 格式轉換測試發生錯誤:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 設定當前用戶
    setCurrentUser(identity) {
        this.currentUser = identity;
        localStorage.setItem('currentUser', identity);
        this.userId = this.getUserIdForFirebase();

        console.log('TRACE SET_CURRENT_USER', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: this.programsByType,
            localPrograms: localStorage.getItem('climbingPrograms_owner')
        });

        // 更新雲端預覽按鈕可見性
        this.updateCloudPreviewButtonVisibility();
    }

    // 更新雲端預覽按鈕可見性 (僅 owner 顯示)
    updateCloudPreviewButtonVisibility() {
        const cloudPreviewBtn = document.getElementById('cloudPreviewBtn');
        if (cloudPreviewBtn) {
            if (this.currentUser === 'owner') {
                cloudPreviewBtn.style.display = 'inline-block';
            } else {
                cloudPreviewBtn.style.display = 'none';
                // 如果非 owner，自動隱藏預覽區
                this.hideCloudPreview();
            }
        }
    }

    // 設定入口流程
    setEntryFlow(flow) {
        this.currentEntryFlow = flow;
        if (flow === 'challenge') {
            this.showForm();
            // Challenge flow 隱藏 exhausted option
            this.updateTodayConditionOptions();
        } else if (flow === 'easy') {
            this.openEasyEntryFlow();
        } else if (flow === 'life') {
            this.openLifeEntryFlow();
        }
    }

    // 控制 todayCondition 選項顯示
    updateTodayConditionOptions() {
        const exhaustedOption = document.querySelector('#todayCondition option[value="exhausted"]');

        if (!exhaustedOption) return; // 如果找不到 exhausted option 就返回

        if (this.currentEntryFlow === 'challenge' && !this.editingEntryTimestamp) {
            // Challenge flow 新增模式：隱藏 exhausted option
            exhaustedOption.style.display = 'none';
        } else {
            // 其他情況（包含編輯模式）：顯示 exhausted option
            exhaustedOption.style.display = '';
        }
    }

    // 開啟 Life Flow - 好好過生活模式（獨立表單）
    openLifeEntryFlow() {
        // 設定入口流程
        this.currentEntryFlow = 'life';

        // 開啟獨立的 Life Form
        this.showLifeForm();
    }

    // 顯示 Life Form
    showLifeForm() {
        // 顯示 Life Form 覆蓋層
        document.getElementById('lifeEntryForm').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // 設定今天日期為預設值
        const lifeDateInput = document.getElementById('lifeDate');
        if (lifeDateInput) {
            lifeDateInput.value = new Date().toISOString().split('T')[0];
        }

        // 清除之前的輸入
        this.clearLifeFlowInputs();
    }

    // 開啟 Easy Flow - 慢慢來就好模式（獨立表單）
    openEasyEntryFlow() {
        // 設定入口流程
        this.currentEntryFlow = 'easy';

        // 開啟獨立的 Easy Form
        this.showEasyForm();
    }

    // 隱藏 Easy mode 不需要的表單區塊
    hideFormSectionsForEasyMode() {
        // 隱藏 todayCondition 選擇器
        const conditionGroup = document.querySelector('.form-group.journal-main:nth-of-type(1)');
        if (conditionGroup) {
            conditionGroup.style.display = 'none';
        }

        // 隱藏 trainingType
        const trainingTypeGroup = document.querySelector('.form-group.journal-main:nth-of-type(2)');
        if (trainingTypeGroup) {
            trainingTypeGroup.style.display = 'none';
        }

        // 隱藏 Program
        const programGroup = document.querySelector('.form-group.journal-main:nth-of-type(3)');
        if (programGroup) {
            programGroup.style.display = 'none';
        }

        // 隱藏 completion
        const completionGroup = document.querySelector('.form-group.journal-main:nth-of-type(4)');
        if (completionGroup) {
            completionGroup.style.display = 'none';
        }

        // 隱藏 Movement 狀態
        const movementStatusGroup = document.querySelector('.form-group.journal-main:nth-of-type(5)');
        if (movementStatusGroup) {
            movementStatusGroup.style.display = 'none';
        }

        // 隱藏原 movement 備註
        const movementNotesInput = document.getElementById('movementNotes');
        const movementNotesGroup = movementNotesInput ? movementNotesInput.closest('.form-group') : null;
        if (movementNotesGroup) {
            movementNotesGroup.style.display = 'none';
        }
    }

    // 預處理 Easy Flow 資料合併到 movementNotes
    // 注意：此函式僅用於舊版 Easy Flow（使用 #trainingForm），
    // 新版 Easy Flow 使用獨立表單，不需要此預處理
    preprocessEasyFlowData() {
        // 由於 Easy Flow 已改用獨立表單，此函式不再被使用
        // 但保留以防編輯舊 Easy entry 時需要相容性
        if (this.currentEntryFlow !== 'easy') {
            return;
        }

        // 檢查是否在 #trainingForm 環境中（編輯模式）
        const inTrainingForm = document.getElementById('easyModeSection')?.style.display === 'block';
        if (!inTrainingForm) {
            return; // 如果不在大表單中，不執行預處理
        }

        // 收集選中的 easy choice 選項
        const checkedChoices = [];
        const easyChoices = document.querySelectorAll('input[name="easyChoice"]:checked');
        easyChoices.forEach(checkbox => {
            checkedChoices.push(checkbox.value);
        });

        // 獲取一句話輸入
        const easyNoteInput = document.getElementById('easyNote');
        const noteText = easyNoteInput ? easyNoteInput.value.trim() : '';

        // 合併格式：選項文字｜一句話
        let mergedText = '';
        if (checkedChoices.length > 0) {
            mergedText = checkedChoices.join('、');
        }
        if (noteText) {
            if (mergedText) {
                mergedText += '｜' + noteText;
            } else {
                mergedText = noteText;
            }
        }

        // 設定到 movementNotes 欄位
        const movementNotesInput = document.getElementById('movementNotes');
        if (movementNotesInput) {
            movementNotesInput.value = mergedText;
        }
    }

    // 清除 Easy Flow 輸入欄位
    clearEasyFlowInputs() {
        // 清除所有 easyChoice 勾選
        const easyChoices = document.querySelectorAll('input[name="easyChoice"]');
        easyChoices.forEach(checkbox => {
            checkbox.checked = false;
        });

        // 清除 easyNote 文字輸入
        const easyNoteInput = document.getElementById('easyNote');
        if (easyNoteInput) {
            easyNoteInput.value = '';
        }

        // 重置日期為今天（適用於獨立 Easy Form）
        const easyDateInput = document.getElementById('easyDate');
        if (easyDateInput) {
            easyDateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    // 建立 Life Flow Entry 資料
    createLifeEntryData() {
        // 收集 Life Form 資料
        const lifeDate = document.getElementById('lifeDate').value;
        const selectedChoice = document.querySelector('input[name="lifeChoice"]:checked');
        const lifeNote = document.getElementById('lifeNote').value.trim();

        // 合併 Life Flow 資料格式：選項｜一句話
        let lifeMergedText = '';
        if (selectedChoice) {
            lifeMergedText = selectedChoice.value;
        }
        if (lifeNote) {
            if (lifeMergedText) {
                lifeMergedText += '｜' + lifeNote;
            } else {
                lifeMergedText = lifeNote;
            }
        }

        // 產生完整相容的 entry object
        return {
            timestamp: new Date().toISOString(),
            id: Date.now(),
            date: lifeDate,
            todayCondition: 'exhausted',
            trainingType: '功能訓練',
            programId: 'exhausted-reflection',
            programName: '非常疲憊簡化紀錄',
            programCategory: 'rest',
            completion: 'little',
            itemStates: {},
            missedItems: [],
            specialItems: [],
            movementNotes: lifeMergedText,
            // Legacy 欄位相容 - 與 getFormData() 一致
            week: '',
            mainTraining: '',
            coreState: '',
            legState: '',
            shoulderState: '',
            fatigue: '5',
            exercises: '',
            rpe: '7',
            quality: '7',
            transfer: '',
            nextDayFeeling: '',
            notes: ''
        };
    }

    // 建立 Easy Flow Entry 資料
    createEasyEntryData() {
        // 收集 Easy Form 資料
        const easyDate = document.getElementById('easyDate').value;
        const selectedChoices = document.querySelectorAll('input[name="easyChoice"]:checked');
        const easyNote = document.getElementById('easyNote').value.trim();

        // 合併格式：選項文字｜一句話
        let easyMergedText = '';
        if (selectedChoices.length > 0) {
            const choices = Array.from(selectedChoices).map(cb => cb.value);
            easyMergedText = choices.join('、');
        }
        if (easyNote) {
            if (easyMergedText) {
                easyMergedText += '｜' + easyNote;
            } else {
                easyMergedText = easyNote;
            }
        }

        // 產生完整相容的 entry object
        return {
            timestamp: new Date().toISOString(),
            id: Date.now(),
            date: easyDate,
            todayCondition: 'normal',
            trainingType: '攀岩',
            programId: 'easy-reflection',
            programName: '慢慢來簡化紀錄',
            programCategory: 'light',
            completion: 'little',
            itemStates: {},
            missedItems: [],
            specialItems: [],
            movementNotes: easyMergedText,
            // Legacy 欄位相容 - 與 getFormData() 一致
            week: '',
            mainTraining: '',
            coreState: '',
            legState: '',
            shoulderState: '',
            fatigue: '5',
            exercises: '',
            rpe: '7',
            quality: '7',
            transfer: '',
            nextDayFeeling: '',
            notes: ''
        };
    }

    // 切換身份
    switchIdentity() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        this.showIdentitySelector();
    }

    // 更新用戶指示器
    updateUserIndicator() {
        const display = document.getElementById('currentUserDisplay');
        if (display && this.currentUser) {
            const config = IDENTITY_CONFIG[this.currentUser];
            display.textContent = config.displayName || this.currentUser;
        }
    }

    // === 存儲輔助方法 ===

    // 取得存儲 key
    getStorageKey(baseKey) {
        if (!this.currentUser) return baseKey;

        if (this.currentUser === 'guest') {
            return `session_${baseKey}`;
        }

        return `${baseKey}_${this.currentUser}`;
    }

    // 取得存儲對象
    getStorage() {
        return this.currentUser === 'guest' ? sessionStorage : localStorage;
    }

    // 載入用戶資料
    loadFromStorage() {
        try {
            const key = this.getStorageKey('climbingTrainingEntries');
            const storage = this.getStorage();
            const stored = storage.getItem(key);
            this.entries = JSON.parse(stored || '[]');

            // v0.2-E-0: 檢查並補強缺失的 timestamp
            this.ensureTimestampSafety();
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            this.entries = [];
        }
    }

    // 確保每筆 entry 都有 timestamp，僅補強缺失項目
    ensureTimestampSafety() {
        let needsSave = false;

        this.entries.forEach((entry, index) => {
            if (!entry.timestamp) {
                // 為舊 entry 補上 legacy timestamp
                entry.timestamp = `legacy_${entry.date || 'unknown'}_${index}_${Date.now()}`;
                needsSave = true;
            }
        });

        // 如果有補強，需要儲存
        if (needsSave) {
            this.saveToStorage();
        }
    }

    // 載入 Programs
    loadPrograms() {
        try {
            const key = this.getStorageKey('climbingPrograms');
            const storage = this.getStorage();
            const stored = storage.getItem(key);
            const result = JSON.parse(stored || '[]');

            console.log('TRACE LOAD_PROGRAMS', {
                currentUser: this.currentUser,
                programs: this.programs,
                programsByType: this.programsByType,
                localPrograms: localStorage.getItem('climbingPrograms_owner'),
                loadedData: result
            });

            return result;
        } catch (error) {
            console.error('載入 Programs 時發生錯誤:', error);
            return [];
        }
    }

    // 執行雲端備份 - 非阻塞、容錯
    async performCloudBackup(entries, programs) {
        try {
            const result = await this.cloudBackup.backup(entries, programs);
            if (result.success) {
                this.showBackupStatus(result.message, 'success');
            } else {
                this.showBackupStatus(result.message, 'warning');
            }
        } catch (error) {
            this.showBackupStatus('備份失敗，本地已保存', 'warning');
        }
    }

    // 顯示備份狀態 - 輕量提示
    showBackupStatus(message, type = 'info') {
        const colors = {
            'success': '#10b981', // 綠色
            'warning': '#f59e0b', // 橙色
            'info': '#4a9eff'     // 藍色
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.85rem;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        `;

        toast.textContent = `☁️ ${message}`;
        document.body.appendChild(toast);

        // 自動移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

    // 初始化 8 週課表
    initialize8WeekProgram() {
        const program = [];
        const weeklySchedule = [
            { day: 1, title: "肩胛穩定 × 拉力日", template: "shoulder" },
            { day: 2, title: "攀岩技術日", template: "climbing_technique" },
            { day: 3, title: "核心傳導 × anti-rotation 日", template: "core" },
            { day: 4, title: "單腳穩定 × 採點日", template: "leg" },
            { day: 5, title: "攀岩體能日", template: "climbing_integration" },
            { day: 6, title: "恢復 / flow movement 日", template: "recovery" }
        ];

        for (let week = 1; week <= 8; week++) {
            weeklySchedule.forEach(dayData => {
                program.push({
                    week: week,
                    day: dayData.day,
                    title: dayData.title,
                    template: dayData.template
                });
            });
        }

        return program;
    }

    // 建立正規化的預設Programs（補缺邏輯：保留自訂，補回缺少的預設）
    initializeProgramsByType() {
        // 載入目前已存在的 Programs
        const savedPrograms = this.loadPrograms();

        // 固定的 5 個預設 Programs（基於既有8週課表 + 訓練模板）
        const defaultPrograms = [
            {
                id: "program_core",
                name: "核心",
                type: "功能訓練",
                category: "核心",
                items: ["RKC 平板撐", "下腹抬腿", "單邊農夫走路", "熊爬"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_shoulder",
                name: "肩胛穩定",
                type: "功能訓練",
                category: "肩胛穩定",
                items: ["單邊划船", "引體向上", "中下斜方", "後三角"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_leg",
                name: "單腳踩點",
                type: "功能訓練",
                category: "單腳踩點",
                items: ["單腳 RDL", "分腿蹲", "側向移動", "內收肌"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_climbing_tech",
                name: "技術",
                type: "攀岩",
                category: "攀岩",
                items: ["讀線", "重心轉移", "腳法", "新動作"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_climbing_integration",
                name: "體能",
                type: "攀岩",
                category: "攀岩",
                items: ["指力", "拉力", "張力", "耐力"],
                createdAt: new Date().toISOString()
            }
        ];

        // 找出缺少的預設Programs（用 name + type 判斷避免衝突）
        const missingDefaults = defaultPrograms.filter(defaultProg =>
            !savedPrograms.some(saved => saved.name === defaultProg.name && saved.type === defaultProg.type)
        );

        // 合併：保留所有自訂 + 補回缺少的預設
        const mergedPrograms = [...savedPrograms, ...missingDefaults];

        // 如果有補回預設Programs，儲存更新
        if (missingDefaults.length > 0) {
            this.savePrograms(mergedPrograms);
        }

        const result = this.convertProgramsToOldFormat(mergedPrograms);

        console.log('TRACE INITIALIZE_PROGRAMS_BY_TYPE', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: result,
            localPrograms: localStorage.getItem('climbingPrograms_owner'),
            mergedPrograms: mergedPrograms
        });

        // 返回舊格式以保持相容性
        return result;
    }

    // 舊版 loadPrograms 已移除 - 統一使用身份分離版本 (line 385-395)

    // 儲存 Programs 到 localStorage
    savePrograms(programs) {
        try {
            const key = this.getStorageKey('climbingPrograms');
            const storage = this.getStorage();

            storage.setItem(key, JSON.stringify(programs));

            // 異步備份到雲端 (guest 模式不備份)
            if (this.currentUser !== 'guest') {
                this.performCloudBackup(this.entries, programs);
            }
        } catch (error) {
            console.error('儲存 Programs 時發生錯誤:', error);
            alert('儲存 Programs 時發生錯誤，請檢查瀏覽器設定');
        }
    }

    // 轉換 programs 為舊格式 (保持相容性)
    convertProgramsToOldFormat(programs) {
        const result = {
            "功能訓練": [],
            "攀岩": []
        };

        programs.forEach(program => {
            if (result[program.type]) {
                // v0.2-P-4-4: 保留所有欄位，特別是 archived/archivedAt
                result[program.type].push({
                    name: program.name,
                    items: program.items,
                    id: program.id, // 保留 id 供查找使用（現在是字串格式）
                    category: program.category,
                    createdAt: program.createdAt,
                    archived: program.archived,
                    archivedAt: program.archivedAt
                });
            }
        });

        return result;
    }

    // 建立新 Program
    createProgram(programData) {
        const programs = this.loadPrograms();

        // 生成基於名稱的 ID（避免與固定 ID 衝突）
        const baseId = `program_custom_${programData.name.toLowerCase().replace(/\s+/g, '_')}`;
        let newId = baseId;
        let counter = 1;

        // 確保 ID 唯一
        while (programs.some(p => p.id === newId)) {
            newId = `${baseId}_${counter}`;
            counter++;
        }

        const newProgram = {
            id: newId,
            name: programData.name,
            type: programData.type,
            category: programData.category,
            items: programData.items,
            createdAt: new Date().toISOString()
        };

        programs.push(newProgram);
        this.savePrograms(programs);

        // 更新內存中的 programsByType
        this.programsByType = this.convertProgramsToOldFormat(programs);

        return newProgram;
    }

    // 根據 name 查找 Program
    findProgramByName(programName) {
        const programs = this.loadPrograms();
        return programs.find(p => p.name === programName);
    }

    // 檢查 Program 是否被 entry 使用
    isProgramInUse(programId) {
        return this.entries.some(entry => entry.programId === programId);
    }

    // 載入自訂 Programs
    loadCustomPrograms() {
        const allPrograms = this.loadPrograms();
        return allPrograms.filter(program => program.id && program.id.startsWith('program_custom_'));
    }

    // v0.2-P-4-3: 封存已使用的 Program
    archiveProgram(programId) {
        try {
            const programs = this.loadPrograms();
            const program = programs.find(p => p.id === programId);

            if (!program) {
                alert('找不到指定的 Program');
                return false;
            }

            // 設定封存狀態
            program.archived = true;
            program.archivedAt = new Date().toISOString();

            // 儲存更新
            this.savePrograms(programs);

            // 更新相關 UI
            this.programsByType = this.initializeProgramsByType();
            this.updateCustomProgramsList();

            // 更新目前的 Program 選項 (如果有選中的訓練類型)
            const selectedTrainingType = document.querySelector('input[name="trainingType"]:checked')?.value;
            if (selectedTrainingType) {
                this.updateProgramOptions(selectedTrainingType);
            }

            this.showToast('Program 已封存，未來新增紀錄時不再顯示');
            return true;

        } catch (error) {
            console.error('封存 Program 失敗:', error);
            alert('封存 Program 時發生錯誤，請重試');
            return false;
        }
    }

    // 刪除自訂 Program
    deleteProgram(programId) {
        // 檢查 1: 是否為自訂 Program
        if (!programId || !programId.startsWith('program_custom_')) {
            alert('只能刪除自訂 Program，不能刪除預設 Program');
            return false;
        }

        // 檢查 2: 已使用 Program 分流處理
        if (this.isProgramInUse(programId)) {
            // v0.2-P-4-3: 已使用 Program 改為封存策略
            const programs = this.loadPrograms();
            const programToArchive = programs.find(p => p.id === programId);

            if (!programToArchive) {
                alert('找不到指定的 Program');
                return false;
            }

            const confirmed = confirm(
                `這個 Program 「${programToArchive.name}」已被過去紀錄使用。為了保留歷史資料，不會直接刪除。\n\n要將它封存嗎？\n\n封存後不會出現在新紀錄選單，但過去紀錄仍會保留。`
            );

            if (!confirmed) {
                return false;
            }

            // 執行封存
            return this.archiveProgram(programId);
        }

        // 找到要刪除的 Program 名稱
        const programs = this.loadPrograms();
        const programToDelete = programs.find(p => p.id === programId);
        if (!programToDelete) {
            alert('找不到指定的 Program');
            return false;
        }

        // 檢查 3: 使用者確認
        if (!confirm(`確定要刪除 Program "${programToDelete.name}" 嗎？\n\n此操作無法復原。`)) {
            return false;
        }

        try {
            // 執行刪除
            const updatedPrograms = programs.filter(p => p.id !== programId);
            this.savePrograms(updatedPrograms);

            // 更新內存中的 programsByType
            this.programsByType = this.convertProgramsToOldFormat(updatedPrograms);

            this.showToast(`Program "${programToDelete.name}" 已刪除`);
            return true;
        } catch (error) {
            console.error('刪除 Program 失敗:', error);
            alert('刪除時發生錯誤，請重試');
            return false;
        }
    }

    // 初始化訓練模板
    initializeTemplates() {
        return {
            shoulder: {
                name: '🔴 肩胛穩定 × 拉力日',
                description: '單手穩定、lock off、肩胛控制、拉力容量',
                exercises: [
                    {
                        name: '單邊輔助引體',
                        sets: '4',
                        reps: '單邊 4-6',
                        suggestedRPE: '7',
                        note: '不聳肩，控制離心，身體不要旋轉'
                    },
                    {
                        name: '單邊划船',
                        sets: '4',
                        reps: '8-10',
                        suggestedRPE: '7',
                        note: '肩胛先收，不要甩'
                    },
                    {
                        name: '雙手引體',
                        sets: '3',
                        reps: '6-8',
                        suggestedRPE: '7',
                        note: '保留 2 下餘力'
                    },
                    {
                        name: '中下斜方划船',
                        sets: '3',
                        reps: '12-15',
                        suggestedRPE: '6',
                        note: '輕中重量，找肩胛下壓與後收'
                    },
                    {
                        name: '後三角訓練',
                        sets: '3',
                        reps: '15',
                        suggestedRPE: '6',
                        note: '不要代償，動作乾淨'
                    }
                ]
            },
            core: {
                name: '🔵 核心傳導 × anti-rotation 日',
                description: '張力、身體連接、高腳傳導、核心不散掉',
                exercises: [
                    {
                        name: 'PRK / 進階平板',
                        sets: '3-4',
                        reps: '30-45秒',
                        suggestedRPE: '6',
                        note: '不塌腰，呼吸穩'
                    },
                    {
                        name: '壓腳躺姿模擬攀岩',
                        sets: '3',
                        reps: '單邊 8-10',
                        suggestedRPE: '6',
                        note: '核心不要散，找壓腳感'
                    },
                    {
                        name: '熊爬',
                        sets: '4趟',
                        reps: '10-15公尺',
                        suggestedRPE: '6',
                        note: '超慢，骨盆不要晃'
                    },
                    {
                        name: '單邊農夫走路',
                        sets: '3趟',
                        reps: '20-30公尺',
                        suggestedRPE: '7',
                        note: '身體不要歪，抗旋轉'
                    },
                    {
                        name: '側平板',
                        sets: '3',
                        reps: '30-45秒',
                        suggestedRPE: '6',
                        note: '側腰穩，肩膀不要塌'
                    },
                    {
                        name: '懸吊抬腿',
                        sets: '3',
                        reps: '8-12',
                        suggestedRPE: '7',
                        note: '不要甩，控制收腿'
                    },
                    {
                        name: '腹橫肌訓練',
                        sets: '3',
                        reps: '20-30秒',
                        suggestedRPE: '5',
                        note: '呼吸控制，收尾重置'
                    }
                ]
            },
            leg: {
                name: '🟢 單腳踩點 × 採點日',
                description: '高腳、壓腳、單腳穩定、骨盆控制、movement 穩定',
                exercises: [
                    {
                        name: '單邊 RDL',
                        sets: '4',
                        reps: '單邊 8',
                        suggestedRPE: '7',
                        note: '骨盆穩，不追重量'
                    },
                    {
                        name: '高度墊站上',
                        sets: '3',
                        reps: '單邊 8',
                        suggestedRPE: '6',
                        note: '模擬高腳，慢慢站穩'
                    },
                    {
                        name: '弓箭步肩推',
                        sets: '3',
                        reps: '單邊 8',
                        suggestedRPE: '6',
                        note: '找腳到手的傳導感'
                    },
                    {
                        name: '後撤步肩推',
                        sets: '3',
                        reps: '單邊 8',
                        suggestedRPE: '6',
                        note: '控制重心轉移'
                    },
                    {
                        name: '斜後撤步肩推',
                        sets: '3',
                        reps: '單邊 8',
                        suggestedRPE: '6',
                        note: '旋轉 movement，骨盆穩'
                    },
                    {
                        name: '橫向移動',
                        sets: '3趟',
                        reps: '8-10步',
                        suggestedRPE: '5',
                        note: '控制重心，不要急'
                    },
                    {
                        name: '內收肌訓練',
                        sets: '3',
                        reps: '12-15',
                        suggestedRPE: '6',
                        note: '開腳穩定，控制內側線'
                    },
                    {
                        name: '橫向跳躍單腳停頓',
                        sets: '3',
                        reps: '單邊 5-6',
                        suggestedRPE: '7',
                        note: '落地停 2 秒，穩定優先'
                    },
                    {
                        name: '火箭筒螺旋跳躍停頓',
                        sets: '3',
                        reps: '單邊 5',
                        suggestedRPE: '7',
                        note: '旋轉後停穩，不求快'
                    },
                    {
                        name: '轉身單腳跳躍＋啞鈴',
                        sets: '3',
                        reps: '單邊 5',
                        suggestedRPE: '7',
                        note: '空間感與落地控制'
                    }
                ]
            },
            climbing_technique: {
                name: '🧗 攀岩技術日',
                description: 'Silent Feet、高腳練習、路線閱讀、movement 技術',
                exercises: [
                    {
                        name: 'Silent Feet',
                        sets: '3–4 趟',
                        reps: '30–45 分鐘',
                        suggestedRPE: '4',
                        note: '專注腳步聲音控制，慢速移動'
                    },
                    {
                        name: '高腳練習',
                        sets: '3 組',
                        reps: '15 分鐘',
                        suggestedRPE: '5',
                        note: '各種高腳姿勢，重心轉移練習'
                    },
                    {
                        name: '路線閱讀',
                        sets: '5 條',
                        reps: '觀察+嘗試',
                        suggestedRPE: '5',
                        note: '先觀察路線，規劃 movement 再爬'
                    },
                    {
                        name: '放鬆攀爬',
                        sets: '持續',
                        reps: '20 分鐘',
                        suggestedRPE: '4',
                        note: 'flow 感優先，不追難度'
                    }
                ]
            },
            climbing_integration: {
                name: '🧗 攀岩體能日',
                description: '整合訓練成果，主線嘗試，movement 練習',
                exercises: [
                    {
                        name: '熱身路線',
                        sets: '4 條',
                        reps: '輕鬆完成',
                        suggestedRPE: '4',
                        note: '身體喚醒，movement 準備'
                    },
                    {
                        name: '主線嘗試',
                        sets: '3 條',
                        reps: '每條 3–5 次',
                        suggestedRPE: '7',
                        note: '挑戰路線，整合所有訓練要素'
                    },
                    {
                        name: 'Overhang movement',
                        sets: '持續',
                        reps: '20 分鐘',
                        suggestedRPE: '6',
                        note: '仰角練習，核心與手腳協調'
                    },
                    {
                        name: '收操輕爬',
                        sets: '持續',
                        reps: '15 分鐘',
                        suggestedRPE: '3',
                        note: '放鬆身體，整理今日感受'
                    }
                ]
            },
            recovery: {
                name: '🌙 恢復 / flow movement 日',
                description: '身體恢復、輕度活動、呼吸放鬆',
                exercises: [
                    {
                        name: '輕鬆走路',
                        sets: '持續',
                        reps: '20–30 分鐘',
                        suggestedRPE: '3',
                        note: '戶外散步或輕快走路，呼吸自然'
                    },
                    {
                        name: '90/90 rotation',
                        sets: '3',
                        reps: '每邊 8–10',
                        suggestedRPE: '3',
                        note: '髖關節活動，慢慢轉動'
                    },
                    {
                        name: '輕熊爬',
                        sets: '2 趟',
                        reps: '10 公尺',
                        suggestedRPE: '4',
                        note: '超慢速度，感受身體連接'
                    },
                    {
                        name: '呼吸放鬆',
                        sets: '1 組',
                        reps: '5 分鐘',
                        suggestedRPE: '2',
                        note: '深呼吸，身心放鬆，整理一週'
                    }
                ]
            }
        };
    }


    // 儲存資料到 localStorage
    saveToStorage() {
        try {
            const key = this.getStorageKey('climbingTrainingEntries');
            const storage = this.getStorage();

            storage.setItem(key, JSON.stringify(this.entries));

            // 異步備份到雲端 (guest 模式不備份)
            if (this.currentUser !== 'guest') {
                const programs = this.loadPrograms();
                this.performCloudBackup(this.entries, programs);
            }
        } catch (error) {
            console.error('儲存資料時發生錯誤:', error);
            alert('儲存資料時發生錯誤，請檢查瀏覽器設定');
        }
    }

    // 初始化事件監聽器
    initializeEventListeners() {
        console.log('TRACE INITIALIZE_EVENT_LISTENERS', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: this.programsByType,
            localPrograms: localStorage.getItem('climbingPrograms_owner')
        });

        // 新增紀錄按鈕
        document.getElementById('newEntry').addEventListener('click', () => {
            this.showForm();
        });

        // 首頁三入口按鈕
        document.getElementById('challengeFlowBtn').addEventListener('click', () => {
            this.setEntryFlow('challenge');
        });

        document.getElementById('easyFlowBtn').addEventListener('click', () => {
            this.setEntryFlow('easy');
        });

        document.getElementById('lifeFlowBtn').addEventListener('click', () => {
            this.setEntryFlow('life');
        });

        // 匯出 CSV 按鈕
        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportToCSV();
        });

        // 匯出 JSON 按鈕
        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportToJSON();
        });

        // 匯出完整備份按鈕
        document.getElementById('exportBackup').addEventListener('click', () => {
            this.exportBackup();
        });

        // 預覽雲端紀錄按鈕 (僅 owner 顯示)
        const cloudPreviewBtn = document.getElementById('cloudPreviewBtn');
        if (cloudPreviewBtn) {
            // 只有 owner 才顯示按鈕
            if (this.currentUser === 'owner') {
                cloudPreviewBtn.style.display = 'inline-block';
                if (!cloudPreviewBtn.hasAttribute('data-bound')) {
                    cloudPreviewBtn.setAttribute('data-bound', 'true');
                    cloudPreviewBtn.addEventListener('click', () => {
                        this.showCloudPreview();
                    });
                }
            } else {
                cloudPreviewBtn.style.display = 'none';
            }
        }

        // 關閉雲端預覽按鈕
        const closeCloudPreviewBtn = document.getElementById('closeCloudPreview');
        if (closeCloudPreviewBtn && !closeCloudPreviewBtn.hasAttribute('data-bound')) {
            closeCloudPreviewBtn.setAttribute('data-bound', 'true');
            closeCloudPreviewBtn.addEventListener('click', () => {
                this.hideCloudPreview();
            });
        }

        // 清除所有資料按鈕
        const clearAllBtn = document.getElementById('clearAll');
        if (clearAllBtn && !clearAllBtn.hasAttribute('data-bound')) {
            clearAllBtn.setAttribute('data-bound', 'true');
            clearAllBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        // 表單提交
        const trainingForm = document.getElementById('trainingForm');
        if (trainingForm && !trainingForm.dataset.bound) {
            trainingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.preprocessEasyFlowData();
                this.handleFormSubmit();
            });
            trainingForm.dataset.bound = 'true';
        }

        // 取消表單
        document.getElementById('cancelForm').addEventListener('click', () => {
            this.hideForm();
        });

        // 點擊覆蓋層關閉表單
        document.getElementById('entryForm').addEventListener('click', (e) => {
            if (e.target.id === 'entryForm') {
                this.hideForm();
            }
        });

        // Life Form 提交事件
        const lifeForm = document.getElementById('lifeForm');
        if (lifeForm && !lifeForm.dataset.bound) {
            lifeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLifeFormSubmit();
            });
            lifeForm.dataset.bound = 'true';
        }

        // 取消 Life Form
        const cancelLifeForm = document.getElementById('cancelLifeForm');
        if (cancelLifeForm) {
            cancelLifeForm.addEventListener('click', () => {
                this.hideLifeForm();
            });
        }

        // 點擊 Life Form 覆蓋層關閉表單
        document.getElementById('lifeEntryForm').addEventListener('click', (e) => {
            if (e.target.id === 'lifeEntryForm') {
                this.hideLifeForm();
            }
        });

        // Easy Form 提交事件
        const easyForm = document.getElementById('easyForm');
        if (easyForm && !easyForm.dataset.bound) {
            easyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEasyFormSubmit();
            });
            easyForm.dataset.bound = 'true';
        }

        // 取消 Easy Form
        const cancelEasyForm = document.getElementById('cancelEasyForm');
        if (cancelEasyForm) {
            cancelEasyForm.addEventListener('click', () => {
                this.hideEasyForm();
            });
        }

        // 點擊 Easy Form 覆蓋層關閉表單
        document.getElementById('easyEntryForm').addEventListener('click', (e) => {
            if (e.target.id === 'easyEntryForm') {
                this.hideEasyForm();
            }
        });

        // 滑桿值即時更新
        this.setupSliders();

        // v0.2-REST-1-1: todayCondition 變化監聽
        const todayConditionSelect = document.getElementById('todayCondition');
        if (todayConditionSelect && !todayConditionSelect.hasAttribute('data-exhausted-bound')) {
            todayConditionSelect.setAttribute('data-exhausted-bound', 'true');
            todayConditionSelect.addEventListener('change', (e) => {
                this.toggleExhaustedMode(e.target.value);
            });
        }

        // 訓練模板相關事件
        this.setupTemplateEvents();

        // 8 週課表相關事件
        this.setup8WeekScheduleEvents();

        // 收合功能
        this.setupCollapsibleEvents();

        // 簡化Daily Journal事件
        this.setupSimplifiedJournalEvents();

        // Program Builder事件
        this.setupProgramBuilderEvents();

        // 身份管理事件
        this.setupIdentityEvents();

        // 留言系統事件
        this.setupMessageEvents();
    }

    // 設定滑桿即時顯示值
    setupSliders() {
        const sliders = ['fatigue']; // 只保留疲勞滑桿，RPE和quality已改為select
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            const valueSpan = document.getElementById(sliderId + 'Value');

            if (slider && valueSpan) {
                slider.addEventListener('input', () => {
                    valueSpan.textContent = slider.value;
                });
            }
        });
    }

    // 設定模板相關事件
    setupTemplateEvents() {
        const templateSelect = document.getElementById('trainingTemplate');
        const loadTemplateBtn = document.getElementById('loadTemplate');

        // 模板選擇變化
        templateSelect.addEventListener('change', () => {
            const selectedTemplate = templateSelect.value;
            if (selectedTemplate) {
                loadTemplateBtn.style.display = 'inline-block';
                loadTemplateBtn.textContent = `載入 ${this.trainingTemplates[selectedTemplate].name}`;
            } else {
                loadTemplateBtn.style.display = 'none';
                this.hideTemplateDetails();
            }
        });

        // 載入模板按鈕
        loadTemplateBtn.addEventListener('click', () => {
            const selectedTemplate = templateSelect.value;
            if (selectedTemplate) {
                this.loadTemplate(selectedTemplate);
            }
        });
    }

    // 載入訓練模板
    loadTemplate(templateKey) {
        const template = this.trainingTemplates[templateKey];
        if (!template) return;

        // 更新主訓練選項
        document.getElementById('mainTraining').value = template.name.split(' ')[1]; // 去掉 emoji

        // 顯示模板詳細內容
        this.showTemplateDetails(template);

        // 生成訓練項目文字
        const exerciseText = template.exercises.map(ex =>
            `${ex.name} ${ex.sets}組 ${ex.reps} (RPE:${ex.suggestedRPE})`
        ).join('\n');

        document.getElementById('exercises').value = exerciseText;

        this.showToast(`已載入 ${template.name} 模板`);
    }

    // 顯示模板詳細內容
    showTemplateDetails(template) {
        const templateDetails = document.getElementById('templateDetails');
        const exercisesContainer = templateDetails.querySelector('.template-exercises');

        exercisesContainer.innerHTML = `
            <div style="margin-bottom: 1rem; padding: 0.8rem; background: rgba(74, 158, 255, 0.1); border-radius: 8px; border-left: 3px solid #4a9eff;">
                <h4 style="color: #4a9eff; margin-bottom: 0.5rem;">${template.name}</h4>
                <p style="color: #a0a0a0; font-size: 0.9rem; margin: 0;">${template.description}</p>
            </div>
            ${template.exercises.map((exercise, index) => this.createExerciseTemplate(exercise, index)).join('')}
        `;

        templateDetails.style.display = 'block';

        // 設定模板內輸入框的事件
        this.setupTemplateInputEvents();
    }

    // 隱藏模板詳細內容
    hideTemplateDetails() {
        document.getElementById('templateDetails').style.display = 'none';
    }

    // 創建單一訓練項目模板
    createExerciseTemplate(exercise, index) {
        return `
            <div class="template-exercise">
                <div class="exercise-header">
                    <span class="exercise-name">${index + 1}. ${exercise.name}</span>
                </div>
                <div class="exercise-specs">
                    建議：${exercise.sets} 組 × ${exercise.reps} (RPE: ${exercise.suggestedRPE})
                </div>
                <div class="exercise-note">
                    💡 ${exercise.note}
                </div>
                <div class="exercise-inputs">
                    <div class="input-group">
                        <label>實際重量</label>
                        <input type="text" placeholder="例如：20kg" data-exercise="${index}" data-field="weight">
                    </div>
                    <div class="input-group">
                        <label>實際 RPE</label>
                        <select data-exercise="${index}" data-field="actualRPE">
                            <option value="">選擇</option>
                            ${[1,2,3,4,5,6,7,8,9,10].map(num =>
                                `<option value="${num}" ${num == exercise.suggestedRPE ? 'selected' : ''}>${num}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="input-group">
                        <label>完成品質</label>
                        <select data-exercise="${index}" data-field="quality">
                            <option value="">選擇</option>
                            ${[1,2,3,4,5,6,7,8,9,10].map(num =>
                                `<option value="${num}" ${num == 8 ? 'selected' : ''}>${num}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="input-group">
                        <label>備註</label>
                        <input type="text" placeholder="感受或調整" data-exercise="${index}" data-field="note">
                    </div>
                </div>
            </div>
        `;
    }

    // 設定模板輸入框事件
    setupTemplateInputEvents() {
        const inputs = document.querySelectorAll('.template-exercise input, .template-exercise select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateExerciseText();
            });
        });
    }

    // 更新訓練項目文字
    updateExerciseText() {
        const templateSelect = document.getElementById('trainingTemplate');
        const selectedTemplate = templateSelect.value;
        if (!selectedTemplate) return;

        const template = this.trainingTemplates[selectedTemplate];
        const exerciseInputs = document.querySelectorAll('.template-exercise');

        let updatedText = '';
        exerciseInputs.forEach((exerciseDiv, index) => {
            const exercise = template.exercises[index];
            const weight = exerciseDiv.querySelector('[data-field="weight"]').value;
            const actualRPE = exerciseDiv.querySelector('[data-field="actualRPE"]').value;
            const quality = exerciseDiv.querySelector('[data-field="quality"]').value;
            const note = exerciseDiv.querySelector('[data-field="note"]').value;

            let line = `${exercise.name} ${exercise.sets}組 ${exercise.reps}`;
            if (weight) line += ` ${weight}`;
            if (actualRPE) line += ` (RPE:${actualRPE})`;
            if (quality) line += ` [品質:${quality}]`;
            if (note) line += ` - ${note}`;

            updatedText += line + '\n';
        });

        document.getElementById('exercises').value = updatedText.trim();
    }

    // 設定 8 週課表事件
    setup8WeekScheduleEvents() {
        const weekSelect = document.getElementById('scheduleWeek');
        const daySelect = document.getElementById('scheduleDay');
        const applyScheduleBtn = document.getElementById('applySchedule');
        const conditionSelect = document.getElementById('todayCondition');

        // Week 選擇變化
        weekSelect.addEventListener('change', () => {
            this.updateScheduleDisplay();
        });

        // Day 選擇變化
        daySelect.addEventListener('change', () => {
            this.updateScheduleDisplay();
        });

        // 今日狀態變化
        if (!conditionSelect.hasAttribute('data-bound')) {
            conditionSelect.setAttribute('data-bound', 'true');
            conditionSelect.addEventListener('change', () => {
                this.updateScheduleDisplay();
            });
        }

        // 套用課表按鈕
        applyScheduleBtn.addEventListener('click', () => {
            this.applyScheduleToForm();
        });
    }

    // 設定收合功能事件
    setupCollapsibleEvents() {
        const headers = document.querySelectorAll('.collapsible-header');

        headers.forEach(header => {
            if (header.dataset.bound === 'true') return;

            header.addEventListener('click', () => {
                const section = header.closest('.form-section') || header.closest('.data-management-section');
                const content = section ? section.querySelector('.collapsible-content') : null;
                const toggleHint = header.querySelector('.toggle-hint');

                if (!content) return;

                const isHidden = content.style.display === 'none' || content.style.display === '';
                content.style.display = isHidden ? 'block' : 'none';

                if (toggleHint) {
                    toggleHint.textContent = isHidden ? '(點擊收起)' : '(點擊展開)';
                }

                if (section) {
                    section.classList.toggle('collapsed', !isHidden);
                    section.style.opacity = isHidden ? '1' : '0.7';
                }
            });

            header.dataset.bound = 'true';
        });
    }

    // 設定簡化Daily Journal事件
    setupSimplifiedJournalEvents() {
        // 訓練類型變化監聽
        const trainingTypeRadios = document.querySelectorAll('input[name="trainingType"]');
        trainingTypeRadios.forEach(radio => {
            if (!radio.hasAttribute('data-bound')) {
                radio.setAttribute('data-bound', 'true');
                radio.addEventListener('change', (e) => {
                    this.updateProgramOptions(e.target.value);
                    this.clearItemStatusList();
                });
            }
        });

        // Program選擇變化監聽
        const programSelect = document.getElementById('programSelect');
        if (programSelect && !programSelect.hasAttribute('data-bound')) {
            programSelect.setAttribute('data-bound', 'true');
            programSelect.addEventListener('change', (e) => {
                const trainingType = document.querySelector('input[name="trainingType"]:checked')?.value;
                if (trainingType && e.target.value) {
                    this.generateItemStatusList(e.target.value, trainingType);
                }
            });
        }
    }

    // 設定 Program Builder 事件
    setupProgramBuilderEvents() {
        // Program Builder 表單提交
        const programBuilderForm = document.getElementById('programBuilderForm');
        if (programBuilderForm && !programBuilderForm.dataset.bound) {
            programBuilderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProgramBuilderSubmit();
            });
            programBuilderForm.dataset.bound = 'true';
        }

        // category 選擇變化
        const categorySelect = document.getElementById('programCategory');
        const typeRadios = document.querySelectorAll('input[name="programType"]');

        if (categorySelect && typeRadios) {
            typeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.updateCategoryOptions(e.target.value);
                });
            });
        }

        // 刪除 Program 事件
        const deleteCustomProgramBtn = document.getElementById('deleteCustomProgramBtn');
        if (deleteCustomProgramBtn && !deleteCustomProgramBtn.hasAttribute('data-bound')) {
            deleteCustomProgramBtn.setAttribute('data-bound', 'true');
            deleteCustomProgramBtn.addEventListener('click', () => {
                this.handleDeleteProgram();
            });
        }

        // 更新可刪除 Program 列表
        this.updateCustomProgramsList();
    }

    // 處理 Program Builder 表單提交
    handleProgramBuilderSubmit() {
        const formData = this.getProgramBuilderFormData();

        if (!this.validateProgramData(formData)) {
            return;
        }

        try {
            const newProgram = this.createProgram(formData);
            this.showToast(`Program "${newProgram.name}" 已建立成功！`);

            // 重置表單
            document.getElementById('programBuilderForm').reset();
            this.clearProgramItemInputs();

            // 刷新 Daily Journal 的 Program 選項
            const selectedTrainingType = document.querySelector('input[name="trainingType"]:checked')?.value;
            if (selectedTrainingType) {
                this.updateProgramOptions(selectedTrainingType);
            }

            // 刷新刪除 Program 清單
            this.updateCustomProgramsList();

        } catch (error) {
            console.error('建立 Program 失敗:', error);
            alert('建立 Program 時發生錯誤，請重試');
        }
    }

    // 取得 Program Builder 表單資料
    getProgramBuilderFormData() {
        const programName = document.getElementById('programName').value.trim();
        const programType = document.querySelector('input[name="programType"]:checked')?.value;
        const programCategory = document.getElementById('programCategory').value;

        // 收集 movement items
        const items = [];
        for (let i = 1; i <= 5; i++) {
            const itemInput = document.getElementById(`programItem${i}`);
            if (itemInput && itemInput.value.trim()) {
                items.push(itemInput.value.trim());
            }
        }

        return {
            name: programName,
            type: programType,
            category: programCategory,
            items: items
        };
    }

    // 驗證 Program 資料
    validateProgramData(data) {
        if (!data.name) {
            alert('請輸入 Program 名稱');
            return false;
        }

        if (!data.type) {
            alert('請選擇 Program 類型');
            return false;
        }

        if (!data.category) {
            alert('請選擇 Category');
            return false;
        }

        if (data.items.length === 0) {
            alert('請至少輸入一個 movement item');
            return false;
        }

        if (data.items.length > 5) {
            alert('movement items 不能超過 5 個');
            return false;
        }

        // 檢查是否已有同名 Program
        const existingProgram = this.findProgramByName(data.name);
        if (existingProgram) {
            alert(`Program "${data.name}" 已存在，請使用不同的名稱`);
            return false;
        }

        return true;
    }

    // 更新 Category 選項
    updateCategoryOptions(programType) {
        const categorySelect = document.getElementById('programCategory');
        if (!categorySelect) return;

        const categoryOptions = {
            "功能訓練": [
                { value: "核心", text: "核心" },
                { value: "肩胛穩定", text: "肩胛穩定" },
                { value: "單腳踩點", text: "單腳踩點" }
            ],
            "攀岩": [
                { value: "攀岩", text: "攀岩" }
            ]
        };

        categorySelect.innerHTML = '<option value="">請選擇 Category</option>';

        if (categoryOptions[programType]) {
            categoryOptions[programType].forEach(option => {
                categorySelect.innerHTML += `<option value="${option.value}">${option.text}</option>`;
            });
        }
    }

    // 清空 Program item 輸入框
    clearProgramItemInputs() {
        for (let i = 1; i <= 5; i++) {
            const itemInput = document.getElementById(`programItem${i}`);
            if (itemInput) {
                itemInput.value = '';
            }
        }
    }

    // 處理刪除 Program
    handleDeleteProgram() {
        const deleteProgramSelect = document.getElementById('deleteCustomProgramSelect');
        if (!deleteProgramSelect) return;

        // 多重取值方式確保穩健性
        const selectedOption = deleteProgramSelect.selectedOptions[0];
        const selectedIndex = deleteProgramSelect.selectedIndex;
        const selectedValue = selectedOption ? selectedOption.value : '';
        const selectedText = selectedOption ? selectedOption.textContent.trim() : '';
        const selectedProgramName = selectedOption ? selectedOption.dataset.programName : '';

        // 情境 A：真的沒有選 Program（選到 placeholder）
        const isPlaceholder =
            !selectedOption ||
            selectedIndex <= 0 ||
            selectedText.includes('選擇要刪除');

        if (isPlaceholder) {
            alert('請先選擇要刪除的 Program。');
            return;
        }

        // 取得 option 的詳細資訊
        const programName = selectedOption.dataset.programName;
        const programType = selectedOption.dataset.programType;
        const programId = selectedOption.dataset.programId;
        const optionText = selectedOption.textContent.trim();

        // 根據多種方式查找 program（支援 fallback）
        const customPrograms = this.loadCustomPrograms();
        let targetProgram = null;

        // 方法 1：用 program.id 查找
        if (programId) {
            targetProgram = customPrograms.find(p => p.id === programId);
        }

        // 方法 2：用 selectedValue 查找（id 或 name__type）
        if (!targetProgram && selectedValue) {
            targetProgram = customPrograms.find(p => p.id === selectedValue) ||
                           customPrograms.find(p => `${p.name}__${p.type}` === selectedValue);
        }

        // 方法 3：用 data-program-name 查找
        if (!targetProgram && selectedProgramName) {
            targetProgram = customPrograms.find(p => p.name === selectedProgramName);
        }

        // 方法 4：用 option 文字內容查找（去除 "已使用" 標記）
        if (!targetProgram && selectedText) {
            const cleanSelectedText = selectedText.replace(' (已使用)', '').trim();
            targetProgram = customPrograms.find(p => p.name === cleanSelectedText);
        }

        if (!targetProgram) {
            alert('找不到要刪除的 Program，請重新選擇。');
            return;
        }

        // 情境 B：選到已封存的 Program
        if (targetProgram.archived === true) {
            alert(`這個 Program 已經封存，無法再次操作。`);
            return;
        }

        // 情境 C：選到未使用的自訂 Program (可真刪除)
        if (!confirm(`確定要刪除「${targetProgram.name}」嗎？\n\n刪除後，這個 Program 會從清單中消失。\n已經建立的 Daily Journal 紀錄不會被刪除。`)) {
            return; // 使用者按取消，不刪除
        }

        // 使用者按確定，執行刪除流程
        const success = this.deleteProgram(targetProgram.id);
        if (success) {
            // 刪除成功，重新載入自訂 Programs 清單
            this.updateCustomProgramsList();

            // 刷新 Daily Journal 的 Program 選項
            const selectedTrainingType = document.querySelector('input[name="trainingType"]:checked')?.value;
            if (selectedTrainingType) {
                this.updateProgramOptions(selectedTrainingType);
            }
        }
    }

    // 更新自訂 Programs 刪除清單
    updateCustomProgramsList() {
        const deleteProgramSelect = document.getElementById('deleteCustomProgramSelect');
        if (!deleteProgramSelect) return;

        const customPrograms = this.loadCustomPrograms();

        deleteProgramSelect.innerHTML = '<option value="">選擇要刪除的自訂 Program</option>';

        if (customPrograms.length === 0) {
            deleteProgramSelect.innerHTML += '<option value="" disabled>尚無自訂 Program</option>';
        } else {
            customPrograms.forEach(program => {
                const isInUse = this.isProgramInUse(program.id);
                const isArchived = program.archived === true;

                // v0.2-P-4-3: 封存狀態顯示邏輯
                let optionText, disabled;
                if (isArchived) {
                    optionText = `${program.name} (已封存)`;
                    disabled = 'disabled';
                } else if (isInUse) {
                    optionText = `${program.name} (可封存)`;
                    disabled = '';
                } else {
                    optionText = program.name;
                    disabled = '';
                }

                // 確保每個 option 都有可用 value（優先使用 id，fallback 使用 name__type）
                const optionValue = program.id || `${program.name}__${program.type}`;

                deleteProgramSelect.innerHTML += `<option value="${optionValue}"
                    data-program-name="${program.name}"
                    data-program-type="${program.type}"
                    data-program-id="${program.id || ''}"
                    ${disabled}>${optionText}</option>`;
            });
        }
    }

    // 更新Program選項
    updateProgramOptions(trainingType, options = {}) {
        const programSelect = document.getElementById('programSelect');
        if (!programSelect || !this.programsByType[trainingType]) return;

        const { includeArchived = false } = options;
        let programs = this.programsByType[trainingType];

        console.log('TRACE UPDATE_PROGRAM_OPTIONS', {
            currentUser: this.currentUser,
            programs: this.programs,
            programsByType: this.programsByType,
            localPrograms: localStorage.getItem('climbingPrograms_owner'),
            trainingType: trainingType,
            programsForType: programs
        });

        // v0.2-P-4-2: 相容層過濾 archived Program (預備未來封存功能)
        if (!includeArchived) {
            programs = programs.filter(program =>
                // 如果沒有 archived 欄位，視為 active (向下相容)
                program.archived !== true
            );
        }

        programSelect.innerHTML = '<option value="">請選擇課表</option>' +
            programs.map(program =>
                `<option value="${program.name}">${program.name}</option>`
            ).join('');
    }

    // 清空item狀態列表
    clearItemStatusList() {
        const itemStatusList = document.getElementById('itemStatusList');
        if (itemStatusList) itemStatusList.innerHTML = '';
    }

    // 生成Program item狀態選擇
    generateItemStatusList(programName, trainingType, options = {}) {
        const { includeArchived = false } = options;
        let programs = this.programsByType[trainingType];
        if (!programs) {
            console.warn(`找不到訓練類型 '${trainingType}' 的 Programs`);
            this.clearItemStatusList();
            return;
        }

        // v0.2-P-4-2: 相容層過濾 archived Program (預備未來封存功能)
        if (!includeArchived) {
            programs = programs.filter(program =>
                // 如果沒有 archived 欄位，視為 active (向下相容)
                program.archived !== true
            );
        }

        const program = programs.find(p => p.name === programName);
        if (!program) {
            console.warn(`找不到 Program '${programName}' (includeArchived: ${includeArchived})`);
            this.clearItemStatusList();
            return;
        }

        // 生成每個item的狀態選擇 (簡化為三個狀態)
        const itemsHTML = program.items.map(item => `
            <div class="item-status-row">
                <span class="item-name">${item}</span>
                <div class="status-options">
                    <label class="status-option">
                        <input type="radio" name="item-${item}" value="normal" checked>
                        <span class="status-text">○ 一般</span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="item-${item}" value="weak">
                        <span class="status-text">😕 不太順</span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="item-${item}" value="strong">
                        <span class="status-text">✨ 很順</span>
                    </label>
                </div>
            </div>
        `).join('');

        document.getElementById('itemStatusList').innerHTML = itemsHTML;
    }

    // 根據今日狀態過濾課表內容
    filterExercisesByCondition(exercises) {
        const condition = document.getElementById('todayCondition')?.value || 'normal';

        switch(condition) {
            case 'good':
                return exercises; // 顯示全部
            case 'normal':
                return exercises.slice(0, Math.ceil(exercises.length * 0.7)); // 70%
            case 'tired':
                return exercises.slice(0, Math.ceil(exercises.length * 0.4)); // 40%
            case 'exhausted':
                return [
                    { name: '輕鬆散步', sets: '1', reps: '20分鐘' },
                    { name: '深呼吸放鬆', sets: '3', reps: '2分鐘' },
                    { name: '溫和伸展', sets: '1', reps: '10分鐘' }
                ]; // 休息日
            default:
                return exercises;
        }
    }

    // 獲取狀態提示文字
    getConditionNote(condition) {
        switch(condition) {
            case 'good':
                return '';
            case 'normal':
                return '<p style="color: #ffc107; font-size: 0.8rem; margin-top: 0.5rem;">⚡ 根據今日狀態，顯示適度訓練內容</p>';
            case 'tired':
                return '<p style="color: #ff9800; font-size: 0.8rem; margin-top: 0.5rem;">🔻 維持訓練模式：降低強度，保持動作品質</p>';
            case 'exhausted':
                return '<p style="color: #f44336; font-size: 0.8rem; margin-top: 0.5rem;">😴 休息日模式：以恢復為主，明天再戰</p>';
            default:
                return '';
        }
    }

    // 獲取狀態顯示文字（用於卡片）
    getConditionDisplayText(condition) {
        switch(condition) {
            case 'good':
                return '💪 狀態好';
            case 'normal':
                return '😐 普通';
            case 'tired':
                return '😮‍💨 狀態差';
            case 'exhausted':
                return '😴 非常疲憊';
            default:
                return condition || '未設定';
        }
    }

    // 取得記錄後陪伴句
    getJournalCompanionMessage(condition, recordCount) {
        const countText = `第${recordCount}次紀錄`;

        switch(condition) {
            case 'good':
                return `${countText} • 今天的穩定感，被好好記下來了。`;
            case 'normal':
                return `${countText} • 普通的日子，也會慢慢累積成節奏。`;
            case 'tired':
                return `${countText} • 有點累也沒關係，身體的訊號有被留下來。`;
            case 'exhausted':
                return `${countText} • 今天能記下來就已經很好，不需要再多逼自己。`;
            default:
                return `${countText} • 今天的狀態，被好好記錄下來了。`;
        }
    }

    // 取得卡片內系統回聲文案
    getEntrySystemEcho(condition) {
        switch (condition) {
            case 'good':
                return '今天的穩定感，被好好記下來了。';
            case 'normal':
                return '普通的日子，也會慢慢累積成節奏。';
            case 'tired':
                return '有點累也沒關係，身體的訊號有被留下來。';
            case 'exhausted':
                return '今天能記下來就已經很好，不需要再多逼自己。';
            default:
                return '今天的狀態，被好好記錄下來了。';
        }
    }

    // 獲取完成度顯示文字（用於卡片）
    getCompletionDisplayText(completion) {
        switch(completion) {
            case 'all':
                return '✅ 全部完成';
            case 'most':
                return '🟢 大部分';
            case 'half':
                return '🟡 一半';
            case 'little':
                return '🔴 很少';
            default:
                return completion || '未設定';
        }
    }

    // 渲染item狀態區塊（只顯示非一般狀態）
    renderItemStatesSection(entry) {
        let html = '';

        // 優先使用新的itemStates
        if (entry.itemStates) {
            const grouped = {
                strong: [],
                weak: [],
                // 保持向後相容
                special: [],
                stuck: [],
                missed: []
            };

            Object.entries(entry.itemStates).forEach(([item, status]) => {
                if (status !== 'normal' && grouped[status]) {
                    grouped[status].push(item);
                }
            });

            if (grouped.strong.length > 0) {
                html += `<div class="entry-section">
                    <h4>✨ 很順</h4>
                    <p>${grouped.strong.join(', ')}</p>
                </div>`;
            }

            if (grouped.weak.length > 0) {
                html += `<div class="entry-section">
                    <h4>😕 不太順</h4>
                    <p>${grouped.weak.join(', ')}</p>
                </div>`;
            }

            // 向後相容舊資料
            if (grouped.special.length > 0) {
                html += `<div class="entry-section">
                    <h4>✨ 有感</h4>
                    <p>${grouped.special.join(', ')}</p>
                </div>`;
            }

            if (grouped.stuck.length > 0) {
                html += `<div class="entry-section">
                    <h4>🔄 卡住</h4>
                    <p>${grouped.stuck.join(', ')}</p>
                </div>`;
            }

            if (grouped.missed.length > 0) {
                html += `<div class="entry-section">
                    <h4>❌ 遺漏</h4>
                    <p>${grouped.missed.join(', ')}</p>
                </div>`;
            }
        } else {
            // 向後相容：顯示舊格式
            if (entry.specialItems && entry.specialItems.length > 0) {
                html += `<div class="entry-section">
                    <h4>✨ 今天特別有感</h4>
                    <p>${entry.specialItems.join(', ')}</p>
                </div>`;
            }

            if (entry.missedItems && entry.missedItems.length > 0) {
                html += `<div class="entry-section">
                    <h4>⚠️ 遺漏項目</h4>
                    <p>${entry.missedItems.join(', ')}</p>
                </div>`;
            }
        }

        return html;
    }

    // 更新課表顯示
    updateScheduleDisplay() {
        const week = parseInt(document.getElementById('scheduleWeek').value);
        const day = parseInt(document.getElementById('scheduleDay').value);

        if (week && day) {
            const scheduleData = this.program8Week.find(item =>
                item.week === week && item.day === day
            );

            if (scheduleData) {
                const scheduleInfo = document.getElementById('scheduleInfo');
                const template = this.trainingTemplates[scheduleData.template];
                const condition = document.getElementById('todayCondition')?.value || 'normal';
                const filteredExercises = this.filterExercisesByCondition(template.exercises);

                scheduleInfo.innerHTML = `
                    <div style="padding: 1rem; background: rgba(74, 158, 255, 0.1); border-radius: 8px; border-left: 3px solid #4a9eff;">
                        <h4 style="color: #4a9eff; margin-bottom: 0.5rem;">Week ${week} Day ${day}</h4>
                        <p style="color: #fff; font-weight: 600; margin-bottom: 0.5rem;">${scheduleData.title}</p>
                        <p style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 1rem;">${template.description}</p>

                        <div style="color: #c0c0c0; font-size: 0.9rem;">
                            <strong>今日訓練項目：</strong><br>
                            ${filteredExercises.map(ex => `• ${ex.name} ${ex.sets}組 ${ex.reps}`).join('<br>')}
                        </div>
                        ${this.getConditionNote(condition)}
                    </div>
                `;

                document.getElementById('applySchedule').style.display = 'inline-block';
                scheduleInfo.style.display = 'block';
            }
        } else {
            document.getElementById('scheduleInfo').style.display = 'none';
            document.getElementById('applySchedule').style.display = 'none';
        }
    }

    // 套用課表到表單
    applyScheduleToForm() {
        const week = parseInt(document.getElementById('scheduleWeek').value);
        const day = parseInt(document.getElementById('scheduleDay').value);

        if (week && day) {
            const scheduleData = this.program8Week.find(item =>
                item.week === week && item.day === day
            );

            if (scheduleData) {
                // 更新 Week 選項
                document.getElementById('week').value = `W${week}`;

                // 更新主訓練
                document.getElementById('mainTraining').value = scheduleData.title;

                // 載入對應模板
                this.loadTemplate(scheduleData.template);

                this.showToast(`已套用 Week ${week} Day ${day} 課表`);
            }
        }
    }

    // 設定今日日期為預設值
    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    // 顯示表單
    showForm() {
        document.getElementById('entryForm').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // 重置表單 - 必須先 reset 再讀取值
        document.getElementById('trainingForm').reset();
        this.setTodayDate();

        // v0.2-REST-1-1: 重置後讀取 todayCondition 並設置 UI
        const todayCondition = document.getElementById('todayCondition').value;
        this.toggleExhaustedMode(todayCondition);

        // 重置滑桿顯示值
        document.getElementById('fatigueValue').textContent = '5';
        // RPE和quality現在是select，不需要重置顯示值

        // 重置模板相關
        document.getElementById('trainingTemplate').value = '';
        document.getElementById('loadTemplate').style.display = 'none';
        this.hideTemplateDetails();

        // 重置課表選擇
        document.getElementById('scheduleWeek').value = '';
        document.getElementById('scheduleDay').value = '';
        document.getElementById('scheduleInfo').style.display = 'none';
        document.getElementById('applySchedule').style.display = 'none';
    }

    // 隱藏表單
    hideForm() {
        // v0.2-E-1: 清除編輯模式，防止取消編輯後誤覆蓋舊紀錄
        this.editingEntryTimestamp = null;

        // 重置入口流程狀態
        this.currentEntryFlow = null;

        // 恢復所有可能被隱藏的表單區塊
        this.restoreFormSections();

        // 隱藏 Easy mode 和 Exhausted mode 區塊
        const easySection = document.getElementById('easyModeSection');
        if (easySection) {
            easySection.style.display = 'none';
            // 清除 Easy Flow 輸入欄位
            this.clearEasyFlowInputs();
        }

        const exhaustedSection = document.getElementById('exhaustedModeSection');
        if (exhaustedSection) {
            exhaustedSection.style.display = 'none';
        }

        document.getElementById('entryForm').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 隱藏 Life Form
    hideLifeForm() {
        // 清除 Life Flow 輸入欄位
        this.clearLifeFlowInputs();

        // 隱藏 Life Form
        document.getElementById('lifeEntryForm').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 清除 Life Flow 輸入欄位
    clearLifeFlowInputs() {
        // 清除 life choice 勾選
        const lifeChoices = document.querySelectorAll('input[name="lifeChoice"]');
        lifeChoices.forEach(radio => {
            radio.checked = false;
        });

        // 清除 life note 文字輸入
        const lifeNoteInput = document.getElementById('lifeNote');
        if (lifeNoteInput) {
            lifeNoteInput.value = '';
        }

        // 重置日期為今天
        const lifeDateInput = document.getElementById('lifeDate');
        if (lifeDateInput) {
            lifeDateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    // 顯示 Easy Form
    showEasyForm() {
        // 顯示 Easy Form 覆蓋層
        document.getElementById('easyEntryForm').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // 設定今天日期為預設值
        const easyDateInput = document.getElementById('easyDate');
        if (easyDateInput) {
            easyDateInput.value = new Date().toISOString().split('T')[0];
        }

        // 清除之前的輸入
        this.clearEasyFlowInputs();
    }

    // 隱藏 Easy Form
    hideEasyForm() {
        // 清除 Easy Flow 輸入欄位
        this.clearEasyFlowInputs();

        // 隱藏 Easy Form
        document.getElementById('easyEntryForm').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 恢復所有表單區塊顯示
    restoreFormSections() {
        // 恢復 todayCondition 選擇器
        const conditionGroup = document.querySelector('.form-group.journal-main:nth-of-type(1)');
        if (conditionGroup) {
            conditionGroup.style.display = '';
        }

        // 恢復 trainingType
        const trainingTypeGroup = document.querySelector('.form-group.journal-main:nth-of-type(2)');
        if (trainingTypeGroup) {
            trainingTypeGroup.style.display = '';
        }

        // 恢復 Program
        const programGroup = document.querySelector('.form-group.journal-main:nth-of-type(3)');
        if (programGroup) {
            programGroup.style.display = '';
        }

        // 恢復 completion
        const completionGroup = document.querySelector('.form-group.journal-main:nth-of-type(4)');
        if (completionGroup) {
            completionGroup.style.display = '';
        }

        // 恢復 Movement 狀態
        const movementStatusGroup = document.querySelector('.form-group.journal-main:nth-of-type(5)');
        if (movementStatusGroup) {
            movementStatusGroup.style.display = '';
        }

        // 恢復原 movement 備註
        const movementNotesInput = document.getElementById('movementNotes');
        const movementNotesGroup = movementNotesInput ? movementNotesInput.closest('.form-group') : null;
        if (movementNotesGroup) {
            movementNotesGroup.style.display = '';
        }
    }

    // v0.2-REST-1-1: 疲憊模式 UI 切換
    toggleExhaustedMode(condition) {
        const exhaustedSection = document.getElementById('exhaustedModeSection');

        // 精確選擇需要隱藏的訓練相關元素 - 除了 todayCondition (第1個) 和 exhaustedModeSection
        const trainingTypeGroup = document.querySelector('.form-group.journal-main:nth-of-type(2)'); // 今日訓練類型
        const programGroup = document.querySelector('.form-group.journal-main:nth-of-type(3)'); // 今天的課表
        const completionGroup = document.querySelector('.form-group.journal-main:nth-of-type(4)'); // 完成度
        const movementStatusGroup = document.querySelector('.form-group.journal-main:nth-of-type(5)'); // Movement 狀態

        // 使用更可靠的方法選擇 movementNotes 區塊 - 通過 ID 找到父級
        const movementNotesInput = document.getElementById('movementNotes');
        const movementNotesGroup = movementNotesInput ? movementNotesInput.closest('.form-group') : null;

        // 選擇自訂課表區塊 - 通過文字內容查找
        const programBuilderHeaders = Array.from(document.querySelectorAll('h3'));
        const programBuilderHeader = programBuilderHeaders.find(h3 => h3.textContent.includes('自訂課表'));
        const programBuilderSection = programBuilderHeader ? programBuilderHeader.closest('.form-section') : null;

        // 選擇 Legacy「今日體感」區塊 - 精準文字查找
        const legacyBodyStateHeader = Array.from(document.querySelectorAll('.form-section h3'))
            .find(h3 => h3.textContent.includes('今日體感'));
        const legacyBodyStateSection = legacyBodyStateHeader ? legacyBodyStateHeader.closest('.form-section') : null;

        if (condition === 'exhausted') {
            // 顯示疲憊模式
            if (exhaustedSection) {
                exhaustedSection.style.display = 'block';
            }

            // 隱藏訓練相關表單元素
            [trainingTypeGroup, programGroup, completionGroup, movementStatusGroup, movementNotesGroup].forEach((element) => {
                if (element) {
                    element.classList.add('exhausted-hide');
                }
            });

            // 隱藏自訂課表
            if (programBuilderSection) {
                programBuilderSection.classList.add('exhausted-hide');
            }

            // 隱藏 Legacy「今日體感」區塊
            if (legacyBodyStateSection) {
                legacyBodyStateSection.classList.add('exhausted-hide');
            }

        } else {
            // 隱藏疲憊模式
            if (exhaustedSection) {
                exhaustedSection.style.display = 'none';
            }

            // 顯示訓練相關表單元素
            [trainingTypeGroup, programGroup, completionGroup, movementStatusGroup, movementNotesGroup].forEach((element) => {
                if (element) {
                    element.classList.remove('exhausted-hide');
                }
            });

            // 顯示自訂課表
            if (programBuilderSection) {
                programBuilderSection.classList.remove('exhausted-hide');
            }

            // 移除 Legacy「今日體感」區塊的隱藏（但不強制顯示，保持原本 display:none 狀態）
            if (legacyBodyStateSection) {
                legacyBodyStateSection.classList.remove('exhausted-hide');
            }
        }
    }

    // 檢查 entry 是否有實際內容（只有真正用戶輸入或 movement 資料才算 meaningful）
    hasMeaningfulEntryData(entry) {
        if (!entry) return false;

        // 判斷狀態值是否為有意義的（非預設值）
        const isMeaningfulState = (value) => {
            if (value === undefined || value === null) return false;
            const normalized = String(value).trim().toLowerCase();
            if (!normalized) return false;

            const emptyLikeValues = [
                'normal',
                '一般',
                '普通',
                '正常',
                '一般狀態',
                'good',
                'ok',
                'fine',
                '好',
                '良好',
                'default',
                'none',
                '未填',
                '請選擇',
                '選擇',
                '0',
                '1',
                '5',
                '7'
            ];

            return !emptyLikeValues.includes(normalized);
        };

        const hasTextData =
            !!(entry.movementNotes && entry.movementNotes.trim()) ||
            !!(entry.notes && entry.notes.trim()) ||
            !!(entry.mainTraining && entry.mainTraining.trim()) ||
            !!(entry.nextDayFeeling && entry.nextDayFeeling.trim());

        // 收集 meaningful 的 itemStates
        const meaningfulItemStates = {};
        if (entry.itemStates) {
            Object.entries(entry.itemStates).forEach(([key, value]) => {
                if (isMeaningfulState(value)) {
                    meaningfulItemStates[key] = value;
                }
            });
        }

        const hasItemStates =
            entry.itemStates &&
            Object.values(entry.itemStates).some(state =>
                isMeaningfulState(state)
            );

        // 收集 meaningful 的 legacy body data
        const meaningfulLegacyBodyData = {};
        if (isMeaningfulState(entry.coreState)) meaningfulLegacyBodyData.coreState = entry.coreState;
        if (isMeaningfulState(entry.legState)) meaningfulLegacyBodyData.legState = entry.legState;
        if (isMeaningfulState(entry.shoulderState)) meaningfulLegacyBodyData.shoulderState = entry.shoulderState;

        const hasLegacyBodyData =
            isMeaningfulState(entry.coreState) ||
            isMeaningfulState(entry.legState) ||
            isMeaningfulState(entry.shoulderState);

        const hasExerciseData =
            Array.isArray(entry.exercises) && entry.exercises.length > 0;

        const result = hasTextData || hasItemStates || hasLegacyBodyData || hasExerciseData;

        return result;
    }

    // 處理表單提交
    handleFormSubmit() {
        const formData = this.getFormData();

        // 檢查是否為編輯模式
        if (this.editingEntryTimestamp) {
            // 編輯模式：替換現有 entry
            const editIndex = this.entries.findIndex(entry => entry.timestamp === this.editingEntryTimestamp);
            if (editIndex !== -1) {
                // 保留原 timestamp
                formData.timestamp = this.editingEntryTimestamp;
                // 替換 entry
                this.entries[editIndex] = formData;

                // 清除編輯模式
                this.editingEntryTimestamp = null;

                // 建立 savedEntry 用於雲端同步
                const savedEntry = formData;

                this.saveToStorage();
                this.renderEntries();
                this.hideForm();
                this.showToast('紀錄已更新！');

                // 本機儲存成功後，背景同步雲端
                if (this.currentUser !== 'guest') {
                    this.syncEntryToCloudSilently(savedEntry);
                }
            } else {
                alert('找不到要編輯的紀錄，請重新整理頁面。');
                return;
            }
        } else {
            // 新增模式：v0.2-D 允許同日期多筆紀錄

            // 檢查是否為第一次紀錄（在 push 前判斷）
            const wasFirstEntry = this.entries.length === 0;

            // v0.2-ECHO-4B: 生成 Echo 回應
            const echoResponse = this.generateEchoResponse(formData);

            // 將 Echo 回應附加到 entry
            // TODO: Echo 儲存策略未來可評估改為 render-time dynamic generation
            formData.echoResponse = echoResponse;

            this.entries.push(formData);

            // 按時間戳排序 (最新的在前面)
            this.entries.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

            // 建立 savedEntry 用於雲端同步
            const savedEntry = formData;

            this.saveToStorage();
            this.renderEntries();
            this.hideForm();

            // 顯示成功訊息
            this.showToast('紀錄已儲存！');

            // 本機儲存成功後，背景同步雲端
            if (this.currentUser !== 'guest') {
                this.syncEntryToCloudSilently(savedEntry);
            }
        }

        // 顯示陪伴訊息
        this.showJournalCompanionMessage(formData.todayCondition, this.entries.length);

        // 檢查是否需要顯示 onboarding
        setTimeout(() => {
            this.checkFirstTimeOnboarding(wasFirstEntry);
        }, 500);
    }

    // Life Form 提交處理
    handleLifeFormSubmit() {
        const lifeEntryData = this.createLifeEntryData();

        // 檢查是否為第一次紀錄（在 push 前判斷）
        const wasFirstEntry = this.entries.length === 0;

        // v0.2-ECHO-4B: 生成 Echo 回應
        // TODO: Echo 儲存策略未來可評估改為 render-time dynamic generation
        const echoResponse = this.generateEchoResponse(lifeEntryData);
        lifeEntryData.echoResponse = echoResponse;

        // Life Form 只處理新增模式（不用於編輯）
        this.entries.push(lifeEntryData);

        // 按時間戳排序 (最新的在前面)
        this.entries.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

        // 建立 savedEntry 用於雲端同步
        const savedEntry = lifeEntryData;

        this.saveToStorage();
        this.renderEntries();
        this.hideLifeForm();

        // 顯示成功訊息
        this.showToast('生活紀錄已儲存！');

        // 本機儲存成功後，背景同步雲端
        if (this.currentUser !== 'guest') {
            this.syncEntryToCloudSilently(savedEntry);
        }

        // 顯示陪伴訊息
        this.showJournalCompanionMessage(lifeEntryData.todayCondition, this.entries.length);

        // 檢查是否需要顯示 onboarding
        setTimeout(() => {
            this.checkFirstTimeOnboarding(wasFirstEntry);
        }, 500);
    }

    // Easy Form 提交處理
    handleEasyFormSubmit() {
        const easyEntryData = this.createEasyEntryData();

        // 檢查是否為第一次紀錄（在 push 前判斷）
        const wasFirstEntry = this.entries.length === 0;

        // v0.2-ECHO-4B: 生成 Echo 回應
        // TODO: Echo 儲存策略未來可評估改為 render-time dynamic generation
        const echoResponse = this.generateEchoResponse(easyEntryData);
        easyEntryData.echoResponse = echoResponse;

        // Easy Form 只處理新增模式（不用於編輯）
        this.entries.push(easyEntryData);

        // 按時間戳排序 (最新的在前面)
        this.entries.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

        // 建立 savedEntry 用於雲端同步
        const savedEntry = easyEntryData;

        this.saveToStorage();
        this.renderEntries();
        this.hideEasyForm();

        // 顯示成功訊息
        this.showToast('輕鬆紀錄已儲存！');

        // 本機儲存成功後，背景同步雲端
        if (this.currentUser !== 'guest') {
            this.syncEntryToCloudSilently(savedEntry);
        }

        // 顯示陪伴訊息
        this.showJournalCompanionMessage(easyEntryData.todayCondition, this.entries.length);

        // 檢查是否需要顯示 onboarding
        setTimeout(() => {
            this.checkFirstTimeOnboarding(wasFirstEntry);
        }, 500);
    }

    // 取得表單資料
    getFormData() {
        // 取得當前狀態
        const todayCondition = document.getElementById('todayCondition').value;

        // 收集item狀態
        let itemStates = {};
        const itemRadios = document.querySelectorAll('input[type="radio"]:checked');
        itemRadios.forEach(radio => {
            if (radio.name.startsWith('item-')) {
                const itemName = radio.name.replace('item-', '');
                itemStates[itemName] = radio.value;
            }
        });

        // 為相容性轉換為舊格式（將新的weak/strong映射到舊的missed/special）
        let missedItems = [];
        let specialItems = [];

        // v0.2-REST-1-1: 疲憊模式清空 item 狀態
        if (todayCondition === 'exhausted') {
            // 疲憊模式不處理訓練項目狀態
            itemStates = {};
            missedItems = [];
            specialItems = [];
        } else {
            Object.entries(itemStates).forEach(([item, status]) => {
                if (status === 'missed' || status === 'weak') missedItems.push(item);
                if (status === 'special' || status === 'strong') specialItems.push(item);
            });
        }

        // 取得選中的 Program 資訊
        let selectedProgramName = document.getElementById('programSelect').value;
        let programId = null;
        let programCategory = '';

        if (selectedProgramName) {
            const program = this.findProgramByName(selectedProgramName);
            if (program) {
                programId = program.id;
                programCategory = program.category;
            }
        }

        // v0.2-REST-1-1: 疲憊模式 Program 預設值
        if (todayCondition === 'exhausted') {
            programId = 'exhausted-reflection';
            programCategory = 'rest';
            selectedProgramName = '非常疲憊簡化紀錄';
        }

        // v0.2-REST-1-1: 處理疲憊模式資料
        let trainingType = document.querySelector('input[name="trainingType"]:checked')?.value || '';
        let completion = document.querySelector('input[name="completion"]:checked')?.value || '';
        let movementNotes = document.getElementById('movementNotes').value;

        if (todayCondition === 'exhausted') {
            // 疲憊模式預設值 - 修正 schema 相容性
            trainingType = '功能訓練';
            completion = 'little';

            // 合併疲憊模式選項與備註 - 使用定稿格式
            const exhaustedOption = document.querySelector('input[name="exhaustedChoice"]:checked')?.value || '';
            const exhaustedNote = document.getElementById('exhaustedNote')?.value?.trim() || '';

            // 定稿格式合併規則
            if (exhaustedOption && exhaustedNote) {
                // 快速選項 + 一句話
                movementNotes = `${exhaustedOption}｜${exhaustedNote}`;
            } else if (exhaustedOption) {
                // 只有快速選項
                movementNotes = exhaustedOption;
            } else if (exhaustedNote) {
                // 只有一句話
                movementNotes = exhaustedNote;
            } else {
                // 都沒有 - 預設值
                movementNotes = '今天沒有硬撐，很穩';
            }
        }

        return {
            date: document.getElementById('date').value,
            todayCondition: todayCondition,
            trainingType: trainingType,
            program: selectedProgramName,
            completion: completion,

            // 新的 Program 相關欄位
            programId: programId,
            programName: selectedProgramName,
            programCategory: programCategory,

            // 新的item狀態結構
            itemStates: itemStates,

            // 相容性欄位
            missedItems: missedItems,
            specialItems: specialItems,
            movementNotes: movementNotes,

            // 保留舊欄位以保持localStorage相容 (設為空值，不再使用週數)
            week: '',
            mainTraining: document.getElementById('mainTraining')?.value || '',
            coreState: document.querySelector('input[name="coreState"]:checked')?.value || '',
            legState: document.querySelector('input[name="legState"]:checked')?.value || '',
            shoulderState: document.querySelector('input[name="shoulderState"]:checked')?.value || '',
            fatigue: document.getElementById('fatigue')?.value || '5',
            exercises: document.getElementById('exercises')?.value || '',
            rpe: document.getElementById('rpe')?.value || '7',
            quality: document.getElementById('quality')?.value || '7',
            transfer: document.getElementById('transfer')?.value || '',
            nextDayFeeling: document.getElementById('nextDayFeeling')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            timestamp: new Date().toISOString()
        };
    }

    // 渲染所有紀錄
    renderEntries() {
        const container = document.getElementById('entriesContainer');

        if (this.entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🧗‍♂️ 尚無訓練紀錄</h3>
                    <p>點擊「新增今日紀錄」開始記錄你的攀岩生活點滴</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.entries.map((entry, index) =>
            this.createEntryCard(entry, index)
        ).join('');

        // 添加整張卡片點擊編輯事件監聽器
        container.querySelectorAll('.entry-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const timestamp = card.dataset.timestamp;
                if (timestamp) {
                    this.editEntry(timestamp);
                }
            });
        });

        // 添加編輯事件監聽器
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const timestamp = btn.dataset.timestamp;
                this.editEntry(timestamp);
            });
        });

        // 添加刪除事件監聽器
        container.querySelectorAll('.delete-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntry(index);
            });
        });
    }

    // 建立單一紀錄卡片
    createEntryCard(entry, index) {
        const formattedDate = this.formatDate(entry.date);

        return `
            <div class="entry-card" data-timestamp="${entry.timestamp || ''}" style="cursor: pointer;">
                <button class="edit-btn" title="編輯此紀錄" data-timestamp="${entry.timestamp || ''}">✏️</button>
                <button class="delete-btn" title="刪除此紀錄">🗑️</button>
                <div class="entry-header">
                    <div class="entry-date">${this.currentUser !== 'guest'
                        ? `第 ${this.entries.length - index} 次紀錄 · ${formattedDate}`
                        : `📅 ${formattedDate}`
                    }</div>
                </div>

                ${entry.todayCondition && false ? `
                <div class="entry-section">
                    <h4>⚡ 今日狀態</h4>
                    <p>${this.getConditionDisplayText(entry.todayCondition)}</p>
                </div>
                ` : ''}

                ${entry.trainingType && false ? `
                <div class="entry-section">
                    <h4>🎯 訓練類型</h4>
                    <p>${entry.trainingType === '攀岩' ? '🧗 攀岩' : '🏋️ 體能訓練'}</p>
                </div>
                ` : ''}

                ${entry.program && false ? `
                <div class="entry-section">
                    <h4>📋 Program</h4>
                    <p>${entry.program}</p>
                </div>
                ` : ''}

                ${entry.completion && false ? `
                <div class="entry-section">
                    <h4>✅ 完成度</h4>
                    <p>${this.getCompletionDisplayText(entry.completion)}</p>
                </div>
                ` : ''}

                ${this.renderItemStatesSection(entry)}

                ${entry.movementNotes ? `
                <div class="entry-section">
                    <h4>💭 movement備註</h4>
                    <p>${entry.movementNotes}</p>
                </div>
                ` : ''}

                <!-- 保留舊資料顯示以保持相容性 - v0.2-D 隱藏但保留代碼 -->
                ${entry.mainTraining && !entry.trainingType && false ? `
                <div class="entry-section">
                    <h4>🎯 今日主訓練</h4>
                    <p>${entry.mainTraining}</p>
                </div>
                ` : ''}


                ${entry.exercises && false ? `
                <div class="entry-section">
                    <h4>💪 訓練內容</h4>
                    <p>${this.formatText(entry.exercises)}</p>
                    <p>RPE: ${entry.rpe}/10 | 品質: ${entry.quality}/10</p>
                    <p>轉移感: ${entry.transfer}</p>
                </div>
                ` : ''}

                ${entry.nextDayFeeling && false ? `
                <div class="entry-section">
                    <h4>🌙 隔天體感</h4>
                    <p>${this.formatText(entry.nextDayFeeling)}</p>
                </div>
                ` : ''}

                ${entry.notes && false ? `
                <div class="entry-section">
                    <h4>📝 備註</h4>
                    <p>${this.formatText(entry.notes)}</p>
                </div>
                ` : ''}

                ${this.renderEchoResponse(entry)}
            </div>
        `;
    }

    // 格式化日期顯示
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        };
        return date.toLocaleDateString('zh-TW', options);
    }

    // 格式化文字（換行處理）
    formatText(text) {
        return text.replace(/\n/g, '<br>');
    }

    // 取得狀態樣式類別
    getStatusClass(state) {
        const goodStates = ['很順', '很穩', '穩'];
        const badStates = ['很差', '很晃', '掉肩'];

        if (goodStates.includes(state)) return 'status-indicator status-good';
        if (badStates.includes(state)) return 'status-indicator status-bad';
        return 'status-indicator status-ok';
    }

    // 刪除紀錄
    // 編輯 Entry
    editEntry(timestamp) {
        if (!timestamp) {
            alert('此紀錄缺少時間戳記，請重新整理頁面後再試。');
            return;
        }

        const entry = this.entries.find(e => e.timestamp === timestamp);
        if (!entry) {
            alert('找不到要編輯的紀錄，請重新整理頁面。');
            return;
        }

        // 設定編輯模式
        this.editingEntryTimestamp = timestamp;

        // 填入表單資料
        this.populateEntryForm(entry);

        // 顯示表單（不重置）
        document.getElementById('entryForm').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // 將 Entry 資料填入表單
    populateEntryForm(entry) {
        // 確保編輯模式顯示所有 todayCondition 選項（包含 exhausted）
        this.updateTodayConditionOptions();

        // 基本欄位
        document.getElementById('date').value = entry.date || '';
        document.getElementById('todayCondition').value = entry.todayCondition || '';

        // 訓練類型
        const trainingTypeRadio = document.querySelector(`input[name="trainingType"][value="${entry.trainingType}"]`);
        if (trainingTypeRadio) {
            trainingTypeRadio.checked = true;
            // v0.2-P-4-2: 編輯模式包含 archived Program (確保舊 Entry 可編輯)
            this.updateProgramOptions(entry.trainingType, { includeArchived: true });
        }

        // Program 選擇
        setTimeout(() => {
            const programSelect = document.getElementById('programSelect');
            if (programSelect && entry.program) {
                programSelect.value = entry.program;
                // v0.2-P-4-2: 編輯模式包含 archived Program (確保 item 狀態可載入)
                this.generateItemStatusList(entry.program, entry.trainingType, { includeArchived: true });

                // 填入 item 狀態
                setTimeout(() => {
                    if (entry.itemStates) {
                        Object.entries(entry.itemStates).forEach(([item, status]) => {
                            const radio = document.querySelector(`input[name="item-${item}"][value="${status}"]`);
                            if (radio) radio.checked = true;
                        });
                    }
                }, 100);
            }
        }, 100);

        // 完成度
        const completionRadio = document.querySelector(`input[name="completion"][value="${entry.completion}"]`);
        if (completionRadio) completionRadio.checked = true;

        // movement 備註
        document.getElementById('movementNotes').value = entry.movementNotes || '';

        // v0.2-REST-1-1: 編輯 exhausted entry 時設置正確 UI
        const editTodayCondition = document.getElementById('todayCondition').value;
        this.toggleExhaustedMode(editTodayCondition);
    }

    deleteEntry(index) {
        if (confirm('確定要刪除這筆紀錄嗎？')) {
            this.entries.splice(index, 1);
            this.saveToStorage();
            this.renderEntries();
            this.showToast('紀錄已刪除');
        }
    }

    // 清除所有資料
    clearAllData() {
        if (confirm('確定要清除所有生活紀錄嗎？此操作無法復原！')) {
            if (confirm('真的要清除所有資料嗎？請再次確認！')) {
                // 清除訓練資料
                this.entries = [];

                // 清除當前身份的所有相關 localStorage
                const entriesKey = this.getStorageKey('climbingTrainingEntries');
                const programsKey = this.getStorageKey('climbingPrograms');
                // TODO: 考慮將以下留言清除邏輯抽取為獨立方法
                const messagesKey = 'climbingMessages_' + this.currentUser;
                const onboardingKey = 'climbingMessageOnboardingSeen_' + this.currentUser;

                localStorage.removeItem(entriesKey);
                localStorage.removeItem(programsKey);
                localStorage.removeItem(messagesKey);
                localStorage.removeItem(onboardingKey);

                // 也清除舊的 key（向後相容）
                localStorage.removeItem('climbingTrainingEntries');
                localStorage.removeItem('climbingPrograms');

                this.renderEntries();

                // 重置留言展開狀態
                this.showAllMessages = false;

                // 關閉留言面板 overlay
                const messageOverlay = document.getElementById('messageOverlay');
                if (messageOverlay) {
                    messageOverlay.style.display = 'none';
                }

                this.showToast('所有資料已清除（包含留言和 onboarding 記錄）');

                console.log('Cleared all data including onboarding for user:', this.currentUser);

                console.log('[After Clear]', {
                    currentUser: this.currentUser,
                    entriesLength: this.entries.length,
                    localEntries: localStorage.getItem(this.getStorageKey('climbingTrainingEntries'))
                });
            }
        }
    }

    // 匯出 CSV
    exportToCSV() {
        if (this.entries.length === 0) {
            alert('沒有資料可以匯出');
            return;
        }

        const headers = [
            '日期', '今日狀態', '訓練類型', 'Program', 'ProgramID', 'ProgramCategory', '完成度', 'Item狀態', '遺漏項目', '特別有感', 'movement備註',
            '週數', '主訓練', '核心傳導', '單腳穩定', '肩胛穩定', '疲勞狀態',
            '訓練內容', 'RPE', '完成品質', '轉移感', '隔天體感', '備註', '建立時間'
        ];

        const csvContent = [
            headers.join(','),
            ...this.entries.map(entry => [
                entry.date,
                entry.todayCondition || '',
                entry.trainingType || '',
                entry.program || '',
                entry.programId || '',
                entry.programCategory || '',
                entry.completion || '',
                `"${JSON.stringify(entry.itemStates || {}).replace(/"/g, '""')}"`,
                `"${(entry.missedItems || []).join('; ')}"`,
                `"${(entry.specialItems || []).join('; ')}"`,
                `"${(entry.movementNotes || '').replace(/"/g, '""')}"`,
                entry.week || '',
                `"${entry.mainTraining || ''}"`,
                entry.coreState || '',
                entry.legState || '',
                entry.shoulderState || '',
                entry.fatigue || '',
                `"${(entry.exercises || '').replace(/"/g, '""')}"`,
                entry.rpe || '',
                entry.quality || '',
                entry.transfer || '',
                `"${(entry.nextDayFeeling || '').replace(/"/g, '""')}"`,
                `"${(entry.notes || '').replace(/"/g, '""')}"`,
                entry.timestamp
            ].join(','))
        ].join('\n');

        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `攀岩生活日記_${new Date().toISOString().split('T')[0]}.csv`;

        this.downloadFile(blob, filename);
        this.showToast('CSV 檔案已匯出');
    }

    // 匯出 JSON
    exportToJSON() {
        if (this.entries.length === 0) {
            alert('沒有資料可以匯出');
            return;
        }

        const jsonData = {
            exportDate: new Date().toISOString(),
            totalEntries: this.entries.length,
            entries: this.entries
        };

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const filename = `攀岩生活日記_${new Date().toISOString().split('T')[0]}.json`;

        this.downloadFile(blob, filename);
        this.showToast('JSON 檔案已匯出');
    }

    // 收集完整備份資料
    collectBackupData() {
        const backupData = {
            localStorage: {},
            sessionStorage: {}
        };

        // localStorage keys
        const localStorageKeys = [
            'climbingTrainingEntries_owner',
            'climbingTrainingEntries_tester',
            'climbingPrograms_owner',
            'climbingPrograms_tester',
            'climbingMessages_owner',
            'climbingMessages_tester',
            'messageUnread_tester',
            'climbingMessageOnboardingSeen_owner',
            'climbingMessageOnboardingSeen_tester',
            'currentUser',
            'climbingTrainingEntries',
            'climbingPrograms'
        ];

        // sessionStorage keys
        const sessionStorageKeys = [
            'session_climbingTrainingEntries',
            'session_climbingPrograms',
            'session_climbingMessages'
        ];

        // 讀取 localStorage
        localStorageKeys.forEach(key => {
            const value = localStorage.getItem(key);
            backupData.localStorage[key] = value ? value : null;
        });

        // 讀取 sessionStorage
        sessionStorageKeys.forEach(key => {
            const value = sessionStorage.getItem(key);
            backupData.sessionStorage[key] = value ? value : null;
        });

        return backupData;
    }

    // 建立備份 JSON 格式
    createBackupJSON() {
        const backupData = this.collectBackupData();

        // 統計資料
        let entriesCount = 0;
        let programsCount = 0;
        let messagesCount = 0;

        // 計算 entries
        Object.keys(backupData.localStorage).forEach(key => {
            if (key.includes('climbingTrainingEntries') && backupData.localStorage[key]) {
                try {
                    const entries = JSON.parse(backupData.localStorage[key]);
                    entriesCount += Array.isArray(entries) ? entries.length : 0;
                } catch (e) {}
            }
        });

        Object.keys(backupData.sessionStorage).forEach(key => {
            if (key.includes('climbingTrainingEntries') && backupData.sessionStorage[key]) {
                try {
                    const entries = JSON.parse(backupData.sessionStorage[key]);
                    entriesCount += Array.isArray(entries) ? entries.length : 0;
                } catch (e) {}
            }
        });

        // 計算 programs
        Object.keys(backupData.localStorage).forEach(key => {
            if (key.includes('climbingPrograms') && backupData.localStorage[key]) {
                try {
                    const programs = JSON.parse(backupData.localStorage[key]);
                    programsCount += Array.isArray(programs) ? programs.length : 0;
                } catch (e) {}
            }
        });

        Object.keys(backupData.sessionStorage).forEach(key => {
            if (key.includes('climbingPrograms') && backupData.sessionStorage[key]) {
                try {
                    const programs = JSON.parse(backupData.sessionStorage[key]);
                    programsCount += Array.isArray(programs) ? programs.length : 0;
                } catch (e) {}
            }
        });

        // 計算 messages
        Object.keys(backupData.localStorage).forEach(key => {
            if (key.includes('climbingMessages') && backupData.localStorage[key]) {
                try {
                    const messages = JSON.parse(backupData.localStorage[key]);
                    messagesCount += Array.isArray(messages) ? messages.length : 0;
                } catch (e) {}
            }
        });

        Object.keys(backupData.sessionStorage).forEach(key => {
            if (key.includes('climbingMessages') && backupData.sessionStorage[key]) {
                try {
                    const messages = JSON.parse(backupData.sessionStorage[key]);
                    messagesCount += Array.isArray(messages) ? messages.length : 0;
                } catch (e) {}
            }
        });

        const backup = {
            "backupVersion": "v0.2-S",
            "exportedAt": new Date().toISOString(),
            "appName": "Climbing Growth System",
            "storageType": "localStorage/sessionStorage mixed",
            "identity": this.currentUser || 'unknown',
            "data": backupData,
            "metadata": {
                "entriesCount": entriesCount,
                "programsCount": programsCount,
                "messagesCount": messagesCount,
                "timestampCoverage": `${entriesCount} entries across all identities`
            }
        };

        return backup;
    }

    // 匯出完整備份
    exportBackup() {
        const backupJSON = this.createBackupJSON();

        const blob = new Blob([JSON.stringify(backupJSON, null, 2)], { type: 'application/json' });
        const identity = this.currentUser || 'unknown';
        const today = new Date().toISOString().split('T')[0];
        const filename = `climbing_backup_${identity}_${today}.json`;

        this.downloadFile(blob, filename);
        this.showToast('完整備份已匯出！');
    }

    // 下載檔案
    downloadFile(blob, filename) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 顯示提示訊息
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4a9eff;
            color: white;
            padding: 1rem 2rem;
            border-radius: 10px;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `;

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

        // ============================================
    // Echo Response System - v0.2-ECHO-4B
    // ============================================

    // 建立 ECHO_POOLS 常數 - 基於 ECHO_ROUTING_RULES_V01 和 ECHO_STYLE_CHARTER_V01
    initializeEchoPools() {
        return {
            // Life Flow Pools (L1-L3)
            L1: [
                "穩穩的，挺好的。",
                "沒有勉強，真好。",
                "今天的節奏剛好。",
                "溫和的一天。",
                "剛剛好的狀態。",
                "今天很安心。",
                "安靜的步調。",
                "今天沒有硬撐。",
                "很穩的感覺。",
                "平靜的時光。"
            ],
            L2: [
                "今天多了一點味道。",
                "今天留下了一個味道。",
                "今天記住了一餐。",
                "今天有留下什麼。",
                "今天記住了。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天留下了印象。",
                "今天多了一段時間。",
                "今天有一個片刻被保留下來。"
            ],
            L3: [
                "今天見到了重要的人。",
                "今天多了一段一起度過的時間。",
                "有些相遇被記下來了。",
                "這段時間被保留下來了。",
                "今天多了一個片段。",
                "今天做了一些事。",
                "今天有一段時間。",
                "今天留下了一些痕跡。",
                "這一天有了內容。",
                "今天的頁面有了內容。"
            ],

            // Easy Flow Pools (E1-E4)
            E1: [
                "今天留下了一些痕跡。",
                "今天有留下腳印。",
                "今天做了一些事。",
                "今天有一段時間。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天留下了印象。",
                "今天多了一個小片段。",
                "這個時刻留在今天裡。",
                "這一天被記下來了。"
            ],
            E2: [
                "今天有留下什麼。",
                "今天記住了。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天留下了印象。",
                "今天多了一個片段。",
                "今天有一段時間。",
                "今天有一個片刻被保留下來。",
                "今天的頁面有了內容。",
                "這個時刻留在今天裡。"
            ],
            E3: [
                "穩穩的，挺好的。",
                "沒有勉強，真好。",
                "今天的節奏剛好。",
                "溫和的一天。",
                "剛剛好的狀態。",
                "今天很安心。",
                "安靜的步調。",
                "平靜的時光。",
                "今天沒有硬撐。",
                "很穩的感覺。"
            ],
            E4: [
                "今天多了一個片段。",
                "今天有一段時間。",
                "今天做了一些事。",
                "今天留下了一些痕跡。",
                "今天有留下腳印。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天有一個片刻被保留下來。",
                "今天多了一個小片段。",
                "這一天有了內容。"
            ],

            // Challenge Flow Pools (C1-C3)
            C1: [
                "今天做了一些事。",
                "今天有一段時間。",
                "今天留下了一些痕跡。",
                "今天有留下腳印。",
                "今天多了一個片段。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天的頁面有了內容。",
                "這個時刻留在今天裡。",
                "今天多了一個小片段。"
            ],
            C2: [
                "今天有留下什麼。",
                "今天記住了。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天留下了印象。",
                "今天多了一個片段。",
                "今天有一段時間。",
                "今天有一個片刻被保留下來。",
                "這一天被記下來了。",
                "這一天有了內容。"
            ],
            C3: [
                "今天留下了一些痕跡。",
                "今天有留下腳印。",
                "今天做了一些事。",
                "今天有一段時間。",
                "今天多了一些。",
                "有些東西被保存下來。",
                "今天記住了。",
                "今天有留下什麼。",
                "今天多了一個小片段。",
                "這個時刻留在今天裡。"
            ],

            // Fallback Pool (F1)
            F1: [
                "今天留下了一些痕跡。",
                "這一天被記下來了。",
                "今天的頁面有了內容。",
                "這個時刻被保存下來。",
                "今天留下了一個片段。",
                "這一天多了一行字。",
                "今天有一些被記錄下來。",
                "這一天有了內容。",
                "今天多了一個小片段。",
                "這個時刻留在今天裡。"
            ]
        };
    }

    // 實作核心 Echo 路由函式
    routeEchoResponse(entryData) {
        // 識別 Entry Flow 類型
        const flowType = this.identifyEntryFlow(entryData);

        // 根據 Flow 類型執行路由規則
        let pool, category;

        switch (flowType) {
            case 'life':
                ({ pool, category } = this.routeLifeFlow(entryData));
                break;
            case 'easy':
                ({ pool, category } = this.routeEasyFlow(entryData));
                break;
            case 'challenge':
                ({ pool, category } = this.routeChallengeFlow(entryData));
                break;
            default:
                pool = 'F1';
                category = 'fallback';
        }

        return { pool, category, flowType };
    }

    // 識別 Entry Flow 類型
    identifyEntryFlow(entryData) {
        // Life Flow: 基於 programId 和 todayCondition
        if (entryData.programId === 'exhausted-reflection' &&
            entryData.todayCondition === 'exhausted') {
            return 'life';
        }

        // Easy Flow: 基於 programId 和特定組合
        if (entryData.programId === 'easy-reflection' &&
            entryData.trainingType === '攀岩' &&
            entryData.todayCondition === 'normal') {
            return 'easy';
        }

        // Challenge Flow: 其他所有情況
        return 'challenge';
    }

    // Life Flow 路由規則
    routeLifeFlow(entryData) {
        const movementNotes = entryData.movementNotes || '';

        // 提取 Life Choice (格式: "選項｜備註" 或單純 "選項")
        const parts = movementNotes.split('｜');
        const lifeChoice = parts[0] || '';

        // 規則 L-1: 直接映射
        if (lifeChoice === "今天沒有硬撐，很穩") {
            return { pool: 'L1', category: '安穩型' };
        }
        if (lifeChoice === "今天有吃到好吃的") {
            return { pool: 'L2', category: '生活型' };
        }
        if (lifeChoice === "今天有見到重要的人") {
            return { pool: 'L3', category: '陪伴型' };
        }

        // 規則 L-2: 未選擇 Fallback
        return { pool: 'F1', category: 'fallback' };
    }

    // Easy Flow 路由規則
    routeEasyFlow(entryData) {
        const movementNotes = entryData.movementNotes || '';

        // 提取 Easy Choice (格式: "選項1、選項2｜備註" 或 "選項1、選項2")
        const parts = movementNotes.split('｜');
        const choicesText = parts[0] || '';
        const easyChoices = choicesText ? choicesText.split('、').map(c => c.trim()) : [];

        // 規則 E-3: 具體判斷邏輯（修正優先順序）

        // 1. E4 平衡型 - >=3 個選項（最高優先）
        if (easyChoices.length >= 3) {
            return { pool: 'E4', category: '平衡型' };
        }

        // 2. E2 觀察型 - 只要包含觀察
        if (easyChoices.includes("有觀察到新的東西")) {
            return { pool: 'E2', category: '觀察型' };
        }

        // 3. E3 恢復型 - 只要包含休息
        if (easyChoices.includes("有讓自己休息")) {
            return { pool: 'E3', category: '恢復型' };
        }

        // 4. E1 累積型 - 其他所有情況
        return { pool: 'E1', category: '累積型' };
    }

    // Challenge Flow 路由規則
    routeChallengeFlow(entryData) {
        const completion = entryData.completion || '';

        // 規則 C-1: 直接映射
        if (completion === "all" || completion === "most") {
            return { pool: 'C1', category: '完成型' };
        }
        if (completion === "half") {
            return { pool: 'C2', category: '持續型' };
        }
        if (completion === "little") {
            return { pool: 'C3', category: '留痕型' };
        }

        // 規則 C-2: 異常處理
        return { pool: 'F1', category: 'fallback' };
    }

    // 從指定回應池隨機選擇一條 Echo
    selectRandomEcho(poolName) {
        const echoPools = this.echoPools;
        const pool = echoPools[poolName];

        if (!pool || !Array.isArray(pool) || pool.length === 0) {
            // 回應池異常，使用 F1 Fallback
            const fallbackPool = echoPools['F1'];
            if (!fallbackPool || fallbackPool.length === 0) {
                return "今天留下了一些痕跡。"; // 硬編碼安全回應
            }
            const randomIndex = Math.floor(Math.random() * fallbackPool.length);
            return fallbackPool[randomIndex];
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    }

    // 建立 Echo Response Object（MVP 版本）
    buildEchoResponse(pool, category, flowType, message, entryData) {
        return {
            pool: pool,
            category: category,
            message: message,
            source: flowType,
            entryId: entryData.timestamp
        };
    }

    // 主要 Echo 生成函式 - 整合所有步驟
    generateEchoResponse(entryData) {
        try {
            // 初始化 Echo Pools（如果還沒有）
            if (!this.echoPools) {
                this.echoPools = this.initializeEchoPools();
            }

            // 1. 路由決策
            const { pool, category, flowType } = this.routeEchoResponse(entryData);

            // 2. 隨機選擇回應
            const message = this.selectRandomEcho(pool);

            // 3. 建立回應物件
            const echoResponse = this.buildEchoResponse(pool, category, flowType, message, entryData);

            return echoResponse;
        } catch (error) {
            console.error('Echo 生成失敗:', error);
            // 安全回應
            return {
                pool: 'F1',
                category: 'fallback',
                message: '今天留下了一些痕跡。',
                source: 'error',
                entryId: entryData.timestamp || 'unknown'
            };
        }
    }

    // 取得依時間順序排列的 entries（不修改原陣列）
    getChronologicalEntries() {
        return [...this.entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // v0.2-ECHO-PRESENCE-MVP: 判斷是否應該顯示 Echo
    shouldShowEcho(entry) {
        // 保護：前3筆記錄一定顯示 Echo（新用戶體驗）
        const chronologicalEntries = this.getChronologicalEntries();
        const entryIndex = chronologicalEntries.findIndex(e => e.timestamp === entry.timestamp);

        if (entryIndex !== -1 && entryIndex < 3) {
            return true;
        }

        // 確定性隨機：基於 timestamp，相同 entry 永遠相同結果
        const seed = entry.timestamp % 10000;
        const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280;

        // 70% 機率顯示 Echo
        return pseudoRandom < 0.7;
    }

    // 渲染 Echo 回應 - 支援新舊 entry 相容性
    renderEchoResponse(entry) {
        // v0.2-ECHO-PRESENCE-MVP: 檢查是否應該顯示 Echo
        if (!this.shouldShowEcho(entry)) {
            return ''; // 不顯示 Echo
        }

        let echoResponse = entry.echoResponse;

        // 向後相容：為舊 entry 動態生成 echo response
        if (!echoResponse) {
            echoResponse = this.generateEchoResponse(entry);
            // 不寫回 entry，保持非侵入性
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

    // === 留言系統 ===

    // ============================================
    // 留言系統 - 初始化與事件綁定
    // ============================================

    // 初始化留言系統
    initializeMessageSystem() {
        console.log('[InitializeMessageSystem]', {
            currentUser: this.currentUser,
            documentReadyState: document.readyState,
            messageIconExists: !!document.getElementById('messageIcon'),
            messageIconDisplay: document.getElementById('messageIcon')?.style.display,
            messageIconVisible: document.getElementById('messageIcon')?.offsetParent !== null
        });

        // 顯示/隱藏留言 icon（只對 owner 和 tester）
        const messageIcon = document.getElementById('messageIcon');
        if (messageIcon) {
            if (this.currentUser === 'guest') {
                messageIcon.style.display = 'none';
            } else {
                messageIcon.style.display = 'inline-block';
            }
        }

        // 顯示/隱藏給測試員留言按鈕（只對 owner）
        const sendToTester = document.getElementById('sendToTester');
        if (sendToTester) {
            if (this.currentUser === 'owner') {
                sendToTester.style.display = 'inline-block';
            } else {
                sendToTester.style.display = 'none';
            }
        }

        // 顯示/隱藏給測試員正式回覆按鈕（只對 owner）
        const sendOfficialToTester = document.getElementById('sendOfficialToTester');
        if (sendOfficialToTester) {
            if (this.currentUser === 'owner') {
                sendOfficialToTester.style.display = 'inline-block';
            } else {
                sendOfficialToTester.style.display = 'none';
            }
        }

        // 顯示/隱藏重置 Alice 測試按鈕（只對 owner）
        const resetTesterTest = document.getElementById('resetTesterTest');
        if (resetTesterTest) {
            if (this.currentUser === 'owner') {
                resetTesterTest.style.display = 'inline-block';
            } else {
                resetTesterTest.style.display = 'none';
            }
        }

        // 顯示/隱藏清理 Xavier 留言空間按鈕（只對 owner）
        const clearOwnerSpace = document.getElementById('clearOwnerSpace');
        if (clearOwnerSpace) {
            if (this.currentUser === 'owner') {
                clearOwnerSpace.style.display = 'inline-block';
            } else {
                clearOwnerSpace.style.display = 'none';
            }
        }

        // 更新留言圖示顯示
        this.updateMessageIcon();
    }

    setupMessageEvents() {
        const messageIcon = document.getElementById('messageIcon');
        if (messageIcon && !messageIcon.dataset.bound) {
            messageIcon.addEventListener('click', () => {
                this.showMessagePanel();
            });
            messageIcon.dataset.bound = 'true';
        }

        const closeMsgPanel = document.getElementById('closeMsgPanel');
        if (closeMsgPanel && !closeMsgPanel.dataset.bound) {
            closeMsgPanel.addEventListener('click', () => {
                this.hideMessagePanel();
            });
            closeMsgPanel.dataset.bound = 'true';
        }

        const onboardingOk = document.getElementById('onboardingOk');
        if (onboardingOk && !onboardingOk.dataset.bound) {
            onboardingOk.addEventListener('click', () => {
                this.hideOnboarding();
            });
            onboardingOk.dataset.bound = 'true';
        }

        const sendMessage = document.getElementById('sendMessage');
        if (sendMessage && !sendMessage.dataset.bound) {
            sendMessage.addEventListener('click', () => {
                this.handleSendMessage();
            });
            sendMessage.dataset.bound = 'true';
        }

        const sendToTester = document.getElementById('sendToTester');
        if (sendToTester && !sendToTester.dataset.bound) {
            sendToTester.addEventListener('click', () => {
                const text = prompt('寫一張給 Alice 的小紙條');
                if (text && text.trim()) {
                    this.addMessageToTester(text.trim());
                    this.showToast('已發送給測試員');
                    // 如果在 owner 模式，刷新留言顯示
                    if (this.currentUser === 'owner') {
                        this.renderMessages();
                    }
                }
            });
            sendToTester.dataset.bound = 'true';
        }

        const sendOfficialToTester = document.getElementById('sendOfficialToTester');
        if (sendOfficialToTester && !sendOfficialToTester.dataset.bound) {
            sendOfficialToTester.addEventListener('click', () => {
                const text = prompt('寫一則小留言本的正式回覆');
                if (text && text.trim()) {
                    this.addOfficialMessageToTester(text.trim());
                    this.showToast('已發送正式回覆給測試員');
                    // 如果在 owner 模式，刷新留言顯示
                    if (this.currentUser === 'owner') {
                        this.renderMessages();
                    }
                }
            });
            sendOfficialToTester.dataset.bound = 'true';
        }

        const resetTesterTest = document.getElementById('resetTesterTest');
        if (resetTesterTest && !resetTesterTest.dataset.bound) {
            resetTesterTest.addEventListener('click', () => {
                this.resetTesterMessageTest();
            });
            resetTesterTest.dataset.bound = 'true';
        }

        const clearOwnerSpace = document.getElementById('clearOwnerSpace');
        if (clearOwnerSpace && !clearOwnerSpace.dataset.bound) {
            clearOwnerSpace.addEventListener('click', () => {
                this.clearOwnerMessageSpace();
            });
            clearOwnerSpace.dataset.bound = 'true';
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput && !messageInput.dataset.bound) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                } else if (e.key === 'Enter' && e.shiftKey) {
                    // 允許 Shift+Enter 換行，不阻止預設行為
                }
            });
            messageInput.dataset.bound = 'true';
        }

        // 留言展開/收回事件（使用事件委託）
        const messageContainer = document.getElementById('messageContainer');
        if (messageContainer && !messageContainer.dataset.toggleBound) {
            messageContainer.addEventListener('click', (e) => {
                if (e.target.id === 'showMoreMessages') {
                    this.showAllMessages = true;
                    this.renderMessages();
                } else if (e.target.id === 'hideOlderMessages') {
                    this.showAllMessages = false;
                    this.renderMessages();
                }
            });
            messageContainer.dataset.toggleBound = 'true';
        }
    }

    // ============================================
    // 留言系統 - Onboarding 流程
    // ============================================

    checkFirstTimeOnboarding(wasFirstEntry = null) {
        console.log('[CheckFirstTimeOnboarding]', {
            currentUser: this.currentUser,
            entriesLength: this.entries.length,
            wasFirstEntry: wasFirstEntry,
            onboardingKey: 'climbingMessageOnboardingSeen_' + this.currentUser,
            alreadySeen: localStorage.getItem('climbingMessageOnboardingSeen_' + this.currentUser)
        });

        const onboardingKey = 'climbingMessageOnboardingSeen_' + this.currentUser;

        if (wasFirstEntry === true &&
            this.currentUser !== 'guest' &&
            !localStorage.getItem(onboardingKey)) {

            // 立刻寫入 seen flag，避免重複觸發
            localStorage.setItem(onboardingKey, 'true');

            setTimeout(() => {
                this.showOnboarding();
            }, 500);
        }
    }

    // 顯示 onboarding modal
    showOnboarding() {
        console.log('[ShowOnboarding] Attempting to show onboarding modal');
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('[ShowOnboarding] Modal displayed');
        } else {
            console.error('[ShowOnboarding] Modal not found');
        }
    }

    // 隱藏 onboarding modal
    hideOnboarding() {
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            modal.style.display = 'none';
            // 標記已看過
            localStorage.setItem('climbingMessageOnboardingSeen_' + this.currentUser, 'true');
        }
    }

    // ============================================
    // 留言系統 - 面板顯示控制
    // ============================================

    // 顯示留言面板
    showMessagePanel() {
        const overlay = document.getElementById('messageOverlay');
        if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
            // 如果面板打開，載入並顯示留言
            if (overlay.style.display === 'flex') {
                // 清除 tester 的未讀狀態
                if (this.currentUser === 'tester') {
                    localStorage.removeItem('messageUnread_tester');
                    this.updateMessageIcon();
                }
                setTimeout(() => {
                    this.renderMessages();
                }, 100);
            }
        }
    }

    // 更新留言圖示顯示
    updateMessageIcon() {
        const messageIcon = document.getElementById('messageIcon');
        if (messageIcon && this.currentUser === 'tester') {
            const hasUnread = localStorage.getItem('messageUnread_tester') === 'true';
            messageIcon.textContent = hasUnread ? '💬 有新紙條' : '💬';
        }
    }

    hideMessagePanel() {
        const overlay = document.getElementById('messageOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ============================================
    // 留言系統 - 留言處理與渲染
    // ============================================

    handleSendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        const text = messageInput.value.trim();
        if (!text) return;

        // 添加用戶留言
        this.addMessage(text, 'user');
        messageInput.value = '';

        // 檢查是否需要自動回覆（只在 tester 模式）
        if (this.currentUser === 'tester') {
            const userCount = this.getUserMessageCount();
            const autoReply = this.getAutoReply(userCount);
            if (autoReply) {
                this.addMessage(autoReply, 'auto');
            }
        }

        this.renderMessages();
    }

    addMessage(text, type) {
        const messages = this.loadMessages();
        const message = {
            text: text,
            type: type, // 'user' or 'auto'
            timestamp: new Date().toISOString()
        };

        messages.push(message);

        // 記錄新留言的 timestamp 供動畫使用
        this.newMessageTimestamps.push(message.timestamp);

        const messagesKey = 'climbingMessages_' + this.currentUser;
        localStorage.setItem(messagesKey, JSON.stringify(messages));
    }

    loadMessages() {
        const messagesKey = 'climbingMessages_' + this.currentUser;
        const stored = localStorage.getItem(messagesKey);
        return stored ? JSON.parse(stored) : [];
    }

    // Owner 模式讀取所有留言（包含 tester）
    loadMessagesForOwnerView() {
        // 讀取 owner 留言
        const ownerMessages = JSON.parse(localStorage.getItem('climbingMessages_owner') || '[]');
        // 讀取 tester 留言
        const testerMessages = JSON.parse(localStorage.getItem('climbingMessages_tester') || '[]');

        // 為留言添加來源標籤（不寫回 localStorage）
        const ownerWithSource = ownerMessages.map(msg => ({
            ...msg,
            sourceName: msg.type === 'auto' ? '小留言本的回覆' :
                       msg.type === 'official' ? '小留言本的正式回覆' :
                       msg.type === 'developer' ? 'Xavier' : 'Xavier'
        }));

        const testerWithSource = testerMessages.map(msg => ({
            ...msg,
            sourceName: msg.type === 'auto' ? '小留言本的回覆' :
                       msg.type === 'official' ? '小留言本的正式回覆' :
                       msg.type === 'developer' ? 'Xavier' : 'Alice'
        }));

        // 合併並按時間排序
        return [...ownerWithSource, ...testerWithSource]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Owner 發送訊息到 Tester 留言板
    addMessageToTester(text) {
        const testerMessages = JSON.parse(localStorage.getItem('climbingMessages_tester') || '[]');
        const message = {
            text: text,
            type: 'developer',
            timestamp: new Date().toISOString(),
            fromUser: 'owner',
            fromName: 'Xavier',
            targetUser: 'tester'
        };
        testerMessages.push(message);
        localStorage.setItem('climbingMessages_tester', JSON.stringify(testerMessages));
        localStorage.setItem('messageUnread_tester', 'true');
    }

    // Owner 發送正式回覆到 Tester 留言板
    addOfficialMessageToTester(text) {
        const testerMessages = JSON.parse(localStorage.getItem('climbingMessages_tester') || '[]');
        const message = {
            text: text,
            type: 'official',
            timestamp: new Date().toISOString(),
            fromUser: 'system',
            fromName: '小留言本',
            label: '正式回覆',
            targetUser: 'tester'
        };
        testerMessages.push(message);
        localStorage.setItem('climbingMessages_tester', JSON.stringify(testerMessages));
        localStorage.setItem('messageUnread_tester', 'true');
    }

    // Owner 重置 Tester 留言測試狀態
    resetTesterMessageTest() {
        // 僅允許 owner 執行
        if (this.currentUser !== 'owner') return;

        // 確認操作
        if (!confirm('確定要重置 Alice 的留言測試狀態嗎？這只會清除 Alice 的留言、未讀提示與留言引導，不會清 Daily Journal。')) {
            return;
        }

        // 清除 tester 留言測試相關資料
        localStorage.removeItem('climbingMessages_tester');
        localStorage.removeItem('messageUnread_tester');
        localStorage.removeItem('climbingMessageOnboardingSeen_tester');

        // 刷新顯示
        this.renderMessages();
        this.updateMessageIcon();
        this.showToast('Alice 留言測試已重置');
    }

    // Owner 清理自己的留言空間
    clearOwnerMessageSpace() {
        // 僅允許 owner 執行
        if (this.currentUser !== 'owner') return;

        // 確認操作
        if (!confirm('確定要清理 Xavier 的留言空間嗎？這只會清除開發者自己的留言，不會清 Alice 的留言與 Daily Journal。')) {
            return;
        }

        // 清除 owner 留言資料
        localStorage.removeItem('climbingMessages_owner');

        // 刷新顯示
        this.renderMessages();
        this.showToast('Xavier 留言空間已清理');
    }

    // TODO: 此方法較長，可考慮拆分顯示邏輯
    renderMessages() {
        const container = document.getElementById('messageContainer');
        if (!container) return;

        const messages = this.currentUser === 'owner' ? this.loadMessagesForOwnerView() : this.loadMessages();
        container.innerHTML = '';

        // 決定顯示哪些留言
        const displayMessages = this.showAllMessages ? messages : messages.slice(-3);
        const hiddenCount = messages.length - displayMessages.length;

        displayMessages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.type === 'auto' ? 'system' : message.type}`;

            // 檢查是否為新留言，添加淡入動畫
            if (this.newMessageTimestamps.includes(message.timestamp)) {
                messageDiv.classList.add('message-new');

                // 動畫結束後移除 class
                setTimeout(() => {
                    messageDiv.classList.remove('message-new');
                }, 220);
            }

            const time = new Date(message.timestamp).toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit'
            });

            messageDiv.innerHTML = `
                <div class="message-content">${message.text}</div>
                <div class="message-timestamp">${time}${message.sourceName ? ` · 來自 ${message.sourceName}` :
                    (message.type === 'developer' && message.fromName) ? ` · 來自 ${message.fromName}` :
                    (message.type === 'auto') ? ` · 來自小留言本的回覆` :
                    (message.type === 'official') ? ` · 來自小留言本的正式回覆` : ''}</div>
            `;

            container.appendChild(messageDiv);
        });

        // 添加展開/收回按鈕
        if (messages.length > 3) {
            const toggleDiv = document.createElement('div');
            toggleDiv.className = 'message-toggle';

            if (!this.showAllMessages) {
                toggleDiv.innerHTML = `<button id="showMoreMessages" class="toggle-btn">+ 查看更早的留言（${hiddenCount}則）</button>`;
            } else {
                toggleDiv.innerHTML = `<button id="hideOlderMessages" class="toggle-btn">收回較早留言</button>`;
            }

            container.appendChild(toggleDiv);
        }

        // 滾動到最底部
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);

        // 清理已使用的新留言標記
        this.newMessageTimestamps = [];
    }

    getUserMessageCount() {
        const messages = this.loadMessages();
        return messages.filter(msg => msg.type === 'user').length;
    }

    getAutoReply(userCount) {
        const replies = [
            '', // index 0 不使用
            '📨 開發者已收到訊號！\n偷偷說，\n看到第一則留言其實有點開心。\n因為這代表：\n這個小東西，\n真的開始有人在用了😆', // 第1次
            '🛠️ movement 小精靈努力修正中…\n你現在已正式成為：\n高級 bug 製造者（不是）\n很多東西我其實還在慢慢調整，\n所以看到你的感覺跟 feedback，\n都會很有幫助。', // 第2次
            '🌱 小小系統持續進化中…\n其實最一開始，\n只是想做一個：\n能讓人「感覺自己正在慢慢變好」的小東西。\n謝謝你願意陪它長大。\n還有偷偷陪我一起測試這個世界。', // 第3次
            '🛌 你的開發者正在偷懶。\n\n第四次之後的留言回覆，\n目前還沒做。\n\n畢竟他也還在慢慢長大（？）\n\n敬請期待😴' // 第4次
        ];

        // 第5次及以後不再自動回覆
        if (userCount >= 5) {
            return null;
        }

        return replies[userCount] || null;
    }

    // ============================================
    // 留言系統 - 測試與debug工具
    // ============================================

    // 清除 onboarding 記錄（測試用）
    clearOnboardingRecord() {
        localStorage.removeItem('climbingMessageOnboardingSeen_owner');
        localStorage.removeItem('climbingMessageOnboardingSeen_tester');
        console.log('Onboarding records cleared');
    }

    // 強制顯示 onboarding（測試用）
    forceShowOnboarding() {
        console.log('Force showing onboarding...');
        this.showOnboarding();
    }

    // 顯示記錄後陪伴訊息
    showJournalCompanionMessage(condition, recordCount) {
        const companionNote = document.getElementById('journalCompanionNote');
        const messageText = companionNote?.querySelector('.companion-message-text');

        if (companionNote && messageText) {
            messageText.textContent = this.getJournalCompanionMessage(condition, recordCount);
            companionNote.style.display = 'block';

            // 4秒後自動隱藏
            setTimeout(() => {
                companionNote.style.display = 'none';
            }, 4000);
        }
    }

    // v0.2-DB-3: 資料品質檢查工具 (只讀不寫)
    generateDataQualityReport() {
        console.log('🔍 開始資料品質檢查...');

        const report = {
            checkedAt: new Date().toISOString(),
            currentUser: this.currentUser || 'null',
            entries: this.checkEntryQuality(),
            programs: this.checkProgramQuality(),
            messages: this.checkMessageQuality(),
            storage: this.checkStorageKeys(),
            riskSummary: { high: 0, medium: 0, low: 0 }
        };

        // 計算風險統計
        const allIssues = [
            ...report.entries.issues,
            ...report.programs.issues,
            ...report.messages.issues
        ];

        allIssues.forEach(issue => {
            if (issue.risk === 'high') report.riskSummary.high++;
            else if (issue.risk === 'medium') report.riskSummary.medium++;
            else report.riskSummary.low++;
        });

        // Console 輸出
        console.log('📊 資料品質檢查報告：');
        console.table({
            'Entries 總數': report.entries.total,
            'Programs 總數': report.programs.total,
            'Messages 總數': report.messages.total,
            '高風險問題': report.riskSummary.high,
            '中風險問題': report.riskSummary.medium,
            '低風險問題': report.riskSummary.low
        });

        if (allIssues.length > 0) {
            console.log('⚠️ 發現的問題：');
            console.table(allIssues);
        } else {
            console.log('✅ 資料品質良好，無發現問題');
        }

        console.log('📋 完整報告：', report);
        return report;
    }

    // Entry 資料品質檢查
    checkEntryQuality() {
        const issues = [];
        let stats = {
            total: this.entries.length,
            missingTimestamp: 0,
            missingDate: 0,
            missingTodayCondition: 0,
            missingTrainingType: 0,
            missingProgramId: 0,
            missingCompletion: 0,
            invalidItemStates: 0,
            invalidMovementNotes: 0,
            inconsistentProgramName: 0,
            missingProgramCategory: 0,
            inconsistentLegacyItems: 0,
            issues: issues
        };

        this.entries.forEach((entry, index) => {
            // 必要欄位檢查
            if (!entry.timestamp) {
                stats.missingTimestamp++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 timestamp',
                    risk: 'high'
                });
            }

            if (!entry.date) {
                stats.missingDate++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 date',
                    risk: 'high'
                });
            }

            if (!entry.todayCondition) {
                stats.missingTodayCondition++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 todayCondition',
                    risk: 'medium'
                });
            }

            if (!entry.trainingType) {
                stats.missingTrainingType++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 trainingType',
                    risk: 'medium'
                });
            }

            if (!entry.programId) {
                stats.missingProgramId++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 programId',
                    risk: 'high'
                });
            }

            if (!entry.completion) {
                stats.missingCompletion++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 completion',
                    risk: 'medium'
                });
            }

            // itemStates 格式檢查
            if (entry.itemStates !== undefined && typeof entry.itemStates !== 'object') {
                stats.invalidItemStates++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: 'itemStates 不是 object',
                    risk: 'medium'
                });
            }

            // movementNotes 格式檢查
            if (entry.movementNotes !== undefined && typeof entry.movementNotes !== 'string') {
                stats.invalidMovementNotes++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: 'movementNotes 不是 string',
                    risk: 'low'
                });
            }

            // program vs programName 一致性檢查
            if (entry.program && entry.programName && entry.program !== entry.programName) {
                stats.inconsistentProgramName++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: 'program 與 programName 不一致',
                    risk: 'medium'
                });
            }

            // programCategory 檢查
            if (!entry.programCategory) {
                stats.missingProgramCategory++;
                issues.push({
                    type: 'Entry',
                    index: index,
                    issue: '缺少 programCategory',
                    risk: 'low'
                });
            }

            // missedItems/specialItems 與 itemStates 一致性檢查 (與 repairLocalDataQuality 規則一致)
            if (entry.itemStates && typeof entry.itemStates === 'object') {
                // 使用與修復器相同的轉換規則
                const expectedMissed = Object.entries(entry.itemStates)
                    .filter(([_, status]) => status === 'missed' || status === 'weak')
                    .map(([item, _]) => item);
                const expectedSpecial = Object.entries(entry.itemStates)
                    .filter(([_, status]) => status === 'special' || status === 'strong')
                    .map(([item, _]) => item);

                // 確保實際值是陣列，undefined 視為空陣列
                const actualMissed = Array.isArray(entry.missedItems) ? entry.missedItems : [];
                const actualSpecial = Array.isArray(entry.specialItems) ? entry.specialItems : [];

                // 忽略順序比較
                const missedMatch = JSON.stringify(expectedMissed.sort()) === JSON.stringify(actualMissed.sort());
                const specialMatch = JSON.stringify(expectedSpecial.sort()) === JSON.stringify(actualSpecial.sort());

                if (!missedMatch || !specialMatch) {
                    stats.inconsistentLegacyItems++;
                    issues.push({
                        type: 'Entry',
                        index: index,
                        issue: 'itemStates 與 missedItems/specialItems 不一致',
                        risk: 'medium'
                    });
                }
            }
        });

        return stats;
    }

    // Program 資料品質檢查
    checkProgramQuality() {
        const programs = this.loadPrograms();
        const issues = [];
        let stats = {
            total: programs.length,
            missingId: 0,
            missingName: 0,
            missingType: 0,
            invalidItems: 0,
            missingCreatedAt: 0,
            duplicateNameType: 0,
            invalidCustomId: 0,
            issues: issues
        };

        const nameTypeMap = new Map();

        programs.forEach((program, index) => {
            // 必要欄位檢查
            if (!program.id) {
                stats.missingId++;
                issues.push({
                    type: 'Program',
                    index: index,
                    issue: '缺少 id',
                    risk: 'high'
                });
            }

            if (!program.name) {
                stats.missingName++;
                issues.push({
                    type: 'Program',
                    index: index,
                    issue: '缺少 name',
                    risk: 'high'
                });
            }

            if (!program.type) {
                stats.missingType++;
                issues.push({
                    type: 'Program',
                    index: index,
                    issue: '缺少 type',
                    risk: 'medium'
                });
            }

            // items 格式檢查
            if (!Array.isArray(program.items)) {
                stats.invalidItems++;
                issues.push({
                    type: 'Program',
                    index: index,
                    issue: 'items 不是 array',
                    risk: 'medium'
                });
            }

            // createdAt 檢查
            if (!program.createdAt) {
                stats.missingCreatedAt++;
                issues.push({
                    type: 'Program',
                    index: index,
                    issue: '缺少 createdAt',
                    risk: 'low'
                });
            }

            // name + type 重複檢查
            if (program.name && program.type) {
                const key = `${program.name}__${program.type}`;
                if (nameTypeMap.has(key)) {
                    stats.duplicateNameType++;
                    issues.push({
                        type: 'Program',
                        index: index,
                        issue: `name+type 重複: ${key}`,
                        risk: 'medium'
                    });
                } else {
                    nameTypeMap.set(key, true);
                }
            }

            // 自訂 Program ID 格式檢查
            if (program.id && program.id.startsWith('program_custom_')) {
                const parts = program.id.split('_');
                // v0.2-DB-6: 修正 validator 邏輯 - 基礎格式 program_custom_name 是合法的
                if (parts.length < 3 || !parts[2]) {
                    stats.invalidCustomId++;
                    issues.push({
                        type: 'Program',
                        index: index,
                        issue: '自訂 Program ID 格式異常',
                        risk: 'medium'
                    });
                }
            }
        });

        return stats;
    }

    // Message 資料品質檢查
    checkMessageQuality() {
        const messages = this.loadMessages();
        const issues = [];
        let stats = {
            total: messages.length,
            missingText: 0,
            missingType: 0,
            missingTimestamp: 0,
            unknownType: 0,
            byType: { user: 0, auto: 0, developer: 0, official: 0, unknown: 0 },
            issues: issues
        };

        const validTypes = ['user', 'auto', 'developer', 'official'];

        messages.forEach((message, index) => {
            // 必要欄位檢查
            if (!message.text) {
                stats.missingText++;
                issues.push({
                    type: 'Message',
                    index: index,
                    issue: '缺少 text',
                    risk: 'medium'
                });
            }

            if (!message.type) {
                stats.missingType++;
                issues.push({
                    type: 'Message',
                    index: index,
                    issue: '缺少 type',
                    risk: 'medium'
                });
            }

            if (!message.timestamp) {
                stats.missingTimestamp++;
                issues.push({
                    type: 'Message',
                    index: index,
                    issue: '缺少 timestamp',
                    risk: 'low'
                });
            }

            // type 有效性檢查
            if (message.type) {
                if (validTypes.includes(message.type)) {
                    stats.byType[message.type]++;
                } else {
                    stats.unknownType++;
                    stats.byType.unknown++;
                    issues.push({
                        type: 'Message',
                        index: index,
                        issue: `不明 type: ${message.type}`,
                        risk: 'medium'
                    });
                }
            }
        });

        return stats;
    }

    // Storage Keys 檢查
    checkStorageKeys() {
        const localStorageKeys = [];
        const sessionStorageKeys = [];
        const legacyKeysFound = [];

        // 檢查 localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('climbing')) {
                localStorageKeys.push(key);

                // 檢查 legacy keys
                if (key === 'climbingTrainingEntries' || key === 'climbingPrograms') {
                    legacyKeysFound.push(key);
                }
            }
        }

        // 檢查 sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.includes('climbing')) {
                sessionStorageKeys.push(key);
            }
        }

        return {
            localStorageKeys,
            sessionStorageKeys,
            legacyKeysFound,
            currentUserValue: localStorage.getItem('currentUser')
        };
    }

    // v0.2-DB-5: 安全本地資料修復 (只修 completion 與 itemStates 相容性)
    repairLocalDataQuality() {
        console.log('🔧 開始本地資料品質修復...');

        let repairedCount = 0;
        let completionFixed = 0;
        let itemStatesFixed = 0;

        this.entries.forEach((entry, index) => {
            let entryRepaired = false;

            // 修復 1: completion 缺失
            if (!entry.completion) {
                entry.completion = "most"; // 預設為「大部分」
                completionFixed++;
                entryRepaired = true;
                console.log(`✅ Entry ${index}: 補充 completion = "most"`);
            }

            // 修復 2: itemStates 與 missedItems/specialItems 同步 (以 itemStates 為主)
            if (entry.itemStates && typeof entry.itemStates === 'object') {
                const missedItems = [];
                const specialItems = [];

                // 以 itemStates 為主資料，直接重新生成相容欄位
                Object.entries(entry.itemStates).forEach(([item, status]) => {
                    if (status === 'missed' || status === 'weak') missedItems.push(item);
                    if (status === 'special' || status === 'strong') specialItems.push(item);
                    // 'normal' 和 'stuck' 不進入 missedItems/specialItems
                });

                // 直接覆蓋相容欄位，不檢查差異
                entry.missedItems = missedItems;
                entry.specialItems = specialItems;
                itemStatesFixed++;
                entryRepaired = true;
                console.log(`✅ Entry ${index}: 重建 itemStates 相容性`);
                console.log(`   missedItems: ${JSON.stringify(missedItems)}`);
                console.log(`   specialItems: ${JSON.stringify(specialItems)}`);
            }

            if (entryRepaired) {
                repairedCount++;
            }
        });

        // 儲存修復結果
        if (repairedCount > 0) {
            this.saveToStorage();
            this.renderEntries();

            // 顯示修復統計
            console.log('📊 修復統計：');
            console.table({
                '修復的 Entry 數量': repairedCount,
                'Completion 缺失修復': completionFixed,
                'ItemStates 同步修復': itemStatesFixed
            });

            this.showToast(`資料品質已整理完成！修復了 ${repairedCount} 筆紀錄`);

            // 建議執行檢查驗證結果
            console.log('💡 建議執行 window.debugDataQuality() 驗證修復結果');
        } else {
            console.log('✅ 資料品質良好，無需修復');
            this.showToast('資料品質已是最新狀態！');
        }

        return {
            repairedEntries: repairedCount,
            completionFixed: completionFixed,
            itemStatesFixed: itemStatesFixed
        };
    }
}

// CSS 動畫定義
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;

// 將清除 onboarding 功能加到全域，方便測試
window.clearOnboarding = function() {
    const app = window.climbingApp;
    if (app) {
        app.clearOnboardingRecord();
    } else {
        console.log('App not found');
    }
};

window.forceOnboarding = function() {
    const app = window.climbingApp;
    if (app) {
        app.forceShowOnboarding();
    } else {
        console.log('App not found');
    }
};

// TODO: 確認 debugMessageSystem 是否為正式功能或測試代碼，考慮整理此區塊
// === DEV ONLY: 診斷函式 ===
window.debugMessageSystem = function() {
    console.log('=== 留言系統診斷報告 ===');

    const app = window.climbingApp;
    const diagnostics = {
        // 1. 基本狀態
        currentUser: app ? app.currentUser : 'APP_NOT_FOUND',
        entriesLength: app ? app.entries.length : 'APP_NOT_FOUND',

        // 2. localStorage 狀態
        onboardingKeys: {
            owner: localStorage.getItem('climbingMessageOnboardingSeen_owner'),
            tester: localStorage.getItem('climbingMessageOnboardingSeen_tester')
        },

        // 3. HTML 元素存在性
        messageIcon: document.getElementById('messageIcon'),
        onboardingModal: document.getElementById('onboardingModal'),
        messagePanel: document.getElementById('messagePanel'),

        // 4. 元素顯示狀態
        messageIconDisplay: document.getElementById('messageIcon')?.style.display,
        onboardingModalDisplay: document.getElementById('onboardingModal')?.style.display,

        // 5. 函式存在性
        forceOnboardingExists: typeof window.forceOnboarding === 'function',
        clearOnboardingExists: typeof window.clearOnboarding === 'function',

        // 6. App 方法存在性
        showOnboardingExists: app && typeof app.showOnboarding === 'function',
        checkFirstTimeOnboardingExists: app && typeof app.checkFirstTimeOnboarding === 'function'
    };

    // 7. 嘗試手動 showOnboarding
    let showOnboardingResult = 'FAILED';
    try {
        if (app && app.showOnboarding) {
            app.showOnboarding();
            showOnboardingResult = 'SUCCESS';
            // 立即隱藏避免干擾
            setTimeout(() => {
                if (app.hideOnboarding) app.hideOnboarding();
            }, 1000);
        }
    } catch (error) {
        showOnboardingResult = 'ERROR: ' + error.message;
    }

    // 8. 檢查 console 錯誤（查看是否有 error 記錄）
    const hasConsoleErrors = window.console && window.console.error && window.console.error.length > 0;

    // 診斷結果
    console.log('1. CurrentUser:', diagnostics.currentUser);
    console.log('2. Entries Length:', diagnostics.entriesLength);
    console.log('3. Onboarding Keys:', diagnostics.onboardingKeys);
    console.log('4. MessageIcon exists:', !!diagnostics.messageIcon);
    console.log('5. OnboardingModal exists:', !!diagnostics.onboardingModal);
    console.log('6. ForceOnboarding exists:', diagnostics.forceOnboardingExists);
    console.log('7. Manual showOnboarding:', showOnboardingResult);
    console.log('8. MessageIcon display:', diagnostics.messageIconDisplay);
    console.log('9. Console errors detected:', hasConsoleErrors);

    // 問題判斷
    let problemAnalysis = [];

    if (!app) {
        problemAnalysis.push('❌ CRITICAL: App 未初始化 - window.climbingApp 不存在');
    } else {
        if (!diagnostics.messageIcon) {
            problemAnalysis.push('❌ HTML 問題: messageIcon 元素不存在');
        } else if (diagnostics.messageIconDisplay === 'none' && diagnostics.currentUser !== 'guest') {
            problemAnalysis.push('⚠️  顯示問題: messageIcon 被隱藏但用戶不是 guest');
        }

        if (!diagnostics.onboardingModal) {
            problemAnalysis.push('❌ HTML 問題: onboardingModal 元素不存在');
        }

        if (diagnostics.onboardingKeys.tester === 'true' || diagnostics.onboardingKeys.owner === 'true') {
            problemAnalysis.push('⚠️  狀態問題: onboarding 已經看過，需清除記錄重測');
        }

        if (diagnostics.entriesLength !== 1 && diagnostics.currentUser !== 'APP_NOT_FOUND') {
            problemAnalysis.push('⚠️  邏輯問題: entries.length = ' + diagnostics.entriesLength + ', 不是 1');
        }

        if (showOnboardingResult.includes('ERROR')) {
            problemAnalysis.push('❌ JS 錯誤: showOnboarding 執行失敗 - ' + showOnboardingResult);
        } else if (showOnboardingResult === 'FAILED') {
            problemAnalysis.push('❌ 方法問題: showOnboarding 方法不存在');
        }
    }

    if (problemAnalysis.length === 0) {
        problemAnalysis.push('✅ 基本檢查通過，可能是觸發條件或時機問題');
    }

    console.log('\n10. 最可能問題點:');
    problemAnalysis.forEach(problem => console.log('   ', problem));

    console.log('\n=== 建議修正步驟 ===');
    if (diagnostics.onboardingKeys.tester === 'true') {
        console.log('1. 執行 clearOnboarding() 清除記錄');
        console.log('2. 重新新增並儲存第一筆資料');
    } else if (showOnboardingResult === 'SUCCESS') {
        console.log('1. modal 可以顯示，檢查觸發條件邏輯');
        console.log('2. 確認 entries.length 和 currentUser 是否正確');
    } else {
        console.log('1. 檢查 HTML 結構和 JS 初始化');
        console.log('2. 查看 console 是否有載入錯誤');
    }

    return diagnostics;
};

document.head.appendChild(style);

// 全域測試函式：切換用戶身份
window.switchToUser = function(userType) {
    if (window.climbingApp) {
        window.climbingApp.setCurrentUser(userType);
        window.climbingApp.loadFromStorage();
        window.climbingApp.renderEntries();
        console.log(`✅ 已切換到 ${userType} 身份`);
    } else {
        console.log('❌ climbingApp 尚未初始化');
    }
};

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    window.climbingApp = new ClimbingTrainingJournal();
});

// 防止意外關閉頁面時遺失未儲存的資料
window.addEventListener('beforeunload', (e) => {
    const form = document.getElementById('entryForm');
    if (form.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = '';
    }
});