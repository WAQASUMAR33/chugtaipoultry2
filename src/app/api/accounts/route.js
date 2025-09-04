import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all accounts with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    let where = {};
    
    if (type && type !== 'ALL') {
      where.type = type;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } }
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            ledgers: true,
            sales: true,
            purchases: true,
            debitJournals: true,
            creditJournals: true
          }
        }
      }
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

// POST create new account
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, address, type, balance } = body;

    // Debug logging
    console.log('Account creation request:', { name, phone, address, type, balance });

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Validate account type
    const validTypes = ['CASH', 'PARTY_ACCOUNT', 'CUSTOMER_ACCOUNT'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid account type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const initialBalance = parseFloat(balance || 0);
    
    const account = await prisma.account.create({
      data: {
        name,
        phone,
        address,
        type,
        balance: initialBalance
      }
    });

    // Create initial balance ledger entry if balance is not zero
    if (initialBalance !== 0) {
      const currentDate = new Date();
      
      await prisma.ledger.create({
        data: {
          accountId: account.id,
          drAmount: initialBalance > 0 ? initialBalance : 0,
          crAmount: initialBalance < 0 ? Math.abs(initialBalance) : 0,
          details: `Initial balance for account: ${account.name}`,
          type: 'INITIAL_BALANCE',
          referenceId: account.id,
          referenceType: 'ACCOUNT_CREATION',
          opening_balance: 0,
          closing_balance: initialBalance,
          createdAt: currentDate,
          updatedAt: currentDate
        }
      });
    }

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
