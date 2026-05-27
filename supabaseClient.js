// Supabase Client Setup - v0.2-CLOUD-4-1-Fix-2
// 只做連線測試，不接入 app.js 主流程
// 修正：移除 supabase 變數宣告，避免與 window.supabase CDN 衝突

// Supabase 設定 - 使用 anon public key (受 RLS 保護)
const SUPABASE_URL = 'https://nqhrdqowltoyajxlrvyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YpWYmNSBJNKywNS7H9gsUA_DQOVHH-3';

// 初始化 Supabase 連線
function initSupabaseClient() {
    try {
        // 檢查 Supabase CDN 是否已載入
        if (!window.supabase) {
            console.warn('Supabase CDN not loaded');
            return false;
        }

        // 建立 Supabase client
        window.climbingSupabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );

        console.log('✅ Supabase client 初始化成功');
        return true;

    } catch (error) {
        console.error('❌ Supabase client 初始化失敗:', error);
        return false;
    }
}

// 測試 Supabase 連線
window.testSupabaseConnection = async function() {
    console.log('🔗 開始測試 Supabase 連線...');

    try {
        // 初始化 client (如果還沒初始化)
        if (!window.climbingSupabaseClient) {
            const initSuccess = initSupabaseClient();
            if (!initSuccess) {
                throw new Error('Supabase client 初始化失敗');
            }
        }

        // 測試基本連線 - 簡單查詢 auth 狀態
        const { data: { session }, error } = await window.climbingSupabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        console.log('✅ Supabase 連線測試成功');
        console.log('📊 當前 Auth Session:', session ? '已登入' : '未登入');

        return {
            success: true,
            message: 'Supabase 連線正常',
            hasSession: !!session
        };

    } catch (error) {
        console.error('❌ Supabase 連線測試失敗:', error);

        return {
            success: false,
            message: '連線失敗: ' + error.message,
            error: error
        };
    }
};

// 測試 profiles 表查詢 (需要先登入才能查到資料)
window.testProfilesQuery = async function() {
    console.log('📋 開始測試 profiles 表查詢...');

    try {
        // 初始化 client (如果還沒初始化)
        if (!window.climbingSupabaseClient) {
            const initSuccess = initSupabaseClient();
            if (!initSuccess) {
                throw new Error('Supabase client 初始化失敗');
            }
        }

        // 嘗試查詢 profiles 表 (受 RLS 保護，未登入會回傳空陣列)
        const { data: profiles, error } = await window.climbingSupabaseClient
            .from('profiles')
            .select('username, display_name, role, created_at')
            .limit(5);

        if (error) {
            throw error;
        }

        console.log('✅ profiles 表查詢成功');
        console.log('📊 查詢結果:', profiles);
        console.log('📝 說明: 未登入時受 RLS 保護，只能看到空陣列或自己的資料');

        return {
            success: true,
            message: 'profiles 表查詢正常',
            profilesCount: profiles ? profiles.length : 0,
            data: profiles
        };

    } catch (error) {
        console.error('❌ profiles 表查詢失敗:', error);

        return {
            success: false,
            message: '查詢失敗: ' + error.message,
            error: error
        };
    }
};

// 顯示 Supabase client 資訊 (除錯用)
window.showSupabaseInfo = function() {
    console.log({
        hasSupabaseCDN: !!window.supabase,
        hasClient: !!window.climbingSupabaseClient,
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SUPABASE_PUBLISHABLE_KEY
    });
};

// === Supabase Auth 測試函式 (v0.2-CLOUD-4-2) ===

// 1. 登入測試函式
window.loginWithSupabase = async function(email, password) {
    console.log('🔐 開始測試 Supabase 登入...');

    try {
        // 檢查 client 是否已初始化
        if (!window.climbingSupabaseClient) {
            const initSuccess = initSupabaseClient();
            if (!initSuccess) {
                throw new Error('Supabase client 初始化失敗');
            }
        }

        // 執行登入 (不印出 password)
        const { data, error } = await window.climbingSupabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        console.log('✅ Supabase 登入成功');
        console.log('📊 使用者資訊:', data.user ? `ID: ${data.user.id}, Email: ${data.user.email}` : '無');

        return {
            success: true,
            userId: data.user?.id,
            email: data.user?.email
        };

    } catch (error) {
        console.error('❌ Supabase 登入失敗:', error.message);

        return {
            success: false,
            message: '登入失敗: ' + error.message,
            error: error
        };
    }
};

// 2. 取得當前 Profile 函式
window.getCurrentSupabaseProfile = async function() {
    console.log('👤 開始查詢當前 Supabase Profile...');

    try {
        // 檢查 client 是否已初始化
        if (!window.climbingSupabaseClient) {
            const initSuccess = initSupabaseClient();
            if (!initSuccess) {
                throw new Error('Supabase client 初始化失敗');
            }
        }

        // 取得當前 session
        const { data: { session }, error: sessionError } = await window.climbingSupabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session || !session.user) {
            return {
                success: false,
                message: '尚未登入'
            };
        }

        // 查詢 profiles 表
        const { data: profiles, error: profileError } = await window.climbingSupabaseClient
            .from('profiles')
            .select('username, display_name, role')
            .eq('id', session.user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        console.log('✅ Profile 查詢成功');
        console.log('📊 Profile 資訊:', profiles);

        return {
            success: true,
            userId: session.user.id,
            email: session.user.email,
            profile: profiles
        };

    } catch (error) {
        console.error('❌ Profile 查詢失敗:', error.message);

        return {
            success: false,
            message: 'Profile 查詢失敗: ' + error.message,
            error: error
        };
    }
};

// 3. 登出函式
window.logoutSupabase = async function() {
    console.log('🚪 開始 Supabase 登出...');

    try {
        // 檢查 client 是否已初始化
        if (!window.climbingSupabaseClient) {
            console.warn('⚠️ Supabase client 未初始化');
            return { success: false, message: 'Client 未初始化' };
        }

        // 執行登出
        const { error } = await window.climbingSupabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        console.log('✅ Supabase 登出成功');

        return {
            success: true,
            message: '登出成功'
        };

    } catch (error) {
        console.error('❌ Supabase 登出失敗:', error.message);

        return {
            success: false,
            message: '登出失敗: ' + error.message,
            error: error
        };
    }
};

// 4. 完整認證流程測試
window.testSupabaseAuthFlow = async function(email, password) {
    console.log('🔄 開始測試完整 Supabase Auth 流程...');

    try {
        // 步驟 1: 登入
        const loginResult = await window.loginWithSupabase(email, password);

        if (!loginResult.success) {
            return {
                login: loginResult,
                profile: null,
                overall: 'Login failed'
            };
        }

        // 步驟 2: 取得 Profile
        const profileResult = await window.getCurrentSupabaseProfile();

        console.log('🎯 完整流程測試結果:');
        console.log('- 登入:', loginResult.success ? '✅' : '❌');
        console.log('- Profile:', profileResult.success ? '✅' : '❌');

        return {
            login: loginResult,
            profile: profileResult,
            overall: (loginResult.success && profileResult.success) ? 'Success' : 'Partial failure'
        };

    } catch (error) {
        console.error('❌ Auth 流程測試失敗:', error.message);

        return {
            login: null,
            profile: null,
            overall: 'Test failed: ' + error.message
        };
    }
};

// 5. 顯示認證狀態
window.showSupabaseAuthStatus = async function() {
    console.log('📊 檢查 Supabase Auth 狀態...');

    try {
        // 檢查 client 是否已初始化
        if (!window.climbingSupabaseClient) {
            console.log('❌ Supabase client 未初始化');
            return;
        }

        // 取得當前 session
        const { data: { session }, error } = await window.climbingSupabaseClient.auth.getSession();

        if (error) {
            console.error('❌ 取得 session 失敗:', error.message);
            return;
        }

        if (!session) {
            console.log('📊 Auth 狀態:');
            console.log('- 登入狀態: ❌ 未登入');
            console.log('- User ID: 無');
            console.log('- Email: 無');
            return;
        }

        console.log('📊 Auth 狀態:');
        console.log('- 登入狀態: ✅ 已登入');
        console.log('- User ID:', session.user.id);
        console.log('- Email:', session.user.email);
        console.log('- 登入時間:', new Date(session.user.last_sign_in_at).toLocaleString());

    } catch (error) {
        console.error('❌ 檢查 Auth 狀態失敗:', error.message);
    }
};

// 當 DOM 載入完成後自動初始化 (不影響 app.js)
document.addEventListener('DOMContentLoaded', () => {
    // 延遲初始化，確保所有 script 都載入完成
    setTimeout(() => {
        initSupabaseClient();
        console.log('📱 Supabase Client Setup 完成');
        console.log('💡 基礎測試:');
        console.log('  window.testSupabaseConnection() - 測試連線');
        console.log('  window.testProfilesQuery() - 測試 profiles 查詢');
        console.log('  window.showSupabaseInfo() - 顯示連線資訊');
        console.log('💡 Auth 測試 (v0.2-CLOUD-4-2):');
        console.log('  window.loginWithSupabase("email", "password") - 登入測試');
        console.log('  window.getCurrentSupabaseProfile() - 取得當前 Profile');
        console.log('  window.logoutSupabase() - 登出測試');
        console.log('  window.testSupabaseAuthFlow("email", "password") - 完整流程');
        console.log('  window.showSupabaseAuthStatus() - 顯示 Auth 狀態');
    }, 100);
});