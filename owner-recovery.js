import { createHmac, randomInt, randomBytes, timingSafeEqual, scrypt as derive } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';

const scrypt = promisify(derive);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
export const ownerEmail = () => normalize(process.env.OWNER_EMAIL);
export const recoveryEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.RECOVERY_FROM_EMAIL);

const hashCode = (id, code) => createHmac('sha256', process.env.RESEND_API_KEY).update(id + ':' + code).digest();

async function sendCode(email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: process.env.RECOVERY_FROM_EMAIL,
      to: [email],
      subject: 'Relay owner password reset',
      text: `Your Relay password reset code is ${code}. It expires in 10 minutes. If you did not request a code, you can ignore this email.`
    }),
    signal: AbortSignal.timeout(8000)
  });
  await response.body?.cancel();
  if (!response.ok) throw Error('Mail provider rejected the request.');
}

export async function recover(request, path, readBody, invalid) {
  const input = await readBody(request);
  const email = normalize(input?.email);
  if (!emailPattern.test(email) || email.length > 254) invalid('Enter a valid email address.');
  if (!recoveryEnabled()) throw Object.assign(Error('Email recovery is unavailable. Contact the person who manages the deployment.'), {status:503});
  if (path.endsWith('/request')) {
    const id = randomBytes(16).toString('hex');
    const code = String(randomInt(100_000_000)).padStart(8, '0');
    const {rows} = await pool.query(`
      INSERT INTO owner_recovery(owner_id, request_id, code_hash, expires_at, next_request)
      SELECT id,$2,$3,NOW()+INTERVAL '10 minutes',NOW()+INTERVAL '1 minute' FROM users WHERE id=1 AND email=$1
      ON CONFLICT(owner_id) DO UPDATE SET request_id=EXCLUDED.request_id,code_hash=EXCLUDED.code_hash,
      expires_at=EXCLUDED.expires_at,next_request=EXCLUDED.next_request,attempts=0
      WHERE owner_recovery.next_request<=NOW()
      RETURNING request_id`, [email, id, hashCode(id, code)]);
    if (rows.length) {
      try { await sendCode(email, code); }
      catch { console.error('Owner password recovery email could not be sent. Check the mail provider configuration.'); }
    }
    return {ok:true};
  }

  const {code, password} = input;
  if (typeof code !== 'string' || !/^\d{8}$/.test(code) ||
      typeof password !== 'string' || password.length < 12 || password.length > 128) {
    invalid('Enter the 8-digit code and a password of 12–128 characters.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = (await client.query('SELECT id FROM users WHERE id=1 AND email=$1 FOR UPDATE', [email])).rows[0];
    const challenge = user && (await client.query(`
      SELECT request_id, code_hash FROM owner_recovery
      WHERE owner_id=1 AND expires_at>NOW() AND attempts<5 FOR UPDATE`)).rows[0];
    const matches = challenge && timingSafeEqual(challenge.code_hash, hashCode(challenge.request_id, code));
    if (matches) {
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      await client.query('UPDATE users SET password_hash=$1,salt=$2 WHERE id=1', [hash, salt]);
      await client.query('DELETE FROM owner_recovery WHERE owner_id=1');
      await client.query('DELETE FROM sessions');
    } else if (challenge) {
      await client.query('UPDATE owner_recovery SET attempts=attempts+1 WHERE owner_id=1');
    }
    await client.query('COMMIT');
    return {ok:Boolean(matches)};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
