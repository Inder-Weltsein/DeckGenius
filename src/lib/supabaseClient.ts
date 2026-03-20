import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
// サーバーサイドではSERVICE_ROLE_KEYを優先（RLSをバイパス）
// クライアントサイドではNEXT_PUBLIC_プレフィックスのないキーは参照不可なのでanonキーにフォールバック
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder";

// Supabaseクライアントの初期化
export const supabase = createClient(supabaseUrl, supabaseKey);
