// ESLint for the server.
//
// Named .mjs on purpose: this package is CommonJS ("type": "commonjs"), so a
// plain eslint.config.js would be loaded as CommonJS and these imports would
// fail. The .mjs extension forces it to load as a module regardless.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,

      // Express error handlers must declare all four arguments to be recognised
      // as error handlers, even though `next` goes unused. Same for any argument
      // deliberately named with a leading underscore.
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_|^next$", varsIgnorePattern: "^_" },
      ],

      // Catches `if (user = null)` — an assignment where a comparison was meant.
      "no-cond-assign": "error",

      // An async function whose promise nobody awaits fails silently.
      "require-atomic-updates": "warn",
    },
  },
];
