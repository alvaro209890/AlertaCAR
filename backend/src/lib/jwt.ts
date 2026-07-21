import bcrypt from 'bcrypt'
import jwt, { type SignOptions } from 'jsonwebtoken'
import config from './config.js'

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds)
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

const signOptions: SignOptions = {
  expiresIn: '7d' as unknown as number,
}

export function signToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload as object, config.jwtSecret, signOptions)
}

export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as any
  } catch {
    return null
  }
}
