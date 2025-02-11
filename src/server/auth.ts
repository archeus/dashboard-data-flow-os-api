// Static credentials for demonstration
const VALID_CREDENTIALS = {
  username: 'demo',
  password: '!202502demo!'
};

export function validateCredentials(username: string, password: string): boolean {
  return username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;
}