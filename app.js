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

// 身份配置
const IDENTITY_CONFIG = {
    owner: {
        name: "Xavier",
        username: "Xavier",
        password: "19990930",
        displayName: "👨‍💻 開發者",
        firebasePrefix: "demo_owner"
    },
    tester: {
        name: "Alice",
        username: "Alice",
        password: "20260515",
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

// 攀岩訓練日記 - 功能邏輯
class ClimbingTrainingJournal {
    constructor() {
        // 初始化身份系統
        this.currentUser = null;
        this.showAllMessages = false;
        this.newMessageTimestamps = [];
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

        this.entries = [];
        this.trainingTemplates = this.initializeTemplates();
        this.program8Week = this.initialize8WeekProgram();
        this.programsByType = this.initializeProgramsByType();
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

        if (oldEntries || oldPrograms) {
            console.log('遷移舊資料到 owner 帳號...');

            if (oldEntries) {
                localStorage.setItem('climbingTrainingEntries_owner', oldEntries);
                localStorage.removeItem('climbingTrainingEntries');
            }

            if (oldPrograms) {
                localStorage.setItem('climbingPrograms_owner', oldPrograms);
                localStorage.removeItem('climbingPrograms');
            }

            // 設定為 owner 用戶
            localStorage.setItem('currentUser', 'owner');

            console.log('資料遷移完成');
        }
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

        // 驗證對話框事件
        const authSubmit = document.getElementById('authSubmit');
        const authCancel = document.getElementById('authCancel');

        if (authSubmit) {
            authSubmit.addEventListener('click', () => this.handleAuthSubmit());
        }

        if (authCancel) {
            authCancel.addEventListener('click', () => this.hideAuthDialog());
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

            // 清空輸入框
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';

            dialog.style.display = 'flex';
            dialog.dataset.identity = identity;

            // 聚焦到第一個輸入框
            if (usernameInput) usernameInput.focus();
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
    handleAuthSubmit() {
        const dialog = document.getElementById('authDialog');
        const identity = dialog.dataset.identity;
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value.trim();

        if (this.validateIdentity(identity, username, password)) {
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
            this.showToast('代碼錯誤，請重試');
            // 清空密碼框
            document.getElementById('authPassword').value = '';
        }
    }

    // 驗證身份
    validateIdentity(identity, username, password) {
        const config = IDENTITY_CONFIG[identity];
        if (!config || config.noAuth) return false;

        return config.username === username && config.password === password;
    }

    // 設定當前用戶
    setCurrentUser(identity) {
        this.currentUser = identity;
        localStorage.setItem('currentUser', identity);
        this.userId = this.getUserIdForFirebase();
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
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            this.entries = [];
        }
    }

    // 載入 Programs
    loadPrograms() {
        try {
            const key = this.getStorageKey('climbingPrograms');
            const storage = this.getStorage();
            const stored = storage.getItem(key);
            return JSON.parse(stored || '[]');
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
            { day: 5, title: "攀岩整合日", template: "climbing_integration" },
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

    // 建立正規化的預設Programs（來源：8週課表 + 訓練模板）
    initializeProgramsByType() {
        // 先嘗試從 localStorage 載入
        const savedPrograms = this.loadPrograms();
        if (savedPrograms.length > 0) {
            // 將 programs 轉為舊格式以保持相容性
            return this.convertProgramsToOldFormat(savedPrograms);
        }

        // 固定的 5 個預設 Programs（基於既有8週課表 + 訓練模板）
        const defaultPrograms = [
            {
                id: "program_core",
                name: "核心",
                type: "功能訓練",
                category: "核心",
                items: ["核心穩定", "張力傳導", "抗旋轉", "呼吸控制"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_shoulder",
                name: "肩胛穩定",
                type: "功能訓練",
                category: "肩胛穩定",
                items: ["肩胛控制", "拉力", "lock off", "張力"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_leg",
                name: "單腳踩點",
                type: "功能訓練",
                category: "單腳踩點",
                items: ["單腳穩定", "重心轉移", "高腳", "壓腳"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_climbing_tech",
                name: "攀岩技術",
                type: "攀岩",
                category: "攀岩",
                items: ["腳法", "節奏", "silent feet", "route reading"],
                createdAt: new Date().toISOString()
            },
            {
                id: "program_climbing_integration",
                name: "攀岩整合",
                type: "攀岩",
                category: "攀岩",
                items: ["movement整合", "耐力", "策略", "心理"],
                createdAt: new Date().toISOString()
            }
        ];

        // 儲存預設 programs 到 localStorage
        this.savePrograms(defaultPrograms);

        // 返回舊格式以保持相容性
        return this.convertProgramsToOldFormat(defaultPrograms);
    }

    // 載入 Programs 從 localStorage
    loadPrograms() {
        const stored = localStorage.getItem('climbingPrograms');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (error) {
                console.error('載入 Programs 時發生錯誤:', error);
            }
        }
        return [];
    }

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
                result[program.type].push({
                    name: program.name,
                    items: program.items,
                    id: program.id, // 保留 id 供查找使用（現在是字串格式）
                    category: program.category
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

    // 刪除自訂 Program
    deleteProgram(programId) {
        // 檢查 1: 是否為自訂 Program
        if (!programId || !programId.startsWith('program_custom_')) {
            alert('只能刪除自訂 Program，不能刪除預設 Program');
            return false;
        }

        // 檢查 2: 是否已被使用
        if (this.isProgramInUse(programId)) {
            alert('此 Program 已有紀錄，暫不建議刪除。');
            return false;
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
                name: '🟢 單腳穩定 × 採點日',
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
                name: '🧗 攀岩整合日',
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
        // 新增紀錄按鈕
        document.getElementById('newEntry').addEventListener('click', () => {
            this.showForm();
        });

        // 匯出 CSV 按鈕
        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportToCSV();
        });

        // 匯出 JSON 按鈕
        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportToJSON();
        });

        // 清除所有資料按鈕
        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllData();
        });

        // 表單提交
        document.getElementById('trainingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

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

        // 滑桿值即時更新
        this.setupSliders();

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
        conditionSelect.addEventListener('change', () => {
            this.updateScheduleDisplay();
        });

        // 套用課表按鈕
        applyScheduleBtn.addEventListener('click', () => {
            this.applyScheduleToForm();
        });
    }

    // 設定收合功能事件
    setupCollapsibleEvents() {
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

        collapsibleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                const content = section.querySelector('.collapsible-content');
                const toggleHint = header.querySelector('.toggle-hint');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggleHint.textContent = '(點擊收起)';
                    section.style.opacity = '1';
                } else {
                    content.style.display = 'none';
                    toggleHint.textContent = '(點擊展開)';
                    section.style.opacity = '0.7';
                }
            });
        });
    }

    // 設定簡化Daily Journal事件
    setupSimplifiedJournalEvents() {
        // 訓練類型變化監聽
        const trainingTypeRadios = document.querySelectorAll('input[name="trainingType"]');
        trainingTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateProgramOptions(e.target.value);
                this.clearItemStatusList();
            });
        });

        // Program選擇變化監聽
        const programSelect = document.getElementById('programSelect');
        if (programSelect) {
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
        if (programBuilderForm) {
            programBuilderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProgramBuilderSubmit();
            });
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
        if (deleteCustomProgramBtn) {
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

        const selectedProgramId = deleteProgramSelect.value;
        if (!selectedProgramId) {
            alert('請選擇要刪除的 Program');
            return;
        }

        const success = this.deleteProgram(selectedProgramId);
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
                const optionText = isInUse ? `${program.name} (已使用)` : program.name;
                const disabled = isInUse ? 'disabled' : '';

                deleteProgramSelect.innerHTML += `<option value="${program.id}" ${disabled}>${optionText}</option>`;
            });
        }
    }

    // 更新Program選項
    updateProgramOptions(trainingType) {
        const programSelect = document.getElementById('programSelect');
        if (!programSelect || !this.programsByType[trainingType]) return;

        const programs = this.programsByType[trainingType];
        programSelect.innerHTML = '<option value="">請選擇Program</option>' +
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
    generateItemStatusList(programName, trainingType) {
        const programs = this.programsByType[trainingType];
        const program = programs.find(p => p.name === programName);
        if (!program) return;

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
                        <span class="status-text">⚠️ 弱項</span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="item-${item}" value="strong">
                        <span class="status-text">💪 強項</span>
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
                    <h4>💪 強項</h4>
                    <p>${grouped.strong.join(', ')}</p>
                </div>`;
            }

            if (grouped.weak.length > 0) {
                html += `<div class="entry-section">
                    <h4>⚠️ 弱項</h4>
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

        // 重置表單
        document.getElementById('trainingForm').reset();
        this.setTodayDate();

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
        document.getElementById('entryForm').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 處理表單提交
    handleFormSubmit() {
        const formData = this.getFormData();

        // 檢查是否已有同日期的紀錄
        console.log('[Duplicate Check]', {
            currentUser: this.currentUser,
            formDate: formData.date,
            entriesLength: this.entries.length,
            entryDates: this.entries.map(e => e.date),
            entries: this.entries
        });
        const existingIndex = this.entries.findIndex(entry => entry.date === formData.date);

        if (existingIndex !== -1) {
            if (confirm('該日期已有紀錄，是否要覆蓋？')) {
                this.entries[existingIndex] = formData;
            } else {
                return;
            }
        } else {
            this.entries.push(formData);
        }

        // 按日期排序 (最新的在前面)
        this.entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.saveToStorage();
        this.renderEntries();
        this.hideForm();

        // 顯示成功訊息
        this.showToast('紀錄已儲存！');

        // 顯示陪伴訊息
        this.showJournalCompanionMessage(formData.todayCondition, this.entries.length);

        // 檢查是否需要顯示 onboarding
        setTimeout(() => {
            this.checkFirstTimeOnboarding();
        }, 500);
    }

    // 取得表單資料
    getFormData() {
        // 收集item狀態
        const itemStates = {};
        const itemRadios = document.querySelectorAll('input[type="radio"]:checked');
        itemRadios.forEach(radio => {
            if (radio.name.startsWith('item-')) {
                const itemName = radio.name.replace('item-', '');
                itemStates[itemName] = radio.value;
            }
        });

        // 為相容性轉換為舊格式（將新的weak/strong映射到舊的missed/special）
        const missedItems = [];
        const specialItems = [];
        Object.entries(itemStates).forEach(([item, status]) => {
            if (status === 'missed' || status === 'weak') missedItems.push(item);
            if (status === 'special' || status === 'strong') specialItems.push(item);
        });

        // 取得選中的 Program 資訊
        const selectedProgramName = document.getElementById('programSelect').value;
        let programId = null;
        let programCategory = '';

        if (selectedProgramName) {
            const program = this.findProgramByName(selectedProgramName);
            if (program) {
                programId = program.id;
                programCategory = program.category;
            }
        }

        return {
            date: document.getElementById('date').value,
            todayCondition: document.getElementById('todayCondition').value,
            trainingType: document.querySelector('input[name="trainingType"]:checked')?.value || '',
            program: selectedProgramName,
            completion: document.querySelector('input[name="completion"]:checked')?.value || '',

            // 新的 Program 相關欄位
            programId: programId,
            programName: selectedProgramName,
            programCategory: programCategory,

            // 新的item狀態結構
            itemStates: itemStates,

            // 相容性欄位
            missedItems: missedItems,
            specialItems: specialItems,
            movementNotes: document.getElementById('movementNotes').value,

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
                    <p>點擊「新增今日紀錄」開始記錄你的攀岩訓練 movement 觀察</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.entries.map((entry, index) =>
            this.createEntryCard(entry, index)
        ).join('');

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
            <div class="entry-card">
                <button class="delete-btn" title="刪除此紀錄">🗑️</button>
                <div class="entry-header">
                    <div class="entry-date">${this.currentUser !== 'guest'
                        ? `第 ${this.entries.length - index} 次紀錄 · ${formattedDate}`
                        : `📅 ${formattedDate}`
                    }</div>
                </div>

                ${entry.todayCondition ? `
                <div class="entry-section">
                    <h4>⚡ 今日狀態</h4>
                    <p>${this.getConditionDisplayText(entry.todayCondition)}</p>
                </div>
                ` : ''}

                ${entry.trainingType ? `
                <div class="entry-section">
                    <h4>🎯 訓練類型</h4>
                    <p>${entry.trainingType === '攀岩' ? '🧗 攀岩' : '💪 功能訓練'}</p>
                </div>
                ` : ''}

                ${entry.program ? `
                <div class="entry-section">
                    <h4>📋 Program</h4>
                    <p>${entry.program}</p>
                </div>
                ` : ''}

                ${entry.completion ? `
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

                <!-- 保留舊資料顯示以保持相容性 -->
                ${entry.mainTraining && !entry.trainingType ? `
                <div class="entry-section">
                    <h4>🎯 今日主訓練</h4>
                    <p>${entry.mainTraining}</p>
                </div>
                ` : ''}

                ${(() => {
                    const hasLegacyBodyState = entry.coreState || entry.legState || entry.shoulderState;
                    return hasLegacyBodyState ? `
                <div class="entry-section">
                    <h4>🧠 今日體感</h4>
                    <p>🔵 核心傳導: <span class="${this.getStatusClass(entry.coreState)}">${entry.coreState || '未填'}</span></p>
                    <p>🟢 單腳穩定: <span class="${this.getStatusClass(entry.legState)}">${entry.legState || '未填'}</span></p>
                    <p>🔴 肩胛穩定: <span class="${this.getStatusClass(entry.shoulderState)}">${entry.shoulderState || '未填'}</span></p>
                    <p>😴 疲勞狀態: ${entry.fatigue}/10</p>
                </div>
                ` : '';
                })()}

                ${entry.exercises ? `
                <div class="entry-section">
                    <h4>💪 訓練內容</h4>
                    <p>${this.formatText(entry.exercises)}</p>
                    <p>RPE: ${entry.rpe}/10 | 品質: ${entry.quality}/10</p>
                    <p>轉移感: ${entry.transfer}</p>
                </div>
                ` : ''}

                ${entry.nextDayFeeling ? `
                <div class="entry-section">
                    <h4>🌙 隔天體感</h4>
                    <p>${this.formatText(entry.nextDayFeeling)}</p>
                </div>
                ` : ''}

                ${entry.notes ? `
                <div class="entry-section">
                    <h4>📝 備註</h4>
                    <p>${this.formatText(entry.notes)}</p>
                </div>
                ` : ''}

                ${this.currentUser === 'owner' && entry.todayCondition ? `
                <div class="entry-system-echo">
                    ${this.getEntrySystemEcho(entry.todayCondition)}
                </div>
                ` : ''}
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
        if (confirm('確定要清除所有訓練紀錄嗎？此操作無法復原！')) {
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
        const filename = `攀岩訓練日記_${new Date().toISOString().split('T')[0]}.csv`;

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
        const filename = `攀岩訓練日記_${new Date().toISOString().split('T')[0]}.json`;

        this.downloadFile(blob, filename);
        this.showToast('JSON 檔案已匯出');
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

    checkFirstTimeOnboarding() {
        console.log('[CheckFirstTimeOnboarding]', {
            currentUser: this.currentUser,
            entriesLength: this.entries.length,
            onboardingKey: 'climbingMessageOnboardingSeen_' + this.currentUser,
            alreadySeen: localStorage.getItem('climbingMessageOnboardingSeen_' + this.currentUser)
        });

        if (this.entries.length === 1 &&
            this.currentUser !== 'guest' &&
            !localStorage.getItem('climbingMessageOnboardingSeen_' + this.currentUser)) {

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