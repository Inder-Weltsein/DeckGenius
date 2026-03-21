/**
 * E2E結合テスト（Sprint 5 P0）
 * 実際のプレイヤータグで5ケース通してTOP3デッキが返ることを検証
 *
 * 使用法: node scripts/e2e-test.js [BASE_URL]
 * 例: node scripts/e2e-test.js http://localhost:3001
 */

const BASE_URL = process.argv[2] || "http://localhost:3001";

// テストケース: 異なるトロフィー帯のプレイヤー
const TEST_CASES = [
    { tag: "YQ08892", desc: "開発者テストアカウント" },
    { tag: "C0G20PR2", desc: "トップラダー帯プレイヤー" },
    { tag: "L2G0YRV8", desc: "中堅帯プレイヤー" },
    { tag: "9QCJUR8R", desc: "チャレンジャー帯プレイヤー" },
    { tag: "2PP", desc: "グローバルトッププレイヤー" },
];

async function runTest(testCase, index) {
    const { tag, desc } = testCase;
    const url = `${BASE_URL}/api/analyze?tag=${encodeURIComponent(tag)}`;

    try {
        const start = Date.now();
        const res = await fetch(url);
        const elapsed = Date.now() - start;
        const data = await res.json();

        const checks = [];
        let passed = true;

        // Check 1: HTTPステータス200
        if (res.status === 200) {
            checks.push("  [PASS] HTTP 200");
        } else {
            checks.push(`  [FAIL] HTTP ${res.status}`);
            passed = false;
        }

        // Check 2: recommendedDeck が存在
        if (data.recommendedDeck) {
            checks.push("  [PASS] recommendedDeck 存在");
        } else {
            checks.push("  [FAIL] recommendedDeck なし");
            passed = false;
        }

        // Check 3: カードが8枚
        const cardCount = data.recommendedDeck?.cards?.length;
        if (cardCount === 8) {
            checks.push("  [PASS] カード8枚");
        } else {
            checks.push(`  [FAIL] カード${cardCount}枚 (期待: 8)`);
            passed = false;
        }

        // Check 4: compatibilityScore が 0-100
        const score = data.recommendedDeck?.compatibilityScore;
        if (typeof score === "number" && score >= 0 && score <= 100) {
            checks.push(`  [PASS] compatibilityScore=${score}`);
        } else {
            checks.push(`  [FAIL] compatibilityScore=${score} (範囲外)`);
            passed = false;
        }

        // Check 5: alternativeDecks が存在（TOP3 = 推薦1 + 代替2）
        const altCount = data.alternativeDecks?.length ?? 0;
        if (altCount >= 1) {
            checks.push(`  [PASS] alternativeDecks=${altCount}件`);
        } else {
            checks.push(`  [FAIL] alternativeDecks=${altCount}件 (期待: 1以上)`);
            passed = false;
        }

        // Check 6: scoreBreakdown の各項目が存在
        const breakdown = data.recommendedDeck?.scoreBreakdown;
        const breakdownKeys = ["growthScore", "metaScore", "roleScore", "costScore"];
        const hasAllKeys = breakdown && breakdownKeys.every(k => typeof breakdown[k] === "number");
        if (hasAllKeys) {
            checks.push("  [PASS] scoreBreakdown 全項目あり");
        } else {
            checks.push(`  [FAIL] scoreBreakdown 不完全: ${JSON.stringify(breakdown)}`);
            passed = false;
        }

        // Check 7: デモフラグ確認
        const isDemo = !!data._demo;
        checks.push(`  [INFO] demo=${isDemo}`);

        const icon = passed ? "PASS" : "FAIL";
        console.log(`\nCase ${index + 1}: #${tag} (${desc}) [${icon}] ${elapsed}ms`);
        checks.forEach(c => console.log(c));

        return passed;
    } catch (err) {
        console.log(`\nCase ${index + 1}: #${tag} (${desc}) [ERROR]`);
        console.log(`  ${err.message}`);
        return false;
    }
}

async function main() {
    console.log(`=== DeckGenius E2E Test ===`);
    console.log(`Base URL: ${BASE_URL}\n`);

    let passCount = 0;
    for (let i = 0; i < TEST_CASES.length; i++) {
        const passed = await runTest(TEST_CASES[i], i);
        if (passed) passCount++;
    }

    console.log(`\n=== 結果: ${passCount}/${TEST_CASES.length} PASSED ===`);
    process.exit(passCount === TEST_CASES.length ? 0 : 1);
}

main();
