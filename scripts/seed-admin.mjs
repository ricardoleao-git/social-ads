import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME || "Admin";

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definido no .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("❌ Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD no .env");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const hash = await bcrypt.hash(password, 12);

await connection.execute(
  `INSERT INTO dashboard_users (name, email, password_hash, role, active, createdAt, updatedAt)
   VALUES (?, ?, ?, 'admin', 1, NOW(), NOW())
   ON DUPLICATE KEY UPDATE
     name = VALUES(name),
     password_hash = VALUES(password_hash),
     role = 'admin',
     active = 1,
     updatedAt = NOW()`,
  [name, email, hash]
);

console.log(`✅ Admin criado/atualizado: ${email}`);
await connection.end();
