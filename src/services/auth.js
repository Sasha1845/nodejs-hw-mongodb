import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import createHttpError from 'http-errors';
import { User } from '../db/models/user.js';
import { Session } from '../db/models/session.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async (userData) => {
  const { name, email, password } = userData;

  // Перевіряємо, чи існує користувач з таким email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createHttpError(409, 'Email in use');
  }

  // Хешуємо пароль
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Створюємо нового користувача
  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  // Повертаємо користувача без пароля
  const userWithoutPassword = {
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    createdAt: newUser.createdAt,
    updatedAt: newUser.updatedAt,
  };

  return userWithoutPassword;
};

export const loginUser = async (loginData) => {
  const { email, password } = loginData;

  // Знаходимо користувача за email
  const user = await User.findOne({ email });
  if (!user) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Перевіряємо пароль
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Видаляємо стару сесію користувача, якщо вона існує
  await Session.deleteMany({ userId: user._id });

  // Генеруємо токени
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = crypto.randomBytes(32).toString('hex');

  // Створюємо нову сесію
  const accessTokenValidUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 хвилин
  const refreshTokenValidUntil = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ); // 30 днів

  await Session.create({
    userId: user._id,
    accessToken,
    refreshToken,
    accessTokenValidUntil,
    refreshTokenValidUntil,
  });

  return {
    accessToken,
    refreshToken,
  };
};

export const refreshUserSession = async (refreshToken) => {
  // Перевіряємо, чи переданий refreshToken
  if (!refreshToken) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Знаходимо сесію за refreshToken
  const session = await Session.findOne({ refreshToken });
  if (!session) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Перевіряємо, чи не закінчився термін дії refreshToken
  if (new Date() > session.refreshTokenValidUntil) {
    // Видаляємо застарілу сесію
    await Session.deleteOne({ _id: session._id });
    throw createHttpError(401, 'Unauthorized');
  }

  // Знаходимо користувача
  const user = await User.findById(session.userId);
  if (!user) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Видаляємо стару сесію
  await Session.deleteOne({ _id: session._id });

  // Генеруємо нові токени
  const newAccessToken = jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const newRefreshToken = crypto.randomBytes(32).toString('hex');

  // Створюємо нову сесію
  const accessTokenValidUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 хвилин
  const refreshTokenValidUntil = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ); // 30 днів

  await Session.create({
    userId: user._id,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessTokenValidUntil,
    refreshTokenValidUntil,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutUser = async (refreshToken) => {
  // Перевіряємо, чи переданий refreshToken
  if (!refreshToken) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Знаходимо та видаляємо сесію за refreshToken
  const session = await Session.findOne({ refreshToken });
  if (!session) {
    throw createHttpError(401, 'Unauthorized');
  }

  // Видаляємо сесію
  await Session.deleteOne({ _id: session._id });

  return true;
};
