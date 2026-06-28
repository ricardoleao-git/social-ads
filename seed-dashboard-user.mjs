import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const PASSWORD = process.env.ADMIN_SEED_PASSWORD;
// E-mails dos admins, separados por vírgula. Ex: ADMIN_SEED_EMAILS="a@x.com,b@y.com"
const EMAILS = (process.env.ADMIN_SEED_EMAILS || "")
  .split(",")
  .map(e => e.trim())
  .filter(Boolean);
const NAME = process.env.ADMIN_SEED_NAME || "Admin";

if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido no .env");
  process.exit(1);
}
if (!PASSWORD) {
  console.error("ADMIN_SEED_PASSWORD não definido. Defina-o no .env antes de rodar o seed.");
  process.exit(1);
}
if (EMAILS.length === 0) {
  console.error('ADMIN_SEED_EMAILS não definido. Ex: ADMIN_SEED_EMAILS="admin@empresa.com"');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL + "&ssl=true");
  try {
    const hash = await bcrypt.hash(PASSWORD, 12);

    for (const email of EMAILS) {
      const [existing] = await connection.execute(
        "SELECT id FROM dashboard_users WHERE email = ?",
        [email]
      );
      if (existing.length > 0) {
        await connection.execute(
          "UPDATE dashboard_users SET password_hash = ?, role = 'admin', active = 1 WHERE email = ?",
          [hash, email]
        );
        console.log(`✅ Senha atualizada para ${email} (admin)`);
      } else {
        await connection.execute(
          "INSERT INTO dashboard_users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)",
          [NAME, email, hash]
        );
        console.log(`✅ Usuário ${email} criado como admin`);
      }
    }

    const [all] = await connection.execute(
      "SELECT id, name, email, role, active, createdAt FROM dashboard_users ORDER BY id"
    );
    console.log("\n📋 Usuários na tabela dashboard_users:");
    console.table(all);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
