import { NextResponse } from 'next/server';
import { prisma, withRetry } from '../../../lib/prisma';

export async function GET() {
  try {
    // Test database connection
    const result = await withRetry(async () => {
      return await prisma.$queryRaw`SELECT 1 as test`;
    });

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
