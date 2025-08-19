import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      ".env",
      ".env.local",
      ".env.production",
      "*.db",
      "*.sqlite",
      "*.log",
      "coverage/",
      "dist/",
      "build/",
      "check-schema.js",
      "reset-db.js"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-undef": "error",
      "prefer-const": "warn",
      "no-var": "warn",
      "semi": ["error", "always"],
      "quotes": ["warn", "single"],
      "indent": ["warn", 4],
      "no-trailing-spaces": "warn",
      "eol-last": "warn"
    }
  },
  {
    files: ["public/js/transaction-manager.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Global objects/managers - these are available globally but not redefined
        window: "readonly",
        // Toast notification functions
        showToast: "readonly",
        showSuccess: "readonly",
        showError: "readonly",
        showInfo: "readonly",
        showWarning: "readonly",
        // Transaction CRUD functions - defined in this file for global use
        filterTransactions: "writable",
        editIncomeTransaction: "writable",
        editExpenseTransaction: "writable",
        deleteIncomeTransaction: "writable",
        deleteExpenseTransaction: "writable",
        saveIncomeEdit: "writable",
        saveExpenseEdit: "writable",
        confirmDelete: "writable",
        closeEditIncomeModal: "writable",
        closeEditExpenseModal: "writable",
        closeDeleteModal: "writable"
      }
    }
  },
  {
    files: ["public/js/event-handlers.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Toast notification functions
        showToast: "readonly",
        showSuccess: "readonly",
        showError: "readonly",
        showInfo: "readonly", 
        showWarning: "readonly"
      }
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly"
      }
    }
  }
];
