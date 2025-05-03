const frontendUrl = process.env.NODE_ENV === 'production' ? 'https://brandlly.ai' : 'http://localhost:3000';
const backendUrl = process.env.NODE_ENV === 'production' ? 'https://api.brandlly.ai' : 'http://localhost:3001';

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackUrl  = process.env.NODE_ENV === 'production' ? 'https://api.brandlly.ai/api/auth/google/callback' : 'http://localhost:3001/api/auth/google/callback';

export {
    frontendUrl,
    backendUrl,
    callbackUrl,
    clientID,
    clientSecret,
}