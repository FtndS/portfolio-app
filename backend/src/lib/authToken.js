import jwt from 'jsonwebtoken'

export function isTokenVersionValid(decodedTv, userTokenVersion) {
  return (decodedTv ?? 0) === (userTokenVersion ?? 0)
}

export function signAuthToken(userId, tokenVersion = 0) {
  return jwt.sign(
    { userId, tv: tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )
}
