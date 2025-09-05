import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all purchases with optional filtering
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

    const purchases = await prisma.purchase.findMany({
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
      orderBy: { id: 'desc' }
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}

// POST create new purchase
export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, date, vehicleNumber, weight, rate, totalManagment, preBalance, payment, balance } = body;

    if (!accountId || !date || !vehicleNumber || !weight || !rate || !totalManagment) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, date, vehicleNumber, weight, rate, totalManagment' },
        { status: 400 }
      );
    }

    // Verify account exists and is a PARTY_ACCOUNT
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
        { error: 'Only party accounts can be used for purchases' },
        { status: 400 }
      );
    }

    // Get current account balance to use as pre-balance if not provided
    const currentBalance = account.balance || 0;
    const actualPreBalance = parseFloat(preBalance || 0) > 0 ? parseFloat(preBalance) : currentBalance;

    // Create purchase
    const purchase = await prisma.purchase.create({
      data: {
        accountId: parseInt(accountId),
        date: new Date(date),
        vehicleNumber: vehicleNumber,
        weight: parseFloat(weight),
        rate: parseFloat(rate),
        totalManagment: parseFloat(totalManagment),
        preBalance: actualPreBalance,
        payment: parseFloat(payment || 0),
        balance: parseFloat(balance || 0),
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

    // Create ledger entries for the purchase transaction
    
    // Use the purchase date for all ledger entries
    const purchaseDate = new Date(date);
    
    // Get the opening balance from the last ledger entry's closing balance
    const lastLedgerEntry = await prisma.ledger.findFirst({
      where: { accountId: parseInt(accountId) },
      orderBy: { id: 'desc' }
    });
    
    let openingBalance = 0;
    if (lastLedgerEntry) {
      openingBalance = lastLedgerEntry.closing_balance;
    }
    
    // For PARTY_ACCOUNT (suppliers): 
    // - CREDIT (purchase) increases what we owe them (positive balance)
    // - DEBIT (payment) decreases what we owe them (reduces balance)
    
    // 1. Purchase Entry (CREDIT - we owe money to supplier)
    const purchaseClosingBalance = openingBalance + parseFloat(totalManagment);
    await prisma.ledger.create({
      data: {
        accountId: parseInt(accountId),
        drAmount: 0,
        crAmount: parseFloat(totalManagment),
        details: `Purchase: ${weight}kg @ PKR ${rate} = PKR ${totalManagment}`,
        type: 'PURCHASE',
        referenceId: purchase.id,
        referenceType: 'PURCHASE',
        opening_balance: parseFloat(openingBalance.toFixed(2)),
        closing_balance: parseFloat(purchaseClosingBalance.toFixed(2)),
        createdAt: purchaseDate,
        updatedAt: purchaseDate
      }
    });

    // 2. Payment Entry (if payment was made) - DEBIT reduces what we owe
    if (parseFloat(payment || 0) > 0) {
      const paymentClosingBalance = purchaseClosingBalance - parseFloat(payment);
      await prisma.ledger.create({
        data: {
          accountId: parseInt(accountId),
          drAmount: parseFloat(payment),
          crAmount: 0,
          details: `Payment to supplier: PKR ${payment}`,
          type: 'PAYMENT',
          referenceId: purchase.id,
          referenceType: 'PURCHASE',
          opening_balance: parseFloat(purchaseClosingBalance.toFixed(2)),
          closing_balance: parseFloat(paymentClosingBalance.toFixed(2)),
          createdAt: purchaseDate,
          updatedAt: purchaseDate
        }
      });
    }

    // Update account balance (what we owe to supplier)
    // Balance = Previous Balance + Purchase Amount - Payment Made
    const newBalance = actualPreBalance + parseFloat(totalManagment) - parseFloat(payment || 0);
    
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: newBalance }
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase' },
      { status: 500 }
    );
  }
}
