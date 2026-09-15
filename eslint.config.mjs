import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noSwallowedSupabaseError from "./eslint-rules/no-swallowed-supabase-error.mjs";

// 權限相關檔案：這些地方把查詢失敗吞掉，結果就是使用者被鎖在外面而且無從查起
// （實際發生過，見 eslint-rules/no-swallowed-supabase-error.mjs 的說明）。
// 只在這裡設成 error——全專案有 900 多處同樣寫法，全面套用只會變成沒人看的警告。
const AUTH_CRITICAL_FILES = [
  "src/middleware.ts",
  "src/lib/auth/**/*.ts",
  "src/lib/marketing/company.ts",
  "src/lib/pos/auth.ts",
  "src/lib/module-access.ts",
  "src/app/**/layout.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: AUTH_CRITICAL_FILES,
    plugins: {
      "ai-gate": { rules: { "no-swallowed-supabase-error": noSwallowedSupabaseError } },
    },
    rules: { "ai-gate/no-swallowed-supabase-error": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
