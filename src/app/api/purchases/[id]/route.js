import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// PUT update purchase and associated ledger and account balance
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { accountId, date, vehicleNumber, weight, rate, totalManagment, payment } = body;

    const purchaseId = parseInt(id);

    const existing = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { account: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const targetAccountId = parseInt(accountId ?? existing.accountId);

    // Wrap everything in a transaction
    // Get the balance BEFORE the original transaction (by finding the last ledger entry before this purchase)
    const originalPurchaseLedgers = await prisma.ledger.findMany({
      where: { referenceType: 'PURCHASE', referenceId: purchaseId },
      orderBy: { id: 'asc' }
    });

    // Find the balance before this purchase was created
    let balanceBeforeOriginalPurchase = 0;
    if (originalPurchaseLedgers.length > 0) {
      balanceBeforeOriginalPurchase = originalPurchaseLedgers[0].opening_balance;
    } else {
      // If no ledgers found, get the last ledger entry for this account before this purchase
      const lastLedgerBeforePurchase = await prisma.ledger.findFirst({
        where: { 
          accountId: existing.accountId,
          id: { lt: originalPurchaseLedgers[0]?.id || 999999 }
        },
        orderBy: { id: 'desc' }
      });
      balanceBeforeOriginalPurchase = lastLedgerBeforePurchase ? lastLedgerBeforePurchase.closing_balance : 0;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete existing ledger entries for this purchase
      await tx.ledger.deleteMany({
        where: { referenceType: 'PURCHASE', referenceId: purchaseId }
      });

      // 2. Update the purchase record
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          accountId: targetAccountId,
          date: date ? new Date(date) : existing.date,
          vehicleNumber: vehicleNumber ?? existing.vehicleNumber,
          weight: weight !== undefined ? parseFloat(weight) : existing.weight,
          rate: rate !== undefined ? parseFloat(rate) : existing.rate,
          totalManagment: totalManagment !== undefined ? parseFloat(totalManagment) : existing.totalManagment,
          payment: payment !== undefined ? parseFloat(payment) : existing.payment,
        },
      });

      // 3. Create new ledger entries starting from the balance before the original purchase
      const purchaseDate = new Date(updatedPurchase.date);
      const totalAmount = parseFloat(updatedPurchase.totalManagment);
      const paidAmount = parseFloat(updatedPurchase.payment || 0);

      // Purchase entry (CREDIT - we owe money to supplier)
      const purchaseClosingBalance = balanceBeforeOriginalPurchase + totalAmount;
      await tx.ledger.create({
        data: {
          accountId: targetAccountId,
          drAmount: 0,
          crAmount: totalAmount,
          details: `Purchase: ${updatedPurchase.weight}kg @ PKR ${updatedPurchase.rate} = PKR ${totalAmount}`,
          type: 'PURCHASE',
          referenceId: updatedPurchase.id,
          referenceType: 'PURCHASE',
          opening_balance: parseFloat(balanceBeforeOriginalPurchase.toFixed(2)),
          closing_balance: parseFloat(purchaseClosingBalance.toFixed(2)),
          createdAt: purchaseDate,
          updatedAt: purchaseDate,
        },
      });

      // Payment entry (if payment was made) - DEBIT reduces what we owe
      if (paidAmount > 0) {
        const paymentClosingBalance = purchaseClosingBalance - paidAmount;
        await tx.ledger.create({
          data: {
            accountId: targetAccountId,
            drAmount: paidAmount,
            crAmount: 0,
            details: `Payment to supplier: PKR ${paidAmount}`,
            type: 'PAYMENT',
            referenceId: updatedPurchase.id,
            referenceType: 'PURCHASE',
            opening_balance: parseFloat(purchaseClosingBalance.toFixed(2)),
            closing_balance: parseFloat(paymentClosingBalance.toFixed(2)),
            createdAt: purchaseDate,
            updatedAt: purchaseDate,
          },
        });
      }

      return updatedPurchase;
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
    console.error('Error updating purchase:', error);
    return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
  }
}

// DELETE purchase and reset account balance
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const purchaseId = parseInt(id);

    const existing = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { account: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Get the balance BEFORE this purchase was created
    // First, find all ledger entries for this purchase
    const originalPurchaseLedgers = await prisma.ledger.findMany({
      where: { referenceType: 'PURCHASE', referenceId: purchaseId },
      orderBy: { id: 'asc' }
    });

    let balanceBeforePurchase = 0;
    
    if (originalPurchaseLedgers.length > 0) {
      // The opening_balance of the first ledger entry for this purchase
      // is the account balance before this purchase was created
      balanceBeforePurchase = originalPurchaseLedgers[0].opening_balance;
      console.log(`Purchase ${purchaseId}: Found ${originalPurchaseLedgers.length} ledger entries, balance before purchase: ${balanceBeforePurchase}`);
    } else {
      // If no ledgers found for this purchase, get the last ledger entry 
      // for this account before this purchase was created
      const lastLedgerBeforePurchase = await prisma.ledger.findFirst({
        where: { 
          accountId: existing.accountId,
          createdAt: { lt: existing.createdAt }
        },
        orderBy: { createdAt: 'desc' }
      });
      balanceBeforePurchase = lastLedgerBeforePurchase ? lastLedgerBeforePurchase.closing_balance : 0;
      console.log(`Purchase ${purchaseId}: No ledger entries found, using last ledger balance: ${balanceBeforePurchase}`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete all ledger entries for this purchase
      await tx.ledger.deleteMany({
        where: { referenceType: 'PURCHASE', referenceId: purchaseId }
      });

      // 2. Delete the purchase record
      await tx.purchase.delete({
        where: { id: purchaseId }
      });

      // 3. Reset account balance to what it was before this purchase
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: balanceBeforePurchase }
      });
    });

    return NextResponse.json({ message: 'Purchase deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 });
  }
}


