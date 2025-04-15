import pluginJs from "@eslint/js";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest 
      }
    }
  },
  // Add this new configuration object for k6 load test files
  {
    files: ["**/tests/load/*.mjs"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
        open: "readonly",
        sleep: "readonly"
      }
    }
  },
  pluginJs.configs.recommended
];