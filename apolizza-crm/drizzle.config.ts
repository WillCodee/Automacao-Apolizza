import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  casing: "snake_case", // Mapear camelCase (código) → snake_case (banco)
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
