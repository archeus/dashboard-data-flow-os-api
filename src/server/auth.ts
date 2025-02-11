import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Static credentials for demonstration
const VALID_CREDENTIALS = {
  username: 'demo',
  password: '!202502demo!'
};

export interface AuthResponse {
  user: {
    username: string;
  };
  token: string;
}

export function validateCredentials(username: string, password: string): AuthResponse | null {
  if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    return {
      user: { username },
      token
    };
  }
  return null;
}