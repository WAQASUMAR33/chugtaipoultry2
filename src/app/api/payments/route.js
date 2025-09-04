import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all payments with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    let where = {
      type: 'PAYMENT_TO_PARTY'  // Only get payment entries from ledger
    };
    
    if (accountId && accountId !== 'ALL') {
      where.accountId = parseInt(accountId);
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

    const [ledgers, totalCount] = await Promise.all([
      prisma.ledger.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },  // Sort by date descending (newest first)
          { id: 'desc' }          // Sort by ID descending to break ties
        ],
        skip,
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              balance: true
            }
          }
        }
      }),
      prisma.ledger.count({ where })
    ]);

    // Convert to payment format for compatibility
    const payments = ledgers.map(ledger => ({
      id: ledger.id,
      accountId: ledger.accountId,
      amount: ledger.drAmount, // Payment amount is in drAmount
      description: ledger.details,
      date: ledger.createdAt,
      account: ledger.account,
      opening_balance: ledger.opening_balance,
      closing_balance: ledger.closing_balance
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST create new payment to party
export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, amount, description, date } = body;

    // Validation
    if (!accountId || !amount || !description || !date) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Verify account exists and is a party account
    const account = await prisma.account.findUnique({ 
      where: { id: parseInt(accountId) } 
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.type !== 'PARTY_ACCOUNT') {
      return NextResponse.json(
        { error: 'Only party accounts can receive payments' },
        { status: 400 }
      );
    }

    // Get current balance BEFORE the transaction
    const currentBalance = account.balance || 0;

    // Get opening balance from last ledger entry
    const lastLedgerEntry = await prisma.ledger.findFirst({
      where: { accountId: parseInt(accountId) },
      orderBy: { id: 'desc' }
    });

    const openingBalance = lastLedgerEntry?.closing_balance || 0;

    // For PARTY_ACCOUNT: Payment (DEBIT) reduces what we owe them
    const closingBalance = openingBalance - parseFloat(amount);

    // Use the payment date for the ledger entry
    const paymentDate = new Date(date);

    // Create ledger entry for the payment
    const paymentLedgerEntry = await prisma.ledger.create({
      data: {
        accountId: parseInt(accountId),
        drAmount: parseFloat(amount), // DEBIT - payment reduces what we owe
        crAmount: 0,
        details: `Payment to party: ${description}`,
        type: 'PAYMENT_TO_PARTY',
        referenceId: Date.now(), // Simple unique ID
        referenceType: 'PAYMENT_TO_PARTY',
        opening_balance: parseFloat(openingBalance.toFixed(2)),
        closing_balance: parseFloat(closingBalance.toFixed(2)),
        createdAt: paymentDate,
        updatedAt: paymentDate
      }
    });

    // Update account balance (reduce what we owe to supplier)
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: {
        balance: {
          decrement: parseFloat(amount) // Payment reduces what we owe
        }
      }
    });

    // Return payment format for compatibility
    return NextResponse.json({
      id: paymentLedgerEntry.id,
      accountId: parseInt(accountId),
      amount: parseFloat(amount),
      description,
      date: new Date(date),
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        balance: currentBalance - parseFloat(amount)
      },
      opening_balance: openingBalance,
      closing_balance: closingBalance
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
