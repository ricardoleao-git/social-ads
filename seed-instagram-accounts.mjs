/**
 * Seed script: insere as contas do Instagram no banco de dados
 * Execução: node seed-instagram-accounts.mjs
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const accounts = [
  {
    id: "instagram-zenite-tech",
    platform_id: "instagram",
    account_name: "Zênite Tech",
    account_handle: "@zenite.tech",
    external_id: "zenite.tech",
    is_active: true,
  },
  {
    id: "instagram-ricardo-leao",
    platform_id: "instagram",
    account_name: "Ricardo Leão",
    account_handle: "@ricardo_leao",
    external_id: "ricardo_leao",
    is_active: true,
  },
];

async function seed() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Conectado ao banco de dados.");

  for (const account of accounts) {
    try {
      await conn.execute(
        `INSERT INTO social_accounts (id, platform_id, account_name, account_handle, external_id, is_active, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           account_name = VALUES(account_name),
           account_handle = VALUES(account_handle),
           external_id = VALUES(external_id),
           is_active = VALUES(is_active)`,
        [
          account.id,
          account.platform_id,
          account.account_name,
          account.account_handle,
          account.external_id,
          account.is_active,
        ]
      );
      console.log(`✓ Conta inserida/atualizada: ${account.account_handle}`);
    } catch (err) {
      console.error(`✗ Erro ao inserir ${account.account_handle}:`, err.message);
    }
  }

  await conn.end();
  console.log("Seed concluído.");
}

seed().catch(console.error);
