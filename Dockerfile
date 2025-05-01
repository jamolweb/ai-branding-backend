FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including Prisma
RUN npm install

# Copy prisma schema and migrations
COPY prisma/ ./prisma/

# Copy source code
COPY src/ ./src/
COPY tsconfig*.json ./

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Copy the rest of the application
COPY . .

# Expose app port
EXPOSE 3001

# Start the app
CMD ["npm", "run", "start:prod"]
