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
    // Scripts temporários de migration/import/seed
    "scripts/migrate-*.ts",
    "scripts/import-*.ts",
    "scripts/seed-*.ts",
    "scripts/check-*.ts",
    "scripts/fetch-*.js",
  ]),
  {
    rules: {
      // Desabilitar regra muito restritiva que gera falsos positivos
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
