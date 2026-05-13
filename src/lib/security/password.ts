import bcrypt from "bcryptjs";

const HASH_ROUNDS = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
