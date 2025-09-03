import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all sales with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(sales);
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

    // Update account balance (what customer owes us)
    // Balance = Previous Balance + Sale Amount - Payment Made
    const newBalance = actualPreBalance + parseFloat(totalAmount) - parseFloat(payment || 0);
    
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: newBalance }
    });

    // Create ledger entries for the sale transaction
    
    // 1. Opening Balance Entry (if there's a previous balance)
    if (actualPreBalance > 0) {
      await prisma.ledger.create({
        data: {
          accountId: parseInt(accountId),
          drAmount: actualPreBalance, // DEBIT: Previous balance owed by customer
          crAmount: 0,
          details: `Opening Balance: PKR ${actualPreBalance} (Customer owes us)`,
          type: 'OPENING_BALANCE',
          referenceId: sale.id,
          referenceType: 'SALE'
        }
      });
    }
    
    // 2. Sale Entry (DEBIT - customer owes us money)
    await prisma.ledger.create({
      data: {
        accountId: parseInt(accountId),
        drAmount: parseFloat(totalAmount), // DEBIT: Customer owes this amount
        crAmount: 0,
        details: `Sale: ${weight}kg @ PKR ${rate} = PKR ${totalAmount}`,
        type: 'SALE',
        referenceId: sale.id,
        referenceType: 'SALE'
      }
    });

    // 3. Payment Entry (if payment was received) - CREDIT reduces what customer owes
    if (parseFloat(payment || 0) > 0) {
      await prisma.ledger.create({
        data: {
          accountId: parseInt(accountId),
          drAmount: 0,
          crAmount: parseFloat(payment), // CREDIT: Payment reduces customer's debt
          details: `Payment from customer: PKR ${payment}`,
          type: 'PAYMENT',
          referenceId: sale.id,
          referenceType: 'SALE'
        }
      });
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { error: 'Failed to create sale' },
      { status: 500 }
    );
  }
}
