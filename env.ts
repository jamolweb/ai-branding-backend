function validateEnvVariables() {
    const requiredEnvVars = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CALLBACK_URL',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'JWT_ACCESS_EXPIRATION',
        'JWT_REFRESH_EXPIRATION',
        'DEEPSEEK_API_KEY',
        'STABLE_DIFFUSION_API_KEY',
        'OPENAI_API_KEY',
        'CLOUDINARY_URL',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_SECRET',
        'CLOUDINARY_API_KEY',
        'GOOGLE_AI_API_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_REGION',
        'S3_BUCKET_NAME'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }
}

validateEnvVariables();

const frontendUrl = process.env.NODE_ENV === 'production' ? 'https://brandlly.ai' : 'http://localhost:3000';
const backendUrl = process.env.NODE_ENV === 'production' ? 'https://api.brandlly.ai' : 'http://localhost:3001';

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_CALLBACK_URL_ENDPOINT = process.env.GOOGLE_CALLBACK_URL;
const callbackUrl  = backendUrl + GOOGLE_CALLBACK_URL_ENDPOINT;

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION;
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const STABLE_DIFFUSION_API_KEY = process.env.STABLE_DIFFUSION_API_KEY;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;


export {
    frontendUrl,
    backendUrl,
    callbackUrl,
    clientID,
    clientSecret,
    PORT,
    NODE_ENV,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRATION,
    JWT_REFRESH_EXPIRATION,
    DEEPSEEK_API_KEY,
    STABLE_DIFFUSION_API_KEY,
    OPENAI_API_KEY,
    CLOUDINARY_URL,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_API_KEY,
    GOOGLE_AI_API_KEY,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    S3_BUCKET_NAME,
}