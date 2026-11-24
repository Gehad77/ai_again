import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';
import { ownerEmail } from './owner-recovery.js';

const scrypt = promisify(derive);
const codePattern = /^[A-Za-z0-9_-]{32,128}$/;
const digest = value => createHash('sha256').update(value).digest();
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const settings = () => ({email:ownerEmail(), code:process.env.OWNER_ACCESS_CODE ?? ''});

export async function adminRecoveryStatus(){
 const {email,code}=settings();
 if(!email||!code)return 'missing_settings';
 if(!validEmail(email))return 'invalid_email';
 if(!codePattern.test(code))return 'invalid_code';
 const result=await pool.query('SELECT 1 FROM used_owner_access_codes WHERE digest=$1',[digest(code)]);
 return result.rowCount?'used_code':'ready';
}

export async function resetWithAccessCode(input, invalid){
 const {email,code}=settings();
 const {accessCode,password}=input??{};
 if(typeof accessCode!=='string'||!codePattern.test(accessCode)||
    typeof password!=='string'||password.length<12||password.length>128){
  invalid('Enter the hosting recovery code and a password of 12–128 characters.');
 }
 const fingerprint=digest(code);
 if(!validEmail(email)||!codePattern.test(code)||!timingSafeEqual(fingerprint,digest(accessCode)))return false;
 const salt=randomBytes(16).toString('hex');
 const hash=(await scrypt(password,salt,64)).toString('hex');
 const token=randomBytes(32).toString('hex');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const used=await client.query('INSERT INTO used_owner_access_codes(digest) VALUES($1) ON CONFLICT DO NOTHING',[fingerprint]);
  if(used.rowCount){
   await client.query(`INSERT INTO users(id,email,password_hash,salt) VALUES(1,$1,$2,$3)
    ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,salt=EXCLUDED.salt`,[email,hash,salt]);
   await client.query('DELETE FROM owner_recovery WHERE owner_id=1');
   await client.query('DELETE FROM sessions');
   await client.query("INSERT INTO sessions VALUES($1,NOW()+INTERVAL '7 days')",[digest(token).toString('hex')]);
  }
  await client.query('COMMIT');
  return used.rowCount?token:null;
 }catch(error){
  await client.query('ROLLBACK');
  throw error;
 }finally{
  client.release();
 }
}
