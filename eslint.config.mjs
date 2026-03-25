import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ユーティリティスクリプト（CommonJS形式のため除外）
    "check_db.js",
    "scripts/**",
  ]),
  // カスタムルール設定
  {
    rules: {
      // _ プレフィックス付き変数は意図的な未使用パラメータとして許可
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
      }],
    },
  },
]);

export default eslintConfig;
