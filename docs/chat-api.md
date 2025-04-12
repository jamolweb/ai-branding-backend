# Chat API Documentation

## Overview

The Chat API provides endpoints for managing AI-powered conversations with streaming responses. All endpoints require JWT authentication.

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Send Message

Send a message to the AI and receive a streaming response.

**Endpoint:** `POST /api/chat/send`

**Request Body:**

```json
{
  "sessionId": "optional-existing-session-id",
  "message": "Your message here"
}
```

**Response:**
Server-Sent Events (SSE) stream with the following format:

```
data: {"content": "AI response chunk 1"}
data: {"content": "AI response chunk 2"}
...
```

**Example Usage:**

```javascript
// Frontend implementation
const response = await fetch('/api/chat/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    sessionId: 'optional-session-id',
    message: 'What is a brand story?',
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Handle the streaming content
      console.log(data.content);
    }
  }
}
```

### 2. Get User Sessions

Retrieve all chat sessions for the authenticated user.

**Endpoint:** `GET /api/chat/sessions`

**Response:**

```json
[
  {
    "id": "session-id",
    "userId": "user-id",
    "createdAt": "2024-04-12T12:00:00Z",
    "updatedAt": "2024-04-12T12:30:00Z",
    "messages": [
      {
        "id": "message-id",
        "role": "ASSISTANT",
        "content": "Last message content",
        "createdAt": "2024-04-12T12:30:00Z"
      }
    ]
  }
]
```

### 3. Get Chat History

Retrieve the message history for a specific chat session.

**Endpoint:** `GET /api/chat/history/:sessionId`

**Parameters:**

- `sessionId`: The ID of the chat session

**Response:**

```json
[
  {
    "id": "message-id",
    "role": "USER",
    "content": "User message",
    "createdAt": "2024-04-12T12:00:00Z"
  },
  {
    "id": "message-id",
    "role": "ASSISTANT",
    "content": "AI response",
    "createdAt": "2024-04-12T12:01:00Z"
  }
]
```

## Error Handling

### HTTP Status Codes

- `200`: Success
- `401`: Unauthorized (invalid or missing token)
- `500`: Server error

### Error Response Format

```json
{
  "error": "Error message description"
}
```

## Rate Limiting

The API implements rate limiting for free-tier users:

- Maximum 10 messages per hour
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests per hour
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time until limit resets (Unix timestamp)

## Best Practices

1. **Session Management**

   - Store the `sessionId` returned from the first message to maintain conversation context
   - Use the same `sessionId` for related messages

2. **Streaming Responses**

   - Implement proper error handling for stream interruptions
   - Use appropriate UI feedback for streaming content
   - Consider implementing a timeout mechanism

3. **Error Handling**

   - Always check for error responses
   - Implement retry logic for transient failures
   - Handle network errors gracefully

4. **Authentication**
   - Store JWT tokens securely
   - Implement token refresh logic
   - Handle token expiration gracefully

## Example Implementation

```typescript
// Chat service implementation
class ChatService {
  private currentSessionId: string | null = null;

  async sendMessage(message: string) {
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          sessionId: this.currentSessionId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            this.handleStreamingContent(data.content);
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleStreamingContent(content: string) {
    // Update UI with streaming content
    console.log('Streaming content:', content);
  }

  private handleError(error: Error) {
    // Handle errors appropriately
    console.error('Error:', error);
  }
}
```
