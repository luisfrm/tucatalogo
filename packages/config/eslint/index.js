import globals from "globals";
import tseslint from "typescript-eslint";

const SOURCE_FILES = ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.react-router/**",
      "**/.wrangler/**",
      "**/.mf/**",
      "**/coverage/**",
      "**/worker-configuration.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  {
    files: SOURCE_FILES,
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": "off",
    },
  },
  {
    files: ["**/*.cjs", "scripts/**/*.{js,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
