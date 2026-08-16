import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", "data/", "dashboard/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
