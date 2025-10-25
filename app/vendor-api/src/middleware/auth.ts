/**
 * Cognito JWT Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { CognitoJwtPayload, AuthenticatedRequest } from '../types';

const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;
const cognitoRegion = process.env.COGNITO_REGION || 'ap-northeast-1';

if (!cognitoUserPoolId) {
  throw new Error('COGNITO_USER_POOL_ID environment variable is required');
}

const jwksUri = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

/**
 * Get signing key from JWKS
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err, undefined);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify Cognito JWT token
 */
export function verifyToken(token: string): Promise<CognitoJwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          return reject(new UnauthorizedError('Invalid token'));
        }
        resolve(decoded as CognitoJwtPayload);
      }
    );
  });
}

/**
 * Authentication middleware
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header missing or invalid');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = await verifyToken(token);

    // Attach user payload to request
    (req as AuthenticatedRequest).user = payload;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user belongs to a specific company
 */
export function requireCompanyAccess(companyId: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    const userCompanyId = parseInt(user['custom:company_id'], 10);
    if (userCompanyId !== companyId) {
      return next(new ForbiddenError('Access denied to this company data'));
    }

    next();
  };
}
