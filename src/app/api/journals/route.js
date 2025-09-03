import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all journal entries with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    let where = {};
    
    if (accountId && accountId !== 'ALL') {
      where.OR = [
        { debitAccountId: parseInt(accountId) },
        { creditAccountId: parseInt(accountId) }
      ];
    }
    
    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      };
    }
    
    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const [journals, totalCount] = await Promise.all([
      prisma.journal.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },  // Sort by date descending (newest first)
          { id: 'desc' }          // Sort by ID descending to break ties
        ],
        skip,
        take: limit,
        include: {
          debitAccount: {
            select: {
              id: true,
              name: true,
              type: true,
              balance: true
            }
          },
          creditAccount: {
            select: {
              id: true,
              name: true,
              type: true,
              balance: true
            }
          }
        }
      }),
      prisma.journal.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      journals,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching journals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}

// POST create new journal entry
export async function POST(request) {
  try {
    const body = await request.json();
    const { debitAccountId, creditAccountId, amount, description } = body;

    // Validation
    if (!debitAccountId || !creditAccountId || !amount || !description) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (debitAccountId === creditAccountId) {
      return NextResponse.json(
        { error: 'Debit and Credit accounts cannot be the same' },
        { status: 400 }
      );
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Verify accounts exist
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: parseInt(debitAccountId) } }),
      prisma.account.findUnique({ where: { id: parseInt(creditAccountId) } })
    ]);

    if (!debitAccount || !creditAccount) {
      return NextResponse.json(
        { error: 'One or both accounts not found' },
        { status: 404 }
      );
    }

    // Get current balances BEFORE the transaction
    const debitAccountCurrentBalance = debitAccount.balance || 0;
    const creditAccountCurrentBalance = creditAccount.balance || 0;

    // Create journal entry
    const journal = await prisma.journal.create({
      data: {
        debitAccountId: parseInt(debitAccountId),
        creditAccountId: parseInt(creditAccountId),
        amount: parseFloat(amount),
        description
      },
      include: {
        debitAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            balance: true
          }
        },
        creditAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            balance: true
          }
        }
      }
    });

    // Update account balances based on proper double-entry accounting rules
    await Promise.all([
      // Debit account: decrease balance (money going out/owed to you)
      prisma.account.update({
        where: { id: parseInt(debitAccountId) },
        data: {
          balance: {
            decrement: parseFloat(amount) // Debit decreases the account balance
          }
        }
      }),
      // Credit account: decrease balance (money going out/you owe them)
      prisma.account.update({
        where: { id: parseInt(creditAccountId) },
        data: {
          balance: {
            decrement: parseFloat(amount) // Credit decreases the account balance
          }
        }
      })
    ]);

    // Return journal with pre-balance information
    return NextResponse.json({
      ...journal,
      preBalances: {
        debitAccount: debitAccountCurrentBalance,
        creditAccount: creditAccountCurrentBalance
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to create journal entry' },
      { status: 500 }
    );
  }
}
