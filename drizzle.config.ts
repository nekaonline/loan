import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same env files Next.js uses; the first file wins for each variable.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:123@127.0.0.1:5432/loan_db",
  },
});
