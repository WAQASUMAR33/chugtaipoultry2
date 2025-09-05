'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';

export default function SalesPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [customerAccounts, setCustomerAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    accountId: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const fetchSales = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sales');
      if (response.ok) {
        const data = await response.json();
        setSales(data);
        setFilteredSales(data);
      } else {
        console.error('Failed to fetch sales');
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerAccounts = async () => {
    try {
      const response = await fetch('/api/accounts?type=CUSTOMER_ACCOUNT');
      if (response.ok) {
        const data = await response.json();
        setCustomerAccounts(data);
      } else {
        console.error('Failed to fetch customer accounts');
      }
    } catch (error) {
      console.error('Error fetching customer accounts:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSales();
      fetchCustomerAccounts();
    }
  }, [user]);

  // Filter function
  const filterSales = useCallback(() => {
    let filtered = [...sales];

    // Filter by account
    if (filters.accountId && filters.accountId !== 'ALL') {
      filtered = filtered.filter(sale => 
        sale.accountId === parseInt(filters.accountId)
      );
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(sale => 
        new Date(sale.date) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(sale => 
        new Date(sale.date) <= new Date(filters.endDate)
      );
    }

    // Filter by search term (account name or amount)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.account.name.toLowerCase().includes(searchLower) ||
        (sale.totalAmount && sale.totalAmount.toString().includes(filters.searchTerm))
      );
    }

    setFilteredSales(filtered);
  }, [sales, filters]);

  // Apply filters when sales or filters change
  useEffect(() => {
    filterSales();
  }, [filterSales]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      accountId: '',
      startDate: '',
      endDate: '',
      searchTerm: ''
    });
  };

  const handleAddSale = () => {
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    if (isSubmitting) return; // Prevent multiple submissions
    
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        fetchSales();
        fetchCustomerAccounts(); // Refresh accounts to get updated balances
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create sale');
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Failed to create sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedAccount(null);
  };

  const handleAccountChange = async (accountId) => {
    if (!accountId) {
      setSelectedAccount(null);
      return;
    }
    
    // Find the account in our local state
    const account = customerAccounts.find(acc => acc.id === parseInt(accountId));
    
    // Fetch the latest balance from the server to ensure accuracy
    try {
      const response = await fetch(`/api/accounts/${accountId}`);
      if (response.ok) {
        const updatedAccount = await response.json();
        setSelectedAccount(updatedAccount);
      } else {
        // Fallback to local state if API fails
        setSelectedAccount(account);
      }
    } catch (error) {
      console.error('Error fetching updated account balance:', error);
      // Fallback to local state if API fails
      setSelectedAccount(account);
    }
  };

  const calculateFinalBalance = (totalAmount, payment, preBalance) => {
    // In sales: Balance = Previous Balance + Sale Amount - Payment Made
    // This represents what the customer owes us
    return (preBalance + totalAmount - payment);
  };

  const handleFormInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'weight' || name === 'rate') {
      // Auto-calculate total amount when weight or rate changes
      const weight = parseFloat(document.querySelector('input[name="weight"]')?.value || 0);
      const rate = parseFloat(document.querySelector('input[name="rate"]')?.value || 0);
      const totalAmount = weight * rate;
      
      // Update total amount field
      document.querySelector('input[name="totalAmount"]').value = totalAmount.toFixed(2);
      
      // Recalculate final balance
      const payment = parseFloat(document.querySelector('input[name="payment"]')?.value || 0);
      const preBalance = selectedAccount ? selectedAccount.balance : 0;
      const finalBalance = calculateFinalBalance(totalAmount, payment, preBalance);
      document.querySelector('input[name="balance"]').value = finalBalance.toFixed(2);
    }
    
    if (name === 'totalAmount' || name === 'payment') {
      const totalAmount = parseFloat(document.querySelector('input[name="totalAmount"]')?.value || 0);
      const payment = parseFloat(document.querySelector('input[name="payment"]')?.value || 0);
      const preBalance = selectedAccount ? selectedAccount.balance : 0;
      
      const finalBalance = calculateFinalBalance(totalAmount, payment, preBalance);
      document.querySelector('input[name="balance"]').value = finalBalance.toFixed(2);
    }
  };

  const printSaleBill = (sale) => {
    const printWindow = window.open('', '_blank');
    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sale Bill - ${sale.account.name}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
                     .company-name {
             font-size: 28px;
             font-weight: 900;
             color: #1f2937;
             margin-bottom: 5px;
           }
          .company-address {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 5px;
          }
          
          .bill-title {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            color: #1f2937;
          }
          .bill-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .detail-group {
            margin-bottom: 15px;
          }
          .detail-label {
            font-weight: bold;
            color: #374151;
            margin-bottom: 5px;
          }
          .detail-value {
            color: #111827;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .items-table th,
          .items-table td {
            border: 1px solid #d1d5db;
            padding: 12px;
            text-align: left;
          }
          .items-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
          }
          .total-section {
            margin-top: 30px;
            text-align: right;
          }
          .total-row {
            margin: 10px 0;
            font-size: 16px;
          }
          .total-label {
            font-weight: bold;
            color: #374151;
            margin-right: 20px;
          }
          .total-value {
            color: #111827;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #d1d5db;
            padding-top: 20px;
          }
          .print-button {
            background-color: #3b82f6;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 20px;
          }
          .print-button:hover {
            background-color: #2563eb;
          }
        </style>
      </head>
      <body>
                 <div class="header">
           <div class="company-name">Chughtai Poultry</div>
           <div class="company-address">Old Rasool Road, Mandi Bahauddin</div>
         </div>

        <div class="bill-title">SALE BILL</div>

        <div class="bill-details">
          <div>
            <div class="detail-group">
              <div class="detail-label">Customer:</div>
              <div class="detail-value">${sale.account.name}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${new Date(sale.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Bill Number:</div>
              <div class="detail-value">#${sale.id.toString().padStart(6, '0')}</div>
            </div>
          </div>
          <div>
            <div class="detail-group">
              <div class="detail-label">Previous Balance:</div>
              <div class="detail-value">PKR ${sale.preBalance.toFixed(2)}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Payment Made:</div>
              <div class="detail-value">PKR ${sale.payment.toFixed(2)}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Final Balance:</div>
              <div class="detail-value" style="color: ${sale.balance >= 0 ? '#2563eb' : '#059669'}">
                PKR ${Math.abs(sale.balance).toFixed(2)} ${sale.balance >= 0 ? '(Owed)' : '(Credit)'}
              </div>
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Weight (kg)</th>
              <th>Rate (PKR/kg)</th>
              <th>Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Poultry Feed</td>
              <td>${sale.weight}</td>
              <td>${sale.rate}</td>
              <td>${sale.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Previous Balance:</span>
            <span class="total-value">PKR ${sale.preBalance.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Sale Amount:</span>
            <span class="total-value">PKR ${sale.totalAmount.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Payment Made:</span>
            <span class="total-value">PKR ${sale.payment.toFixed(2)}</span>
          </div>
          <div class="total-row" style="border-top: 2px solid #333; padding-top: 10px; font-size: 18px;">
            <span class="total-label">Final Balance:</span>
            <span class="total-value" style="color: ${sale.balance >= 0 ? '#2563eb' : '#059669'}">
              PKR ${Math.abs(sale.balance).toFixed(2)} ${sale.balance >= 0 ? '(Owed)' : '(Credit)'}
            </span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated on: ${new Date().toLocaleString('en-US')}</p>
        </div>

        <button class="print-button no-print" onclick="window.print()">Print Bill</button>
      </body>
      </html>
    `;
    
    printWindow.document.write(billContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <style jsx global>{`
        input::placeholder {
          color: #6b7280 !important;
        }
        input {
          color: #111827 !important;
        }
        select {
          color: #111827 !important;
        }
        textarea::placeholder {
          color: #6b7280 !important;
        }
        textarea {
          color: #111827 !important;
        }
      `}</style>
      <DashboardLayout 
        user={user} 
        currentPage="sales"
        title="Sales Management"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
            <button
              onClick={handleAddSale}
              className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Sale
            </button>
          </div>
          
          {/* Accounting Explanation */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-900 mb-1">How Sales Accounting Works</h3>
                <p className="text-sm text-green-700">
                  <strong>Sale:</strong> When you sell goods, the customer owes you money (DEBIT to customer account). 
                  <strong>Payment:</strong> When customer pays, it reduces what they owe (CREDIT to customer account). 
                  <strong>Balance:</strong> Shows total amount customer owes you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{sales.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Amount Owed</p>
                <p className="text-2xl font-bold text-blue-600">
                  PKR {sales.reduce((sum, s) => sum + (s.balance || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Payments</p>
                <p className="text-2xl font-bold text-green-600">
                  PKR {sales.reduce((sum, s) => sum + (s.payment || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Filter Sales</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Account Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account
                </label>
                <select
                  value={filters.accountId}
                  onChange={(e) => handleFilterChange('accountId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                >
                  <option value="">All Accounts</option>
                  {customerAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                />
              </div>

              {/* Search Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Account name, amount..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
              <span className="text-sm text-gray-500">
                Showing {filteredSales.length} of {sales.length} sales
              </span>
            </div>
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Sales ({filteredSales.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading sales...</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sales found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new sale.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weight (kg)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate (PKR)
                    </th>
                                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Pre-Balance
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Total Amount
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Payment
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Balance Owed
                     </th>
                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Actions
                     </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sale.account.name}</div>
                        <div className="text-sm text-gray-500">
                          Balance Owed: PKR {sale.account.balance}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.weight}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        PKR {sale.rate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-medium text-blue-600">
                          PKR {sale.preBalance || 0}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          Previous balance owed
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        PKR {sale.totalAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        PKR {sale.payment}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          sale.balance >= 0 ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          PKR {Math.abs(sale.balance)}
                          {sale.balance >= 0 ? ' (Owed)' : ' (Credit)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => printSaleBill(sale)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200 flex items-center mx-auto"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sale Form Modal */}
        {showForm && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Create New Sale
                  </h3>
                  <button
                    onClick={closeForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const data = {
                    accountId: formData.get('accountId'),
                    date: formData.get('date'),
                    weight: formData.get('weight'),
                    rate: formData.get('rate'),
                    totalAmount: formData.get('totalAmount'),
                    preBalance: formData.get('preBalance'),
                    payment: formData.get('payment'),
                    balance: formData.get('balance')
                  };
                  handleFormSubmit(data);
                }} className="space-y-4">
                  {/* Customer Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Account *
                    </label>
                    <select
                      name="accountId"
                      onChange={(e) => handleAccountChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select Customer Account</option>
                      {customerAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} (Balance: PKR {account.balance})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sale Date *
                    </label>
                    <input
                      type="date"
                      name="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Weight and Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (kg) *
                      </label>
                      <input
                        type="number"
                        name="weight"
                        step="0.01"
                        min="0"
                        onChange={handleFormInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                        placeholder="Enter weight"
                        required
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Weight in kilograms (e.g., 10 kg)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rate (PKR) *
                      </label>
                      <input
                        type="number"
                        name="rate"
                        step="0.01"
                        min="0"
                        onChange={handleFormInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                        placeholder="Enter rate"
                        required
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Rate per kg (e.g., PKR 100 per kg)
                      </p>
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount (PKR) *
                    </label>
                    <input
                      type="number"
                      name="totalAmount"
                      step="0.01"
                      min="0"
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                      placeholder="Auto-calculated"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total Amount = Weight × Rate (automatically calculated)
                    </p>
                  </div>

                  {/* Pre-Balance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Previous Balance Owed (PKR)
                    </label>
                    <input
                      type="number"
                      name="preBalance"
                      step="0.01"
                      value={selectedAccount ? selectedAccount.balance : ''}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount already owed by this customer
                    </p>
                  </div>

                  {/* Payment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Received (PKR)
                    </label>
                    <input
                      type="number"
                      name="payment"
                      step="0.01"
                      min="0"
                      onChange={handleFormInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                      placeholder="Enter payment amount"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Payment received for this sale (optional)
                    </p>
                  </div>

                  {/* Final Balance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Final Balance Owed (PKR)
                    </label>
                    <input
                      type="number"
                      name="balance"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total amount owed by customer after this sale and payment
                    </p>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={isSubmitting}
                      className={`px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                        isSubmitting 
                          ? 'text-gray-400 bg-gray-50 cursor-not-allowed' 
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 flex items-center ${
                        isSubmitting 
                          ? 'bg-blue-600 cursor-not-allowed' 
                          : 'bg-blue-800 hover:bg-blue-900'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </>
                      ) : (
                        'Create Sale'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
