import { initialize, pool } from '../db.js';
import { ownerEmail } from '../owner-recovery.js';
import { randomBytes, scryptSync } from 'node:crypto';

try {
  const email = ownerEmail();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw Error('Set OWNER_EMAIL to your own email in the hosting environment.');
  }
  if (!process.env.RESEND_API_KEY || !process.env.RECOVERY_FROM_EMAIL) {
    throw Error('Configure email recovery before provisioning the owner.');
  }
  await initialize();
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(randomBytes(32), salt, 64).toString('hex');
  const result = await pool.query(
    'INSERT INTO users VALUES(1,$1,$2,$3) ON CONFLICT DO NOTHING RETURNING id', [email, hash, salt]
  );
  if (!result.rowCount) throw Error('An owner already exists. Use password recovery with the registered email.');
  console.log('Owner created. Open the dashboard and use Forgot password to set your password.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
