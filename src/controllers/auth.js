import {
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
} from '../services/auth.js';

export const registerUserController = async (req, res) => {
  const userData = await registerUser(req.body);

  res.status(201).json({
    status: 201,
    message: 'Successfully registered a user!',
    data: userData,
  });
};

export const loginUserController = async (req, res) => {
  const { accessToken, refreshToken } = await loginUser(req.body);

  // Встановлюємо refresh token в cookies
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 днів
  });

  res.status(200).json({
    status: 200,
    message: 'Successfully logged in an user!',
    data: {
      accessToken,
    },
  });
};

export const refreshUserSessionController = async (req, res) => {
  const { refreshToken } = req.cookies;

  const { accessToken, refreshToken: newRefreshToken } =
    await refreshUserSession(refreshToken);

  // Встановлюємо новий refresh token в cookies
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 днів
  });

  res.status(200).json({
    status: 200,
    message: 'Successfully refreshed a session!',
    data: {
      accessToken,
    },
  });
};

export const logoutUserController = async (req, res) => {
  const { refreshToken } = req.cookies;

  await logoutUser(refreshToken);

  // Видаляємо refresh token з cookies
  res.clearCookie('refreshToken');

  res.status(204).send();
};
