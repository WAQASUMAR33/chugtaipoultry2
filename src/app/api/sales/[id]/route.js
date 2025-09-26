import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// PUT update sale and associated ledger and account balance
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { accountId, date, weight, rate, totalAmount, payment } = body;

    const saleId = parseInt(id);

    const existing = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { account: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const targetAccountId = parseInt(accountId ?? existing.accountId);

    // Get the balance BEFORE the original transaction (by finding the last ledger entry before this sale)
    const originalSaleLedgers = await prisma.ledger.findMany({
      where: { referenceType: 'SALE', referenceId: saleId },
      orderBy: { id: 'asc' }
    });

    // Find the balance before this sale was created
    let balanceBeforeOriginalSale = 0;
    if (originalSaleLedgers.length > 0) {
      balanceBeforeOriginalSale = originalSaleLedgers[0].opening_balance;
    } else {
      // If no ledgers found, get the last ledger entry for this account before this sale
      const lastLedgerBeforeSale = await prisma.ledger.findFirst({
        where: { 
          accountId: existing.accountId,
          id: { lt: originalSaleLedgers[0]?.id || 999999 }
        },
        orderBy: { id: 'desc' }
      });
      balanceBeforeOriginalSale = lastLedgerBeforeSale ? lastLedgerBeforeSale.closing_balance : 0;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete existing ledger entries for this sale
      await tx.ledger.deleteMany({
        where: { referenceType: 'SALE', referenceId: saleId }
      });

      // 2. Update the sale record
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          accountId: targetAccountId,
          date: date ? new Date(date) : existing.date,
          weight: weight !== undefined ? parseFloat(weight) : existing.weight,
          rate: rate !== undefined ? parseFloat(rate) : existing.rate,
          totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : existing.totalAmount,
          payment: payment !== undefined ? parseFloat(payment) : existing.payment,
        },
      });

      // 3. Create new ledger entries starting from the balance before the original sale
      const saleDate = new Date(updatedSale.date);
      const amount = parseFloat(updatedSale.totalAmount);
      const paid = parseFloat(updatedSale.payment || 0);

      // Sale entry (DEBIT - customer owes us money)
      const saleClosingBalance = balanceBeforeOriginalSale + amount;
      await tx.ledger.create({
        data: {
          accountId: targetAccountId,
          drAmount: amount,
          crAmount: 0,
          details: `Sale: ${updatedSale.weight}kg @ PKR ${updatedSale.rate} = PKR ${amount}`,
          type: 'SALE',
          referenceId: updatedSale.id,
          referenceType: 'SALE',
          opening_balance: parseFloat(balanceBeforeOriginalSale.toFixed(2)),
          closing_balance: parseFloat(saleClosingBalance.toFixed(2)),
          createdAt: saleDate,
          updatedAt: saleDate,
        },
      });

      // Payment entry (if payment was received) - CREDIT reduces what customer owes
      if (paid > 0) {
        const paymentClosingBalance = saleClosingBalance - paid;
        await tx.ledger.create({
          data: {
            accountId: targetAccountId,
            drAmount: 0,
            crAmount: paid,
            details: `Payment received: PKR ${paid}`,
            type: 'PAYMENT',
            referenceId: updatedSale.id,
            referenceType: 'SALE',
            opening_balance: parseFloat(saleClosingBalance.toFixed(2)),
            closing_balance: parseFloat(paymentClosingBalance.toFixed(2)),
            createdAt: saleDate,
            updatedAt: saleDate,
          },
        });
      }

      return updatedSale;
    }, {
      timeout: 10000, // 10 seconds
    });

    // Update account balance to the final calculated balance
    const finalLedger = await prisma.ledger.findFirst({
      where: { accountId: targetAccountId },
      orderBy: { id: 'desc' },
      select: { closing_balance: true }
    });

    const finalBalance = finalLedger ? finalLedger.closing_balance : 0;
    await prisma.account.update({ 
      where: { id: targetAccountId }, 
      data: { balance: finalBalance } 
    });

    // If account changed, update old account balance too
    if (existing.accountId !== targetAccountId) {
      const oldAccountFinalLedger = await prisma.ledger.findFirst({
        where: { accountId: existing.accountId },
        orderBy: { id: 'desc' },
        select: { closing_balance: true }
      });
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: oldAccountFinalLedger ? oldAccountFinalLedger.closing_balance : 0 },
      });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating sale:', error);
    return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
  }
}

// DELETE sale and reset account balance
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const saleId = parseInt(id);

    const existing = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { account: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Get the balance BEFORE this sale was created
    // First, find all ledger entries for this sale
    const originalSaleLedgers = await prisma.ledger.findMany({
      where: { referenceType: 'SALE', referenceId: saleId },
      orderBy: { id: 'asc' }
    });

    let balanceBeforeSale = 0;
    
    if (originalSaleLedgers.length > 0) {
      // The opening_balance of the first ledger entry for this sale
      // is the account balance before this sale was created
      balanceBeforeSale = originalSaleLedgers[0].opening_balance;
      console.log(`Sale ${saleId}: Found ${originalSaleLedgers.length} ledger entries, balance before sale: ${balanceBeforeSale}`);
    } else {
      // If no ledgers found for this sale, get the last ledger entry 
      // for this account before this sale was created
      const lastLedgerBeforeSale = await prisma.ledger.findFirst({
        where: { 
          accountId: existing.accountId,
          createdAt: { lt: existing.createdAt }
        },
        orderBy: { createdAt: 'desc' }
      });
      balanceBeforeSale = lastLedgerBeforeSale ? lastLedgerBeforeSale.closing_balance : 0;
      console.log(`Sale ${saleId}: No ledger entries found, using last ledger balance: ${balanceBeforeSale}`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete all ledger entries for this sale
      await tx.ledger.deleteMany({
        where: { referenceType: 'SALE', referenceId: saleId }
      });

      // 2. Delete the sale record
      await tx.sale.delete({
        where: { id: saleId }
      });

      // 3. Reset account balance to what it was before this sale
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: balanceBeforeSale }
      });
    });

    return NextResponse.json({ message: 'Sale deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
}


