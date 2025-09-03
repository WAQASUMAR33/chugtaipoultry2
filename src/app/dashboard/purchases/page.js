'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';

export default function PurchasesPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [partyAccounts, setPartyAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
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

  const fetchPurchases = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching purchases...');
      const response = await fetch('/api/purchases');
      console.log('Purchases response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Purchases fetched:', data);
        setPurchases(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch purchases:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPartyAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true);
      console.log('Fetching party accounts...');
      const response = await fetch('/api/accounts?type=PARTY_ACCOUNT');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Party accounts fetched:', data);
        setPartyAccounts(data);
        setAccountsError(null); // Clear any previous errors
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch party accounts:', response.status, errorText);
        setAccountsError(`Failed to fetch accounts: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching party accounts:', error);
      setAccountsError('Network error while fetching accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPurchases();
      fetchPartyAccounts();
    }
  }, [user]);

  const handleAddPurchase = () => {
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        fetchPurchases();
        fetchPartyAccounts(); // Refresh accounts to get updated balances
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create purchase');
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      alert('Failed to create purchase');
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
    const account = partyAccounts.find(acc => acc.id === parseInt(accountId));
    
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
    // In purchases: Balance = Previous Balance + Purchase Amount - Payment Made
    // This represents what we owe to the supplier
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
      document.querySelector('input[name="totalManagment"]').value = totalAmount.toFixed(2);
      
      // Recalculate final balance
      const payment = parseFloat(document.querySelector('input[name="payment"]')?.value || 0);
      const preBalance = selectedAccount ? selectedAccount.balance : 0;
      const finalBalance = calculateFinalBalance(totalAmount, payment, preBalance);
      document.querySelector('input[name="balance"]').value = finalBalance.toFixed(2);
    }
    
    if (name === 'totalManagment' || name === 'payment') {
      const totalAmount = parseFloat(document.querySelector('input[name="totalManagment"]')?.value || 0);
      const payment = parseFloat(document.querySelector('input[name="payment"]')?.value || 0);
      const preBalance = selectedAccount ? selectedAccount.balance : 0;
      
      const finalBalance = calculateFinalBalance(totalAmount, payment, preBalance);
      document.querySelector('input[name="balance"]').value = finalBalance.toFixed(2);
    }
  };

  const calculateBalance = (totalAmount, payment, preBalance) => {
    return (preBalance + totalAmount - payment);
  };

  const printPurchaseBill = (purchase) => {
    const printWindow = window.open('', '_blank');
    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Bill - ${purchase.account.name}</title>
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

        <div class="bill-title">PURCHASE BILL</div>

        <div class="bill-details">
          <div>
            <div class="detail-group">
              <div class="detail-label">Supplier:</div>
              <div class="detail-value">${purchase.account.name}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${new Date(purchase.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Vehicle Number:</div>
              <div class="detail-value">${purchase.vehicleNumber}</div>
            </div>
          </div>
          <div>
            <div class="detail-group">
              <div class="detail-label">Bill Number:</div>
              <div class="detail-value">#${purchase.id.toString().padStart(6, '0')}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Previous Balance:</div>
              <div class="detail-value">PKR ${purchase.preBalance.toFixed(2)}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Payment Made:</div>
              <div class="detail-value">PKR ${purchase.payment.toFixed(2)}</div>
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
              <td>${purchase.weight}</td>
              <td>${purchase.rate}</td>
              <td>${purchase.totalManagment.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Previous Balance:</span>
            <span class="total-value">PKR ${purchase.preBalance.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Purchase Amount:</span>
            <span class="total-value">PKR ${purchase.totalManagment.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Payment Made:</span>
            <span class="total-value">PKR ${purchase.payment.toFixed(2)}</span>
          </div>
          <div class="total-row" style="border-top: 2px solid #333; padding-top: 10px; font-size: 18px;">
            <span class="total-label">Final Balance:</span>
            <span class="total-value" style="color: ${purchase.balance >= 0 ? '#dc2626' : '#059669'}">
              PKR ${Math.abs(purchase.balance).toFixed(2)} ${purchase.balance >= 0 ? '(Owed)' : '(Credit)'}
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
        currentPage="purchases"
        title="Purchase Management"
      >
                 {/* Header */}
         <div className="mb-8">
           <div className="flex justify-between items-center mb-6">
             <h1 className="text-3xl font-bold text-gray-900">Purchase Management</h1>
             <button
               onClick={handleAddPurchase}
               className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
             >
               <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
               </svg>
               Create Purchase
             </button>
           </div>
           
           {/* Accounting Explanation */}
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
             <div className="flex items-start">
               <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               <div>
                 <h3 className="text-sm font-medium text-blue-900 mb-1">How Purchase Accounting Works</h3>
                 <p className="text-sm text-blue-700">
                   <strong>Purchase:</strong> When you buy goods, you owe money to the supplier (CREDIT to supplier account). 
                   <strong>Payment:</strong> When you pay, it reduces what you owe (DEBIT to supplier account). 
                   <strong>Balance:</strong> Shows total amount owed to supplier.
                 </p>
               </div>
             </div>
           </div>
         </div>

                 {/* Summary Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center">
               <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                 <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                 </svg>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Total Purchases</p>
                 <p className="text-2xl font-bold text-gray-900">{purchases.length}</p>
               </div>
             </div>
           </div>
           
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center">
               <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                 <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Total Amount Owed</p>
                 <p className="text-2xl font-bold text-red-600">
                   PKR {purchases.reduce((sum, p) => sum + (p.balance || 0), 0).toFixed(2)}
                 </p>
               </div>
             </div>
           </div>
           
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center">
               <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                 <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                 </svg>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Total Payments</p>
                 <p className="text-2xl font-bold text-green-600">
                   PKR {purchases.reduce((sum, p) => sum + (p.payment || 0), 0).toFixed(2)}
                 </p>
               </div>
             </div>
           </div>
         </div>

         {/* Purchases List */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Purchases ({purchases.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading purchases...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No purchases found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new purchase.
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
                       Party Account
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                       Vehicle Number
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
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(purchase.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                                             <td className="px-6 py-4 whitespace-nowrap">
                                                  <div className="text-sm font-medium text-gray-900">{purchase.account.name}</div>
                          <div className="text-sm text-gray-500">
                            Balance Owed: PKR {purchase.account.balance}
                          </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         <span className="font-medium text-purple-600">{purchase.vehicleNumber}</span>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         {purchase.weight}
                       </td>
                                                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          PKR {purchase.rate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         <span className="font-medium text-blue-600">
                           PKR {purchase.preBalance || 0}
                         </span>
                         <p className="text-xs text-gray-500 mt-1">
                           Previous balance owed
                         </p>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                         PKR {purchase.totalManagment}
                       </td>
                                             <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                         PKR {purchase.payment}
                       </td>
                                             <td className="px-6 py-4 whitespace-nowrap text-sm">
                         <span className={`font-medium ${
                           purchase.balance >= 0 ? 'text-red-600' : 'text-green-600'
                         }`}>
                           PKR {Math.abs(purchase.balance)}
                           {purchase.balance >= 0 ? ' (Owed)' : ' (Credit)'}
                         </span>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-center">
                         <button
                           onClick={() => printPurchaseBill(purchase)}
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

        {/* Purchase Form Modal */}
        {showForm && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Create New Purchase
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
                       vehicleNumber: formData.get('vehicleNumber'),
                       weight: formData.get('weight'),
                       rate: formData.get('rate'),
                       totalManagment: formData.get('totalManagment'),
                       preBalance: formData.get('preBalance'),
                       payment: formData.get('payment'),
                       balance: formData.get('balance')
                     };
                  handleFormSubmit(data);
                }} className="space-y-4">
                  {/* Party Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Party Account *
                    </label>
                    <select
                      name="accountId"
                      onChange={(e) => handleAccountChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                      disabled={isLoadingAccounts}
                    >
                      <option value="">
                        {isLoadingAccounts ? 'Loading accounts...' : 'Select Party Account'}
                      </option>
                      {partyAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} (Balance: PKR {account.balance})
                        </option>
                      ))}
                    </select>
                    {isLoadingAccounts && (
                      <div className="mt-1 text-sm text-blue-600">
                        Loading party accounts...
                      </div>
                    )}
                    {accountsError && (
                      <div className="mt-1 text-sm text-red-600 flex items-center justify-between">
                        <span>{accountsError}</span>
                        <button
                          type="button"
                          onClick={fetchPartyAccounts}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                                     {/* Date */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Purchase Date *
                     </label>
                     <input
                       type="date"
                       name="date"
                       defaultValue={new Date().toISOString().split('T')[0]}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900"
                       required
                     />
                   </div>

                   {/* Vehicle Number */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Vehicle Number *
                     </label>
                     <input
                       type="text"
                       name="vehicleNumber"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                       placeholder="Enter vehicle number (e.g., ABC-123)"
                       required
                     />
                     <p className="text-xs text-gray-500 mt-1">
                       Vehicle number for this purchase delivery
                     </p>
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
                       name="totalManagment"
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
                       Amount already owed to this supplier
                     </p>
                   </div>

                  {/* Payment */}
                  <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">
                       Payment Made (PKR)
                     </label>
                                         <input
                       type="number"
                       name="payment"
                       step="0.01"
                       min="0"
                       onChange={handleFormInputChange}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                       placeholder="Enter payment amount"
                     />
                     <p className="text-xs text-gray-500 mt-1">
                       Payment made for this purchase (optional)
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
                       Total amount owed to supplier after this purchase and payment
                     </p>
                   </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-800 border border-transparent rounded-lg hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      Create Purchase
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
