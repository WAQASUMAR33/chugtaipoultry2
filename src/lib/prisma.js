import { PrismaClient } from '@prisma/client';

let prismaClientInstance;

const prismaOptions = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
  errorFormat: 'pretty',
};

if (process.env.NODE_ENV === 'production') {
  prismaClientInstance = new PrismaClient(prismaOptions);
} else {
  if (!globalThis.__prisma) {
    globalThis.__prisma = new PrismaClient(prismaOptions);
  }
  prismaClientInstance = globalThis.__prisma;
}

// Add connection retry logic
export const prisma = prismaClientInstance;

// Helper function to retry database operations
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}



