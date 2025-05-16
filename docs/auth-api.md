# Authentication API Documentation

## Overview

This document provides comprehensive documentation for the authentication API endpoints in the AI Branding backend application. The authentication system uses secure cookie-based token storage for both access and refresh tokens.

## Security Features

- **HTTP-only Cookies**: Tokens are stored in HTTP-only cookies to prevent JavaScript access and mitigate XSS attacks
- **Secure Cookies**: In production, cookies are only transmitted over HTTPS connections
- **SameSite Policy**: Cookies use 'lax' SameSite policy to prevent CSRF attacks
- **Token Expiration**: Access tokens expire after 15 minutes, refresh tokens after 7 days
- **JWT Authentication**: Uses industry-standard JWT for secure authentication

## Base URL

All API endpoints are prefixed with `/api/auth`

## Endpoints

### Register

Creates a new user account.

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }
  ```
- **Response**:
  - **Status Code**: 201 Created
  - **Body**:
    ```json
    {
      "message": "Registration successful"
    }
    ```
  - **Cookies Set**:
    - `access_token`: JWT access token (expires in 15 minutes)
    - `refresh_token`: JWT refresh token (expires in 7 days)
- **Error Responses**:
  - **Status Code**: 409 Conflict
    ```json
    {
      "message": "Email already exists",
      "error": "Conflict",
      "statusCode": 409
    }
    ```
  - **Status Code**: 400 Bad Request (validation errors)

### Login

Authenticate a user and receive authentication cookies.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```
- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    {
      "message": "Login successful"
    }
    ```
  - **Cookies Set**:
    - `access_token`: JWT access token (expires in 15 minutes)
    - `refresh_token`: JWT refresh token (expires in 7 days)
- **Error Responses**:
  - **Status Code**: 401 Unauthorized
    ```json
    {
      "message": "Invalid credentials",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

### Google OAuth Authentication

#### Initiate Google OAuth Flow

- **URL**: `/api/auth/google`
- **Method**: `GET`
- **Authentication**: None
- **Response**: Redirects to Google OAuth consent screen

#### Google OAuth Callback

- **URL**: `/api/auth/google/callback`
- **Method**: `GET`
- **Authentication**: None (handled by OAuth provider)
- **Response**: Redirects to frontend dashboard
  - **Cookies Set**:
    - `access_token`: JWT access token (expires in 15 minutes)
    - `refresh_token`: JWT refresh token (expires in 7 days)

### Refresh Token

Refresh the access token using the refresh token cookie.

- **URL**: `/api/auth/refresh`
- **Method**: `POST`
- **Authentication**: Requires valid refresh token cookie
- **Request Body**: None
- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    {
      "message": "Tokens refreshed successfully"
    }
    ```
  - **Cookies Set**:
    - `access_token`: New JWT access token (expires in 15 minutes)
    - `refresh_token`: New JWT refresh token (expires in 7 days)
- **Error Responses**:
  - **Status Code**: 401 Unauthorized
    ```json
    {
      "message": "Refresh token not found",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```
  - **Status Code**: 401 Unauthorized
    ```json
    {
      "message": "Invalid refresh token",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

### Get User Profile

Retrieve the authenticated user's profile information.

- **URL**: `/api/auth/profile`
- **Method**: `GET`
- **Authentication**: Requires valid access token cookie
- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "googleId": null,
      "createdAt": "2025-05-16T08:52:41.000Z",
      "updatedAt": "2025-05-16T08:52:41.000Z"
    }
    ```
- **Error Responses**:
  - **Status Code**: 401 Unauthorized
    ```json
    {
      "message": "Authentication failed",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

### Logout

Log out the authenticated user by clearing authentication cookies.

- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Authentication**: Requires valid access token cookie
- **Request Body**: None
- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    {
      "message": "Logged out successfully"
    }
    ```
  - **Cookies Cleared**:
    - `access_token`: Removed
    - `refresh_token`: Removed
- **Error Responses**:
  - **Status Code**: 401 Unauthorized
    ```json
    {
      "message": "Authentication failed",
      "error": "Unauthorized",
      "statusCode": 401
    }
    ```

## Client Integration

### Frontend Configuration

When making requests to the authentication API from the frontend, ensure that credentials are included in the requests:

```javascript
// Example using fetch API
fetch('/api/auth/profile', {
  method: 'GET',
  credentials: 'include', // Important: This enables sending cookies with the request
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Axios Configuration

If using Axios, configure it to include credentials:

```javascript
import axios from 'axios';

// Create an axios instance with default configuration
const api = axios.create({
  baseURL: '/api',
  withCredentials: true // Important: This enables sending cookies with the request
});

// Example request
api.get('/auth/profile')
  .then(response => console.log(response.data));
```

## Security Considerations

1. **CORS Configuration**: The backend is configured to only accept requests from the allowed frontend origin with credentials.

2. **Token Refresh Strategy**: Implement automatic token refresh in your frontend when API calls return 401 Unauthorized errors.

3. **Error Handling**: Always handle authentication errors gracefully in the frontend, redirecting to the login page when necessary.

4. **HTTPS**: In production, always use HTTPS to ensure secure transmission of cookies.

## Implementation Notes

- The authentication system uses Argon2 for password hashing.
- JWT tokens are signed using the secrets defined in environment variables.
- Access tokens have a shorter lifespan for security, while refresh tokens allow for longer sessions.
- The system supports both traditional email/password authentication and Google OAuth.
