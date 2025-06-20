import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import createHttpError from 'http-errors';
import nodemailer from 'nodemailer';
import { User } from '../db/models/user.js';
import { Session } from '../db/models/session.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Функція для створення transporter для nodemailer
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true для 465 порту, false для інших портів
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

// Функція для відправки email
const sendMail = async (mailOptions) => {
  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      ...mailOptions,
    });

    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

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

export const sendResetEmail = async (email) => {
  // Знаходимо користувача за email
  const user = await User.findOne({ email });
  if (!user) {
    throw createHttpError(404, 'User not found!');
  }

  // Створюємо JWT токен для скидання паролю (термін життя 5 хвилин)
  const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, {
    expiresIn: '5m',
  });

  // Формуємо посилання для скидання паролю
  const resetLink = `${process.env.APP_DOMAIN}/reset-password?token=${resetToken}`;

  // Налаштування листа
  const mailOptions = {
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the link below to reset your password:</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 5 minutes for security reasons.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>Best regards,<br>Your App Team</p>
      </div>
    `,
    text: `
      Password Reset Request
      
      Hello,
      
      We received a request to reset your password. Copy and paste the following link into your browser to reset your password:
      
      ${resetLink}
      
      This link will expire in 5 minutes for security reasons.
      
      If you didn't request a password reset, please ignore this email.
      
      Best regards,
      Your App Team
    `,
  };

  try {
    await sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send reset email:', error);
    throw createHttpError(
      500,
      'Failed to send the email, please try again later.',
    );
  }
};

export const resetPassword = async (token, password) => {
  // Верифікуємо JWT токен
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw createHttpError(401, 'Token is expired or invalid.');
    }
    throw createHttpError(401, 'Token is expired or invalid.');
  }

  // Знаходимо користувача за email з токену
  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    throw createHttpError(404, 'User not found!');
  }

  // Хешуємо новий пароль
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Оновлюємо пароль користувача
  await User.findByIdAndUpdate(user._id, { password: hashedPassword });

  // Видаляємо всі поточні сесії для цього користувача
  await Session.deleteMany({ userId: user._id });

  return true;
};
