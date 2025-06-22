import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import createHttpError from 'http-errors';
import nodemailer from 'nodemailer';
import { User } from '../db/models/user.js';
import { Session } from '../db/models/session.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Функція для створення transporter для nodemailer
const createTransport = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // false для 587 порту
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Допомагає з сертифікатами
    },
  };

  return nodemailer.createTransport(config);
};

// Функція для відправки email
const sendMail = async (mailOptions) => {
  const transporter = createTransport();

  try {
    // Спочатку перевіряємо підключення
    await transporter.verify();

    // Підготовляємо повні налаштування листа
    const fullMailOptions = {
      from: process.env.SMTP_FROM,
      ...mailOptions,
    };

    const info = await transporter.sendMail(fullMailOptions);
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
  // Перевіряємо наявність необхідних змінних оточення
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD ||
    !process.env.SMTP_FROM
  ) {
    throw createHttpError(500, 'Email service not configured properly');
  }

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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #007bff;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password for your account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${resetLink}
        </p>
        <p><strong>Important:</strong> This link will expire in 5 minutes for security reasons.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>Best regards,<br>Your App Team</p>
      </div>
    `,
    text: `
Password Reset Request

We received a request to reset your password.

Copy and paste this link to reset your password:
${resetLink}

This link will expire in 5 minutes.

If you didn't request this, please ignore this email.

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
