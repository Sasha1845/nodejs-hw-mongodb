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
  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // false для 587 порту
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Допомагає з сертифікатами
    },
    debug: true, // Додаємо детальне логування
    logger: true, // Включаємо логер
  };

  console.log('Creating transporter with config:', {
    host: config.host,
    port: config.port,
    user: config.auth.user,
    // Не логуємо пароль з міркувань безпеки
  });

  return nodemailer.createTransporter(config);
};

// Функція для відправки email
const sendMail = async (mailOptions) => {
  console.log('Starting email send process...');

  const transporter = createTransporter();

  try {
    // Спочатку перевіряємо підключення
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    // Підготовляємо повні налаштування листа
    const fullMailOptions = {
      from: `"Your App" <${process.env.SMTP_FROM}>`, // Додаємо ім'я відправника
      ...mailOptions,
    };

    console.log('Sending email with options:', {
      from: fullMailOptions.from,
      to: fullMailOptions.to,
      subject: fullMailOptions.subject,
    });

    const info = await transporter.sendMail(fullMailOptions);

    console.log('Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return info;
  } catch (error) {
    console.error('Detailed error sending email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    console.error('Current SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
      hasPassword: !!process.env.SMTP_PASSWORD,
    });

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
  console.log(`Starting password reset email process for: ${email}`);

  // Перевіряємо наявність необхідних змінних оточення
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'JWT_SECRET',
    'APP_DOMAIN',
  ];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    console.error('Missing environment variables:', missingVars);
    throw createHttpError(
      500,
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }

  // Знаходимо користувача за email
  console.log('Looking for user with email:', email);
  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found for email:', email);
    throw createHttpError(404, 'User not found!');
  }
  console.log('User found:', user._id);

  // Створюємо JWT токен для скидання паролю (термін життя 5 хвилин)
  const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, {
    expiresIn: '5m',
  });
  console.log('Reset token created successfully');

  // Формуємо посилання для скидання паролю
  const resetLink = `${process.env.APP_DOMAIN}/reset-password?token=${resetToken}`;
  console.log('Reset link generated:', resetLink);

  // Налаштування листа
  const mailOptions = {
    to: email,
    subject: 'Password Reset Request - Your App',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
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
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Best regards,<br>
            Your App Team
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Password Reset Request

Hello,

We received a request to reset your password for your account.

Please copy and paste the following link into your browser to reset your password:
${resetLink}

This link will expire in 5 minutes for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
Your App Team
    `,
  };

  try {
    console.log('Attempting to send email...');
    await sendMail(mailOptions);
    console.log('Password reset email sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send reset email. Full error details:', error);

    // Більш детальна інформація про помилку для різних випадків
    if (error.code === 'EAUTH') {
      console.error('Authentication failed - check SMTP credentials');
      throw createHttpError(
        500,
        'Email authentication failed. Please check email service configuration.',
      );
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('Cannot connect to SMTP server');
      throw createHttpError(
        500,
        'Cannot connect to email server. Please try again later.',
      );
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timeout');
      throw createHttpError(
        500,
        'Email service timeout. Please try again later.',
      );
    } else if (error.responseCode >= 400 && error.responseCode < 500) {
      console.error('Client error from SMTP server');
      throw createHttpError(
        500,
        'Invalid email configuration. Please contact support.',
      );
    } else if (error.responseCode >= 500) {
      console.error('Server error from SMTP server');
      throw createHttpError(
        500,
        'Email server temporarily unavailable. Please try again later.',
      );
    } else {
      console.error('Unknown email error');
      throw createHttpError(
        500,
        'Failed to send the email, please try again later.',
      );
    }
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
