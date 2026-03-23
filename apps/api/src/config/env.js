import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port:           Number(process.env.PORT         || 4000),
  dbHost:         process.env.DB_HOST             || 'localhost',
  dbPort:         Number(process.env.DB_PORT      || 3306),
  dbName:         process.env.DB_NAME             || '',
  dbUser:         process.env.DB_USER             || '',
  dbPassword:     process.env.DB_PASSWORD         || '',
  jwtSecret:      process.env.JWT_SECRET          || 'change-me-in-production',
  jwtExpiry:      process.env.JWT_EXPIRY          || '7d',
  allowedOrigin:  process.env.ALLOWED_ORIGIN      || '*',
};


  openaiApiKey:   process.env.OPENAI_API_KEY      || '',
