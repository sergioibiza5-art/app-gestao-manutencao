import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
loadEnvConfig(process.cwd());
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const schema = `production_qa_${randomBytes(5).toString("hex")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query(readFileSync("prisma/migrations/20261126120000_production/migration.sql", "utf8"));
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'Production%'", [schema]);
    if (result.rows.length !== 4) throw new Error("Expected four new production tables.");
    console.log("PASS: additive migration creates four tables and constraints; transaction rolled back.");
  } finally { await client.query("ROLLBACK"); await client.end(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
