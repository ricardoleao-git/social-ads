/**
 * Reseta (ou cria) a senha de um usuário admin no banco.
 * Uso: ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... node reset-admin-password.mjs
 */
import { createConnection } from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const email = process.env.ADMIN_SEED_EMAIL;
const newPassword = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME || "Admin";

if (!DATABASE_URL) {
  console.error("DATABASE_URL não encontrado no .env");
  process.exit(1);
}
if (!email || !newPassword) {
  console.error("Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD no .env");
  process.exit(1);
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  const [rows] = await conn.execute(
    "SELECT id, email, name, role, active FROM dashboard_users WHERE email = ?",
    [email]
  );
  const hash = await bcrypt.hash(newPassword, 12);

  if (!rows || rows.length === 0) {
    console.log(`Usuário ${email} não encontrado. Criando...`);
    await conn.execute(
      "INSERT INTO dashboard_users (name, email, password_hash, role, active, createdAt) VALUES (?, ?, ?, 'admin', 1, NOW())",
      [name, email, hash]
    );
    console.log(`✅ Usuário admin criado: ${email}`);
  } else {
    await conn.execute(
      "UPDATE dashboard_users SET password_hash = ?, active = 1 WHERE email = ?",
      [hash, email]
    );
    console.log(`✅ Senha resetada para: ${email}`);
  }
  await conn.end();
}

main().catch(console.error);
