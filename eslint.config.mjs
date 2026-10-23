// Lint for the app and @fume/ui. Type errors and unused code are TypeScript's job (npm --prefix app run typecheck);
// this catches what the compiler cannot: the rules of hooks and likely mistakes.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist*/", "design-system/", "tokens/", "assets/", "rules/", "tools/gate/"] },
  {
    files: ["app/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TypeScript already reports these (noUnusedLocals, noUnusedParameters).
      "@typescript-eslint/no-unused-vars": "off",
      // A props interface that only extends a library's props is the house pattern.
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      // A variable a closure reads before its one assignment cannot be const.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  { files: ["tools/**/*.mjs", "eslint.config.mjs"], languageOptions: { globals: { ...globals.node } } },
);
