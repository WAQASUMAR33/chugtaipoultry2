import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET single account by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const account = await prisma.account.findUnique({
      where: { id: parseInt(id) },
      include: {
        ledgers: {
          orderBy: { createdAt: 'desc' }
        },
        sales: {
          orderBy: { date: 'desc' }
        },
        purchases: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

// PUT update account
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, address, type } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Note: Balance is not editable - it's calculated from ledger entries
    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        name,
        phone,
        address,
        type
        // balance is intentionally excluded - it should only change through transactions
      }
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

// DELETE account
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // Check if account has any related records
    const account = await prisma.account.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { ledgers: true, sales: true, purchases: true }
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account._count.ledgers > 0 || account._count.sales > 0 || account._count.purchases > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account with existing transactions' },
        { status: 400 }
      );
    }

    await prisma.account.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
