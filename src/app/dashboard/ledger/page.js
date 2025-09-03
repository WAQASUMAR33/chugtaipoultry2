'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';


export default function LedgerPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  // Filter states
  const [selectedAccount, setSelectedAccount] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

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

  const fetchLedgers = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });

      if (selectedAccount !== 'ALL') {
        params.append('accountId', selectedAccount);
      }
      if (selectedType !== 'ALL') {
        params.append('type', selectedType);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/ledgers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLedgers(data.ledgers);
        setPagination(data.pagination);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch ledgers');
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      } else {
        console.error('Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLedgers();
      fetchAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setCurrentPage(1);
      fetchLedgers(1);
    }
  }, [selectedAccount, selectedType, startDate, endDate]);

  const handlePageChange = (page) => {
    fetchLedgers(page);
  };

  const handleAddLedger = () => {
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      const response = await fetch('/api/ledgers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        fetchLedgers(currentPage);
        fetchAccounts(); // Refresh accounts to get updated balances
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create ledger entry');
      }
    } catch (error) {
      console.error('Error creating ledger entry:', error);
      alert('Failed to create ledger entry');
    }
  };

  const closeForm = () => {
    setShowForm(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const filteredLedgers = ledgers.filter(ledger => {
      if (selectedAccount !== 'ALL' && ledger.account.id !== parseInt(selectedAccount)) return false;
      if (selectedType !== 'ALL' && ledger.type !== selectedType) return false;
      if (startDate && new Date(ledger.createdAt) < new Date(startDate)) return false;
      if (endDate && new Date(ledger.createdAt) > new Date(endDate)) return false;
      return true;
    });

         const printContent = `
       <!DOCTYPE html>
       <html>
         <head>
           <title>Ledger Report - Chughtai Poultry</title>
           <style>
             body { font-family: Arial, sans-serif; margin: 20px; }
             .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
             .company-name { font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
             .company-address { font-size: 16px; color: #4b5563; margin-bottom: 8px; }

             .report-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
             .report-date { font-size: 14px; color: #6b7280; }
             .filters { margin-bottom: 20px; font-size: 14px; color: #666; }
             table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
             th { background-color: #f8f9fa; font-weight: bold; }
             .amount { text-align: right; }
             @media print { body { margin: 0; } }
           </style>
         </head>
         <body>
           <div class="header">
             <div class="company-name">CHUGHTAI POULTRY</div>
             <div class="company-address">Old Rasool Road, Mandi Bahauddin</div>
             <div class="report-title">Ledger Report</div>
             <div class="report-date">Generated on: ${new Date().toLocaleDateString()}</div>
           </div>
          
          <div class="filters">
            <strong>Filters Applied:</strong><br>
            Account: ${selectedAccount === 'ALL' ? 'All Accounts' : accounts.find(a => a.id === parseInt(selectedAccount))?.name || 'N/A'}<br>
            Type: ${selectedType === 'ALL' ? 'All Types' : selectedType}<br>
            Date Range: ${startDate ? startDate : 'From Beginning'} - ${endDate ? endDate : 'To End'}<br>
            Total Entries: ${filteredLedgers.length}
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Account</th>
                <th>Type</th>
                <th>Details</th>
                <th>Pre</th>
                <th>Dr</th>
                <th>Cr</th>
                <th>Post</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLedgers.map(ledger => `
                <tr>
                  <td>${new Date(ledger.createdAt).toLocaleDateString()} ${new Date(ledger.createdAt).toLocaleTimeString()}</td>
                  <td>${ledger.account.name} (${ledger.account.type.replace('_', ' ')})</td>
                  <td>${ledger.type}</td>
                  <td>${ledger.details}</td>
                  <td class="amount">${ledger.preBalanceLabel}</td>
                  <td class="amount">${ledger.drAmount > 0 ? `PKR ${ledger.drAmount.toFixed(2)}` : '-'}</td>
                  <td class="amount">${ledger.crAmount > 0 ? `PKR ${ledger.crAmount.toFixed(2)}` : '-'}</td>
                  <td class="amount">${ledger.postBalanceLabel}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  

  const getTypeColor = (type) => {
    switch (type) {
      case 'PURCHASE': return 'bg-red-100 text-red-800';
      case 'PAYMENT': return 'bg-green-100 text-green-800';
      case 'SALE': return 'bg-blue-100 text-blue-800';
      case 'MANUAL': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount) => {
    return `PKR ${parseFloat(amount || 0).toFixed(2)}`;
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
         
         @media print {
           .no-print {
             display: none !important;
           }
         }
       `}</style>
      <DashboardLayout 
        user={user} 
        currentPage="ledger"
        title="Ledger Management"
      >
        {/* Header */}
                 <div className="mb-8">
           <div className="flex justify-between items-center mb-6">
             <h1 className="text-3xl font-bold text-gray-900">Ledger Management</h1>
             <div className="flex space-x-3">
               <button
                 onClick={handlePrint}
                 className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
               >
                 <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                 </svg>
                 Print
               </button>
               <button
                 onClick={handleAddLedger}
                 className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
               >
                 <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                 </svg>
                 Add Entry
               </button>
             </div>
           </div>
         </div>

                 {/* Filters */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
             <div className="flex space-x-2">
               <button
                 onClick={handlePrint}
                 className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
               >
                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                 </svg>
                 Print
               </button>

             </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Account Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
              >
                <option value="ALL">All Types</option>
                <option value="PURCHASE">Purchase</option>
                <option value="PAYMENT">Payment</option>
                <option value="SALE">Sale</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
              />
            </div>
          </div>
        </div>

                 {/* Ledger List */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-200">
           <div className="px-6 py-4 border-b border-gray-200">
             <div className="flex justify-between items-center">
               <h2 className="text-lg font-semibold text-gray-900">
                 Ledger Entries ({pagination.totalCount})
               </h2>
               <div className="text-sm text-gray-600">
                 <span className="font-medium">Filters:</span>
                 {selectedAccount !== 'ALL' && ` Account: ${accounts.find(a => a.id === parseInt(selectedAccount))?.name}`}
                 {selectedType !== 'ALL' && ` Type: ${selectedType}`}
                 {startDate && ` From: ${startDate}`}
                 {endDate && ` To: ${endDate}`}
                 {selectedAccount === 'ALL' && selectedType === 'ALL' && !startDate && !endDate && ' All entries'}
               </div>
             </div>
           </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading ledger entries...</p>
            </div>
          ) : ledgers.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No ledger entries found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedAccount !== 'ALL' || selectedType !== 'ALL' || startDate || endDate
                  ? 'Try adjusting your filters.'
                  : 'Get started by creating a new ledger entry.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                                             <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Pre
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Debit (Dr)
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Credit (Cr)
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Post
                       </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ledgers.map((ledger) => (
                      <tr key={ledger.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {new Date(ledger.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-gray-500">
                              {new Date(ledger.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{ledger.account.name}</div>
                          <div className="text-sm text-gray-500">{ledger.account.type.replace('_', ' ')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(ledger.type)}`}>
                            {ledger.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs">
                            {ledger.details}
                          </div>
                        </td>
                                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                           <span className="font-medium text-blue-600">
                             {ledger.preBalanceLabel}
                           </span>
                           <p className="text-xs text-gray-500 mt-1">
                             Balance before
                           </p>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                           {ledger.drAmount > 0 ? (
                             <span className="font-medium text-red-600">{formatCurrency(ledger.drAmount)}</span>
                           ) : (
                             <span className="text-gray-400">-</span>
                           )}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                           {ledger.crAmount > 0 ? (
                             <span className="font-medium text-green-600">{formatCurrency(ledger.crAmount)}</span>
                           ) : (
                             <span className="text-gray-400">-</span>
                           )}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                           <span className={`font-medium ${
                             ledger.postBalanceLabel.includes('Cr') ? 'text-red-600' : 
                             ledger.postBalanceLabel.includes('Dr') ? 'text-blue-600' : 'text-green-600'
                           }`}>
                             {ledger.postBalanceLabel}
                           </span>
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                             </div>

               {/* Journal Entries Section */}
               <div className="px-6 py-4 border-t border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4">Journal Entries</h3>
                 <div className="space-y-3">
                   {ledgers.map((ledger) => (
                     <div key={`journal-${ledger.id}`} className="bg-gray-50 rounded-lg p-4">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-sm font-medium text-gray-700">
                           {new Date(ledger.createdAt).toLocaleDateString('en-US', {
                             year: 'numeric',
                             month: 'short',
                             day: 'numeric'
                           })} - {ledger.type}
                         </span>
                         <span className="text-xs text-gray-500">
                           {ledger.account.name} ({ledger.account.type.replace('_', ' ')})
                         </span>
                       </div>
                       <div className="text-sm text-gray-600 mb-2">{ledger.details}</div>
                       <div className="grid grid-cols-2 gap-4 text-sm">
                         {ledger.drAmount > 0 && (
                           <div className="bg-red-50 p-2 rounded border border-red-200">
                             <span className="font-medium text-red-700">Dr.</span> {ledger.account.name} - {formatCurrency(ledger.drAmount)}
                           </div>
                         )}
                         {ledger.crAmount > 0 && (
                           <div className="bg-green-50 p-2 rounded border border-green-200">
                             <span className="font-medium text-green-700">Cr.</span> {ledger.account.name} - {formatCurrency(ledger.crAmount)}
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Pagination */}
               {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing page {pagination.currentPage} of {pagination.totalPages} 
                      ({pagination.totalCount} total entries)
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrevPage}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNextPage}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Ledger Entry Modal */}
        {showForm && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Ledger Entry
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
                    drAmount: formData.get('drAmount'),
                    crAmount: formData.get('crAmount'),
                    details: formData.get('details'),
                    type: formData.get('type')
                  };
                  handleFormSubmit(data);
                }} className="space-y-4">
                  {/* Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account *
                    </label>
                    <select
                      name="accountId"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                    >
                      <option value="">Select Account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Entry Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Entry Type *
                    </label>
                    <select
                      name="type"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                    >
                      <option value="MANUAL">Manual Entry</option>
                      <option value="PURCHASE">Purchase</option>
                      <option value="PAYMENT">Payment</option>
                      <option value="SALE">Sale</option>
                    </select>
                  </div>

                  {/* Amount Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Debit Amount (Dr)
                      </label>
                      <input
                        type="number"
                        name="drAmount"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                        placeholder="Enter debit amount"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Credit Amount (Cr)
                      </label>
                      <input
                        type="number"
                        name="crAmount"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                        placeholder="Enter credit amount"
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Details *
                    </label>
                    <textarea
                      name="details"
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                      placeholder="Enter transaction details"
                      required
                    />
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
                      Add Entry
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
