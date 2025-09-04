import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all ledger entries with optional filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    let where = {};
    
    if (accountId) {
      where.accountId = parseInt(accountId);
    }
    
    if (type && type !== 'ALL') {
      where.type = type;
    }
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.ledger.count({ where });

         // Get ledger entries with pagination
     const ledgers = await prisma.ledger.findMany({
       where,
       include: {
         account: {
           select: {
             id: true,
             name: true,
             type: true
           }
         }
       },
             orderBy: [
        { createdAt: 'desc' }, // Sort by date descending (newest first)
        { id: 'desc' }         // Then by ID to break ties
      ],
       skip,
       take: limit
     });

    // Calculate running balances with proper accounting logic
    let runningBalance = 0;
    const ledgersWithBalance = ledgers.map((ledger, index) => {
      // Calculate pre-balance (balance before this transaction)
      let preBalance = 0;
      let preBalanceLabel = '0';
      
      if (index > 0) {
        // Calculate balance from all previous transactions
        let tempBalance = 0;
        
        for (let i = 0; i < index; i++) {
          const prevLedger = ledgers[i];
          if (prevLedger.type === 'OPENING_BALANCE') {
            // Opening balance logic
            if (prevLedger.account.type === 'PARTY_ACCOUNT') {
              // For suppliers: CREDIT means we owe them, DEBIT means they owe us (advance)
              tempBalance = prevLedger.crAmount - prevLedger.drAmount;
            } else {
              // For customers: DEBIT means they owe us, CREDIT means we owe them
              tempBalance = prevLedger.drAmount - prevLedger.crAmount;
            }
          } else {
            // Regular transaction entries
            if (prevLedger.account.type === 'PARTY_ACCOUNT') {
              // For suppliers: CREDIT increases what we owe, DEBIT decreases what we owe
              tempBalance += prevLedger.crAmount - prevLedger.drAmount;
            } else {
              // For customers: DEBIT increases what they owe us, CREDIT decreases what they owe us
              tempBalance += prevLedger.drAmount - prevLedger.crAmount;
            }
          }
        }
        preBalance = Math.abs(tempBalance);
        
        // Format pre-balance label
        if (tempBalance > 0) {
          preBalanceLabel = `${preBalance} Cr`;
        } else if (tempBalance < 0) {
          preBalanceLabel = `${preBalance} Dr`;
        } else {
          preBalanceLabel = '0';
        }
      }
      
      // Update running balance for current transaction
      if (ledger.type === 'OPENING_BALANCE') {
        // Opening balance sets the initial running balance
        if (ledger.account.type === 'PARTY_ACCOUNT') {
          // For suppliers: CREDIT means we owe them, DEBIT means they owe us (advance)
          runningBalance = ledger.crAmount - ledger.drAmount;
        } else {
          // For customers: DEBIT means they owe us, CREDIT means we owe them
          runningBalance = ledger.drAmount - ledger.crAmount;
        }
      } else {
        // Regular transaction entries
        if (ledger.account.type === 'PARTY_ACCOUNT') {
          // For suppliers: CREDIT increases what we owe, DEBIT decreases what we owe
          runningBalance += ledger.crAmount - ledger.drAmount;
        } else {
          // For customers: DEBIT increases what they owe us, CREDIT decreases what they owe us
          runningBalance += ledger.drAmount - ledger.crAmount;
        }
      }
      
      // Calculate post-balance (balance after this transaction)
      let postBalance = Math.abs(runningBalance);
      let postBalanceLabel;
      
      if (ledger.account.type === 'PARTY_ACCOUNT') {
        // For suppliers (Accounts Payable)
        if (runningBalance > 0) {
          postBalanceLabel = `${postBalance} Cr (We owe them)`;
        } else if (runningBalance < 0) {
          postBalanceLabel = `${postBalance} Dr (They owe us / Advance)`;
        } else {
          postBalanceLabel = '0 (Settled)';
        }
      } else {
        // For customers (Accounts Receivable)
        if (runningBalance > 0) {
          postBalanceLabel = `${postBalance} Dr (They owe us)`;
        } else if (runningBalance < 0) {
          postBalanceLabel = `${postBalance} Cr (We owe them)`;
        } else {
          postBalanceLabel = '0 (Settled)';
        }
      }
      
      return {
        ...ledger,
        preBalance,
        preBalanceLabel,
        postBalance,
        postBalanceLabel
      };
    });

    return NextResponse.json({
      ledgers: ledgersWithBalance,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledgers' },
      { status: 500 }
    );
  }
}

// POST create new ledger entry
export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, drAmount, crAmount, details, type, referenceId, referenceType } = body;

    if (!accountId || (!drAmount && !crAmount) || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If this is an opening balance entry, check if one already exists
    if (type === 'OPENING_BALANCE') {
      const existingOpeningBalance = await prisma.ledger.findFirst({
        where: {
          accountId: parseInt(accountId),
          type: 'OPENING_BALANCE'
        }
      });
      
      if (existingOpeningBalance) {
        return NextResponse.json(
          { error: 'Opening balance already exists for this account' },
          { status: 400 }
        );
      }
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: parseInt(accountId) }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Create ledger entry
    const ledger = await prisma.ledger.create({
      data: {
        accountId: parseInt(accountId),
        drAmount: parseFloat(drAmount || 0),
        crAmount: parseFloat(crAmount || 0),
        details,
        type: type || 'MANUAL',
        referenceId: referenceId || null,
        referenceType: referenceType || null
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Update account balance
    const balanceChange = (parseFloat(crAmount || 0) - parseFloat(drAmount || 0));
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { 
        balance: {
          increment: balanceChange
        }
      }
    });

    return NextResponse.json(ledger, { status: 201 });
  } catch (error) {
    console.error('Error creating ledger entry:', error);
    return NextResponse.json(
      { error: 'Failed to create ledger entry' },
      { status: 500 }
    );
  }
}

// PUT update account opening balance
export async function PUT(request) {
  try {
    const body = await request.json();
    const { accountId, openingBalance, accountType } = body;

    if (!accountId || openingBalance === undefined || !accountType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if opening balance already exists
    const existingOpeningBalance = await prisma.ledger.findFirst({
      where: {
        accountId: parseInt(accountId),
        type: 'OPENING_BALANCE'
      }
    });

    if (existingOpeningBalance) {
      // Update existing opening balance
      await prisma.ledger.update({
        where: { id: existingOpeningBalance.id },
        data: {
          drAmount: accountType === 'CUSTOMER_ACCOUNT' ? parseFloat(openingBalance) : 0,
          crAmount: accountType === 'PARTY_ACCOUNT' ? parseFloat(openingBalance) : 0,
          details: `Opening Balance: PKR ${openingBalance} (${accountType === 'CUSTOMER_ACCOUNT' ? 'Customer owes us' : 'We owe supplier'})`
        }
      });
    } else {
      // Create new opening balance entry
      await prisma.ledger.create({
        data: {
          accountId: parseInt(accountId),
          drAmount: accountType === 'CUSTOMER_ACCOUNT' ? parseFloat(openingBalance) : 0,
          crAmount: accountType === 'PARTY_ACCOUNT' ? parseFloat(openingBalance) : 0,
          details: `Opening Balance: PKR ${openingBalance} (${accountType === 'CUSTOMER_ACCOUNT' ? 'Customer owes us' : 'We owe supplier'})`,
          type: 'OPENING_BALANCE',
          referenceType: 'MANUAL'
        }
      });
    }

    // Update account balance
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: parseFloat(openingBalance) }
    });

    return NextResponse.json({ message: 'Opening balance updated successfully' });
  } catch (error) {
    console.error('Error updating opening balance:', error);
    return NextResponse.json(
      { error: 'Failed to update opening balance' },
      { status: 500 }
    );
  }
}
