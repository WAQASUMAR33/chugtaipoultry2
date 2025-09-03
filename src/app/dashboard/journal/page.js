'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';

export default function JournalPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  // Filter states
  const [selectedAccount, setSelectedAccount] = useState('ALL');
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

  // Form states
  const [formData, setFormData] = useState({
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    description: ''
  });

  // Transfer mode states
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [debitAccountBalance, setDebitAccountBalance] = useState(0);
  const [creditAccountBalance, setCreditAccountBalance] = useState(0);

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

  const fetchJournals = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });

      if (selectedAccount !== 'ALL') {
        params.append('accountId', selectedAccount);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/journals?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJournals(data.journals);
        setPagination(data.pagination);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch journals');
      }
    } catch (error) {
      console.error('Error fetching journals:', error);
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
      fetchJournals();
      fetchAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setCurrentPage(1);
      fetchJournals(1);
    }
  }, [selectedAccount, startDate, endDate]);

  const handlePageChange = (page) => {
    fetchJournals(page);
  };

  const handleAddJournal = () => {
    setShowForm(true);
    setFormData({
      debitAccountId: '',
      creditAccountId: '',
      amount: '',
      description: ''
    });
    setIsTransferMode(false);
    setTransferAmount('');
    setDebitAccountBalance(0);
    setCreditAccountBalance(0);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.debitAccountId || !formData.creditAccountId || !formData.amount || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.debitAccountId === formData.creditAccountId) {
      alert('Debit and Credit accounts cannot be the same');
      return;
    }

    try {
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        fetchJournals(currentPage);
        fetchAccounts(); // Refresh accounts to get updated balances
        alert('Journal entry created successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create journal entry');
      }
    } catch (error) {
      console.error('Error creating journal entry:', error);
      alert('Failed to create journal entry');
    }
  };

  const closeForm = () => {
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update balances when accounts change
    if (name === 'debitAccountId' && value) {
      const account = accounts.find(acc => acc.id === parseInt(value));
      setDebitAccountBalance(account ? account.balance : 0);
    }
    if (name === 'creditAccountId' && value) {
      const account = accounts.find(acc => acc.id === parseInt(value));
      setCreditAccountBalance(account ? account.balance : 0);
    }
  };

  const toggleTransferMode = () => {
    setIsTransferMode(!isTransferMode);
    if (!isTransferMode) {
      // When enabling transfer mode, auto-fill description
      setFormData(prev => ({
        ...prev,
        description: 'Money Transfer between accounts'
      }));
    }
  };

  const calculateTransferAmount = () => {
    if (!debitAccountBalance || !creditAccountBalance) return 0;
    
    // Calculate how much can be transferred
    // For customer to party transfer: use customer's owed amount
    if (debitAccountBalance > 0) { // Customer owes us money
      return Math.min(debitAccountBalance, Math.abs(creditAccountBalance));
    }
    return 0;
  };

  const handleTransferAmountChange = (e) => {
    const amount = parseFloat(e.target.value) || 0;
    setTransferAmount(amount);
    
    // Auto-update the main amount field
    setFormData(prev => ({
      ...prev,
      amount: amount.toString()
    }));
  };

  const getAccountTypeColor = (type) => {
    switch (type) {
      case 'PARTY_ACCOUNT': return 'bg-blue-100 text-blue-800';
      case 'CUSTOMER_ACCOUNT': return 'bg-green-100 text-green-800';
      case 'EXPENSE': return 'bg-red-100 text-red-800';
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
      `}</style>
      
      <DashboardLayout 
        user={user} 
        currentPage="journal"
        title="Journal Management"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Journal Management</h1>
            <button
              onClick={handleAddJournal}
              className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Journal Entry
            </button>
          </div>
          
          
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Journal List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
                             <h2 className="text-lg font-semibold text-gray-900">
                 Journal Entries ({journals.length * 2} transactions from {pagination.totalCount} entries)
               </h2>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Filters:</span>
                {selectedAccount !== 'ALL' && ` Account: ${accounts.find(a => a.id === parseInt(selectedAccount))?.name}`}
                {startDate && ` From: ${startDate}`}
                {endDate && ` To: ${endDate}`}
                {selectedAccount === 'ALL' && !startDate && !endDate && ' All entries'}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading journal entries...</p>
            </div>
          ) : journals.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No journal entries found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedAccount !== 'ALL' || startDate || endDate
                  ? 'Try adjusting your filters.'
                  : 'Get started by creating a new journal entry.'}
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
                       <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Type
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Pre-Balance
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Dr
                       </th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Cr
                       </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Post-Balance
                         </th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Description
                         </th>
                     </tr>
                   </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {journals.flatMap((journal, index) => [
                      // Debit Entry
                      <tr key={`${journal.id}-dr`} className="hover:bg-red-50 border-l-4 border-l-red-500">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {new Date(journal.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-gray-500">
                              {new Date(journal.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-red-600">{journal.debitAccount.name}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(journal.debitAccount.type)}`}>
                            {journal.debitAccount.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Dr (Debit)
                          </span>
                        </td>
                                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                           {formatCurrency(journal.preBalances?.debitAccount || journal.debitAccount.balance + journal.amount || 0)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                           {formatCurrency(journal.amount)}
                         </td>
                                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-400">
                           -
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                           {formatCurrency(journal.debitAccount.balance || 0)}
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-900">
                           <div className="max-w-xs">
                             {journal.description}
                           </div>
                         </td>
                       </tr>,
                      // Credit Entry
                      <tr key={`${journal.id}-cr`} className="hover:bg-green-50 border-l-4 border-l-green-500">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {new Date(journal.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-gray-500">
                              {new Date(journal.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600">{journal.creditAccount.name}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(journal.creditAccount.type)}`}>
                            {journal.creditAccount.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Cr (Credit)
                          </span>
                        </td>
                                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                           {formatCurrency(journal.preBalances?.creditAccount || journal.creditAccount.balance + journal.amount || 0)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-400">
                           -
                         </td>
                                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                           {formatCurrency(journal.amount)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                           {formatCurrency(journal.creditAccount.balance || 0)}
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-900">
                           <div className="max-w-xs">
                             {journal.description}
                           </div>
                         </td>
                       </tr>,
                      // Add separator between different journal entries (but not after the last one)
                      index < journals.length - 1 && (
                                                 <tr key={`${journal.id}-separator`} className="bg-gray-100">
                           <td colSpan="8" className="px-6 py-2">
                             <div className="border-t-2 border-gray-300"></div>
                           </td>
                         </tr>
                      )
                    ])}
                  </tbody>
                </table>
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

        {/* Add Journal Entry Modal */}
        {showForm && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Journal Entry
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

                

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  {/* Transfer Mode Toggle */}
                  <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <input
                      type="checkbox"
                      id="transferMode"
                      checked={isTransferMode}
                      onChange={toggleTransferMode}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="transferMode" className="text-sm font-medium text-blue-900">
                      Enable Transfer Mode (Auto-calculate transfer amounts)
                    </label>
                  </div>

                  {/* Debit Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Debit Account (Dr) *
                    </label>
                    <select
                      name="debitAccountId"
                      value={formData.debitAccountId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                    >
                      <option value="">Select Debit Account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type.replace('_', ' ')}) - Balance: PKR {account.balance || 0}
                        </option>
                      ))}
                    </select>
                    {formData.debitAccountId && (
                      <div className="mt-1 text-sm text-gray-600">
                        Current Balance: <span className="font-medium text-blue-600">PKR {debitAccountBalance}</span>
                      </div>
                    )}
                  </div>

                  {/* Credit Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Account (Cr) *
                    </label>
                    <select
                      name="creditAccountId"
                      value={formData.creditAccountId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                      required
                    >
                      <option value="">Select Credit Account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type.replace('_', ' ')}) - Balance: PKR {account.balance || 0}
                        </option>
                      ))}
                    </select>
                    {formData.creditAccountId && (
                      <div className="mt-1 text-sm text-gray-600">
                        Current Balance: <span className="font-medium text-green-600">PKR {creditAccountBalance}</span>
                      </div>
                    )}
                  </div>

                  {/* Transfer Amount Calculation (when in transfer mode) */}
                  {isTransferMode && formData.debitAccountId && formData.creditAccountId && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-sm font-medium text-green-900 mb-2">Transfer Calculation</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Customer owes us:</span>
                          <span className="font-medium text-blue-600">PKR {debitAccountBalance}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">We owe party:</span>
                          <span className="font-medium text-green-600">PKR {Math.abs(creditAccountBalance)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Recommended transfer:</span>
                            <span className="font-medium text-green-800">PKR {calculateTransferAmount()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (PKR) *
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                      placeholder={isTransferMode ? "Enter transfer amount" : "Enter amount"}
                      required
                    />
                    {isTransferMode && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-green-600">
                          💡 Transfer Mode: This will move money from debit account to credit account
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const recommendedAmount = calculateTransferAmount();
                            setFormData(prev => ({ ...prev, amount: recommendedAmount.toString() }));
                          }}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 transition-colors"
                        >
                          Use Recommended Amount: PKR {calculateTransferAmount()}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                      placeholder="Enter transaction description"
                      required
                    />
                  </div>

                  {/* Transfer Summary (when in transfer mode) */}
                  {isTransferMode && formData.amount && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="text-sm font-medium text-yellow-900 mb-2">📋 Transfer Summary</h4>
                      <div className="text-sm text-yellow-800 space-y-2">
                        <div className="flex justify-between">
                          <span>Amount to transfer:</span>
                          <span className="font-medium">PKR {formData.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>From (Debit):</span>
                          <span className="font-medium text-blue-600">
                            {accounts.find(acc => acc.id === parseInt(formData.debitAccountId))?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>To (Credit):</span>
                          <span className="font-medium text-green-600">
                            {accounts.find(acc => acc.id === parseInt(formData.creditAccountId))?.name}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between font-medium">
                            <span>New balances after transfer:</span>
                          </div>
                          <div className="text-xs space-y-1 mt-1">
                            <div className="flex justify-between">
                              <span>Debit account:</span>
                              <span className="text-blue-600">PKR {(debitAccountBalance - parseFloat(formData.amount)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Credit account:</span>
                              <span className="text-green-600">PKR {(creditAccountBalance - parseFloat(formData.amount)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

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
                      Create Entry
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
