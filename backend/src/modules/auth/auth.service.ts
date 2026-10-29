import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { JWTPayload } from '../../shared/interfaces';
import {
  InvalidCredentialsError,
  InvalidTokenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/exceptions';

const SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { teacher: true },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Calculate expiry dates
    const accessTokenExpiresAt = new Date(
      Date.now() + this.parseExpiry(config.jwt.accessExpiry)
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.parseExpiry(config.jwt.refreshExpiry)
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        employeeId: user.teacher?.employeeId || null,
      },
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      },
    };
  }

  /**
   * Logout user by revoking their refresh token
   */
  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (token) {
      await prisma.refreshToken.update({
        where: { id: token.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { teacher: true } } },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw new InvalidTokenError();
    }

    if (new Date() > storedToken.expiresAt) {
      // Revoke expired token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      throw new InvalidTokenError();
    }

    const user = storedToken.user;
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('User account is disabled');
    }

    const accessToken = this.generateAccessToken(user);
    const accessTokenExpiresAt = new Date(
      Date.now() + this.parseExpiry(config.jwt.accessExpiry)
    );

    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all refresh tokens for this user (force re-login)
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { teacher: { include: { department: true } } },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      teacher: user.teacher
        ? {
            employeeId: user.teacher.employeeId,
            designation: user.teacher.designation,
            department: user.teacher.department?.name || null,
          }
        : null,
    };
  }

  /**
   * Verify a JWT access token and return the payload
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
      if (payload.type !== 'access') {
        throw new InvalidTokenError();
      }
      return payload;
    } catch {
      throw new InvalidTokenError();
    }
  }

  // --- Private helpers ---

  private generateAccessToken(user: { id: string; email: string; role: string }): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JWTPayload['role'],
      type: 'access',
    };

    // expiresIn in seconds
    const expiresInMs = this.parseExpiry(config.jwt.accessExpiry);
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: Math.floor(expiresInMs / 1000),
    });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    // Generate a random token
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date(
      Date.now() + this.parseExpiry(config.jwt.refreshExpiry)
    );

    // Store hashed token in database
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900000; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 900000;
    }
  }
}

export const authService = new AuthService();
