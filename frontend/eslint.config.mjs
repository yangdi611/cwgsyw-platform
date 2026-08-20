import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/ui",
                "@/components/ui/*",
                "@/components/v2",
                "@/components/v2/*",
                "@/components/design-system",
                "@/components/design-system/*",
              ],
              message: "Business code must import UI primitives from @/design-system/figma-neutral/components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/components/design-system/**/*.{ts,tsx}",
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/v2/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test/**/*.cjs",
    "src/design-system/figma-neutral/**/*.cjs",
  ]),
]);

export default eslintConfig;
