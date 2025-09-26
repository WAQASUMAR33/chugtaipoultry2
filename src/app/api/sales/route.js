import { NextResponse } from 'next/server';
import { prisma, withRetry } from '../../../lib/prisma';

// GET all sales with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    let where = {};
    
    if (accountId) {
      where.accountId = parseInt(accountId);
    }
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.sale.count({ where });

    const sales = await prisma.sale.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            balance: true
          }
        }
      },
      orderBy: { id: 'desc' },
      skip,
      take: limit
    });

    return NextResponse.json({
      sales,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST create new sale
export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, date, weight, rate, totalAmount, preBalance, payment, balance } = body;

    if (!accountId || !date || !weight || !rate || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify account exists and is a CUSTOMER_ACCOUNT
    const account = await prisma.account.findUnique({
      where: { id: parseInt(accountId) }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.type !== 'CUSTOMER_ACCOUNT') {
      return NextResponse.json(
        { error: 'Only customer accounts can be used for sales' },
        { status: 400 }
      );
    }

    // Get current account balance to use as pre-balance if not provided
    const currentBalance = account.balance || 0;
    const actualPreBalance = parseFloat(preBalance || 0) > 0 ? parseFloat(preBalance) : currentBalance;

    // Create sale
    const sale = await prisma.sale.create({
      data: {
        accountId: parseInt(accountId),
        date: new Date(date),
        weight: parseFloat(weight),
        rate: parseFloat(rate),
        totalAmount: parseFloat(totalAmount),
        preBalance: actualPreBalance,
        payment: parseFloat(payment || 0),
        balance: parseFloat(balance || 0)
      },
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
    });

    // Create ledger entries for the sale transaction
    
    // Use the sale date for all ledger entries
    const saleDate = new Date(date);
    
    // Get the opening balance from the last ledger entry's closing balance
    const lastLedgerEntry = await prisma.ledger.findFirst({
      where: { accountId: parseInt(accountId) },
      orderBy: { id: 'desc' }
    });
    
    let openingBalance = 0;
    if (lastLedgerEntry) {
      openingBalance = lastLedgerEntry.closing_balance;
    }
    
    // For CUSTOMER_ACCOUNT: 
    // - DEBIT (sale) increases what they owe us (positive balance)
    // - CREDIT (payment) decreases what they owe us (reduces balance)
    
    // 1. Sale Entry (DEBIT - customer owes us money)
    const saleClosingBalance = openingBalance + parseFloat(totalAmount);
    await prisma.ledger.create({
      data: {
        accountId: parseInt(accountId),
        drAmount: parseFloat(totalAmount),
        crAmount: 0,
        details: `Sale: ${weight}kg @ PKR ${rate} = PKR ${totalAmount}`,
        type: 'SALE',
        referenceId: sale.id,
        referenceType: 'SALE',
        opening_balance: parseFloat(openingBalance.toFixed(2)),
        closing_balance: parseFloat(saleClosingBalance.toFixed(2)),
        createdAt: saleDate,
        updatedAt: saleDate
      }
    });

    // 2. Payment Entry (if payment was received) - CREDIT reduces what customer owes
    if (parseFloat(payment || 0) > 0) {
      const paymentClosingBalance = saleClosingBalance - parseFloat(payment);
      await prisma.ledger.create({
        data: {
          accountId: parseInt(accountId),
          drAmount: 0,
          crAmount: parseFloat(payment),
          details: `Payment received: PKR ${payment}`,
          type: 'PAYMENT',
          referenceId: sale.id,
          referenceType: 'SALE',
          opening_balance: parseFloat(saleClosingBalance.toFixed(2)),
          closing_balance: parseFloat(paymentClosingBalance.toFixed(2)),
          createdAt: saleDate,
          updatedAt: saleDate
        }
      });
    }

    // Update account balance (what customer owes us)
    // Balance = Previous Balance + Sale Amount - Payment Made
    const newBalance = actualPreBalance + parseFloat(totalAmount) - parseFloat(payment || 0);
    
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: newBalance }
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { error: 'Failed to create sale' },
      { status: 500 }
    );
  }
}
