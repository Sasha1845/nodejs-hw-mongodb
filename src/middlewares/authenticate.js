import jwt from 'jsonwebtoken';
import createHttpError from 'http-errors';
import { User } from '../db/models/user.js';
import { Session } from '../db/models/session.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticate = async (req, res, next) => {
  try {
    // Отримуємо заголовок Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw createHttpError(401, 'Unauthorized');
    }

    // Перевіряємо формат Bearer token
    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      throw createHttpError(401, 'Unauthorized');
    }

    // Верифікуємо JWT токен
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw createHttpError(401, 'Access token expired');
      }
      throw createHttpError(401, 'Unauthorized');
    }

    // Знаходимо сесію з цим access token
    const session = await Session.findOne({ accessToken: token });

    if (!session) {
      throw createHttpError(401, 'Unauthorized');
    }

    // Перевіряємо, чи не закінчився термін дії access token в базі даних
    if (new Date() > session.accessTokenValidUntil) {
      throw createHttpError(401, 'Access token expired');
    }

    // Знаходимо користувача
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    // Додаємо користувача до req об'єкту (без пароля)
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (error) {
    next(error);
  }
};
