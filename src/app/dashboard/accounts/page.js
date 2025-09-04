'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [selectedType, setSelectedType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingAccount, setViewingAccount] = useState(null);
  const [viewingLedger, setViewingLedger] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        console.log('Accounts data:', data); // Debug log
        setAccounts(data);
      } else {
        console.error('Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAccounts = useCallback(() => {
    let filtered = accounts;

    if (selectedType !== 'ALL') {
      filtered = filtered.filter(account => account.type === selectedType);
    }

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.phone && account.phone.includes(searchTerm)) ||
        (account.address && account.address.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredAccounts(filtered);
  }, [accounts, selectedType, searchTerm]);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (accounts.length > 0) {
      filterAccounts();
    }
  }, [accounts, selectedType, searchTerm]);

  const handleAddAccount = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleViewAccount = async (account) => {
    try {
      const response = await fetch(`/api/accounts/${account.id}`);
      if (response.ok) {
        const accountData = await response.json();
        setViewingAccount(accountData);
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
    }
  };

  const handleViewLedger = async (account) => {
    try {
      const response = await fetch(`/api/accounts/${account.id}`);
      if (response.ok) {
        const accountData = await response.json();
        setViewingLedger(accountData);
      }
    } catch (error) {
      console.error('Error fetching account ledger:', error);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!confirm(`Are you sure you want to delete ${account.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchAccounts();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      const url = editingAccount 
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts';
      
      const method = editingAccount ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingAccount(null);
        fetchAccounts();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save account');
      }
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Failed to save account');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingAccount(null);
  };

  const closeView = () => {
    setViewingAccount(null);
  };

  const closeLedger = () => {
    setViewingLedger(null);
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
        currentPage="accounts"
        title="Account Management"
      >
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
                     <button
             onClick={handleAddAccount}
             className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center"
           >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Account
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
                             <select
                 value={selectedType}
                 onChange={(e) => setSelectedType(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
               >
                <option value="ALL">All Types</option>
                <option value="CASH">Cash</option>
                <option value="PARTY_ACCOUNT">Party Account</option>
                <option value="CUSTOMER_ACCOUNT">Customer Account</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
                             <input
                 type="text"
                 placeholder="Search by name, phone, or address..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Accounts ({filteredAccounts.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading accounts...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedType !== 'ALL' 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by creating a new account.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.name}</div>
                        {account.address && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {account.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.type === 'CASH' ? 'bg-red-100 text-red-800' :
                        account.type === 'PARTY_ACCOUNT' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {account.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {account.phone && (
                        <div className="text-sm text-gray-900">{account.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <span>Ledger: {account._count?.ledgers || 0}</span>
                        <span>Sales: {account._count?.sales || 0}</span>
                        <span>Purchase: {account._count?.purchases || 0}</span>
                        <span>Journals: {(account._count?.debitJournals || 0) + (account._count?.creditJournals || 0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-bold ${
                        account.type === 'PARTY_ACCOUNT' ? 'text-red-600' :
                        account.type === 'CUSTOMER_ACCOUNT' ? 'text-green-600' :
                        'text-gray-900'
                      }`}>
                        PKR {account.balance ? parseFloat(account.balance).toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                                                 <button
                           onClick={() => handleViewAccount(account)}
                           className="text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-xs"
                         >
                          View
                        </button>
                        <button
                          onClick={() => handleViewLedger(account)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded text-xs"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => handleEditAccount(account)}
                          className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-2 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

                           {/* Account Form Modal */}
        {showForm && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingAccount ? 'Edit Account' : 'Add New Account'}
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
                  name: formData.get('name'),
                  phone: formData.get('phone'),
                  address: formData.get('address'),
                  type: formData.get('type')
                };
                
                // Only include balance when creating new account
                if (!editingAccount) {
                  data.balance = formData.get('balance');
                }
                
                handleFormSubmit(data);
              }} className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name *
                  </label>
                                     <input
                     type="text"
                     name="name"
                     defaultValue={editingAccount?.name || ''}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                     placeholder="Enter account name"
                     required
                   />
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type *
                  </label>
                                     <select
                     name="type"
                     defaultValue={editingAccount?.type || 'CUSTOMER_ACCOUNT'}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 bg-white"
                     required
                   >
                    <option value="CUSTOMER_ACCOUNT">Customer Account</option>
                    <option value="PARTY_ACCOUNT">Party Account</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                                     <input
                     type="tel"
                     name="phone"
                     defaultValue={editingAccount?.phone || ''}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                     placeholder="Enter phone number"
                   />
                </div>

                                 {/* Address */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Address
                   </label>
                   <textarea
                     name="address"
                     defaultValue={editingAccount?.address || ''}
                     rows="3"
                     className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                     placeholder="Enter address"
                   />
                 </div>

                 {/* Balance - Only show when creating new account */}
                 {!editingAccount && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Initial Balance (PKR)
                     </label>
                     <input
                       type="number"
                       name="balance"
                       step="0.01"
                       defaultValue={0}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-gray-900 placeholder-gray-500"
                       placeholder="Enter initial balance (optional)"
                     />
                     <p className="text-xs text-gray-500 mt-1">
                       Note: Balance can only be set when creating the account. After creation, balance changes through transactions only.
                     </p>
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
                    {editingAccount ? 'Update Account' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

                           {/* Account View Modal */}
        {viewingAccount && (
          <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Account Details
                </h3>
                <button
                  onClick={closeView}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Account Information */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Account Name
                      </label>
                      <p className="text-lg font-semibold text-gray-900">{viewingAccount.name}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Account Type
                      </label>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                        viewingAccount.type === 'CASH' ? 'bg-red-100 text-red-800' :
                        viewingAccount.type === 'PARTY_ACCOUNT' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {viewingAccount.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Account Balance
                      </label>
                      <p className={`text-lg font-bold ${
                        viewingAccount.type === 'PARTY_ACCOUNT' ? 'text-red-600' :
                        viewingAccount.type === 'CUSTOMER_ACCOUNT' ? 'text-green-600' :
                        'text-gray-900'
                      }`}>
                        PKR {viewingAccount.balance ? parseFloat(viewingAccount.balance).toFixed(2) : '0.00'}
                        {viewingAccount.type === 'PARTY_ACCOUNT' && (
                          <span className="text-xs text-red-500 ml-2">(We owe)</span>
                        )}
                        {viewingAccount.type === 'CUSTOMER_ACCOUNT' && (
                          <span className="text-xs text-green-500 ml-2">(They owe us)</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Created Date
                      </label>
                      <p className="text-sm text-gray-900">{new Date(viewingAccount.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-4">
                    {viewingAccount.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Phone Number
                        </label>
                        <p className="text-sm text-gray-900">{viewingAccount.phone}</p>
                      </div>
                    )}

                    {viewingAccount.address && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Address
                        </label>
                        <p className="text-sm text-gray-900">{viewingAccount.address}</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Last Updated
                      </label>
                      <p className="text-sm text-gray-900">{new Date(viewingAccount.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Transaction Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{viewingAccount._count?.ledgers || 0}</div>
                    <div className="text-sm text-blue-600">Ledger Entries</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{viewingAccount._count?.sales || 0}</div>
                    <div className="text-sm text-green-600">Sales</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{viewingAccount._count?.purchases || 0}</div>
                    <div className="text-sm text-purple-600">Purchases</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {(viewingAccount.ledgers?.length > 0 || viewingAccount.sales?.length > 0 || viewingAccount.purchases?.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                  
                  {/* Recent Ledger Entries */}
                  {viewingAccount.ledgers?.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-md font-medium text-gray-700 mb-2">Recent Ledger Entries</h5>
                      <div className="space-y-2">
                        {viewingAccount.ledgers.slice(0, 3).map((ledger) => (
                          <div key={ledger.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                            <span className="text-gray-600">{ledger.details || 'Ledger Entry'}</span>
                            <span className={`font-medium ${
                              ledger.drAmount > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {ledger.drAmount > 0 ? `-PKR ${ledger.drAmount}` : `+PKR ${ledger.crAmount}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Sales */}
                  {viewingAccount.sales?.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-md font-medium text-gray-700 mb-2">Recent Sales</h5>
                      <div className="space-y-2">
                        {viewingAccount.sales.slice(0, 3).map((sale) => (
                          <div key={sale.id} className="flex justify-between items-center text-sm p-2 bg-green-50 rounded">
                            <span className="text-gray-600">
                              {new Date(sale.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} - {sale.weight}kg @ PKR {sale.rate}
                            </span>
                            <span className="font-medium text-green-600">PKR {sale.totalAmount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Purchases */}
                  {viewingAccount.purchases?.length > 0 && (
                    <div>
                      <h5 className="text-md font-medium text-gray-700 mb-2">Recent Purchases</h5>
                      <div className="space-y-2">
                        {viewingAccount.purchases.slice(0, 3).map((purchase) => (
                          <div key={purchase.id} className="flex justify-between items-center text-sm p-2 bg-purple-50 rounded">
                            <span className="text-gray-600">
                              {new Date(purchase.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} - {purchase.weight}kg @ PKR {purchase.weight}
                            </span>
                            <span className="font-medium text-purple-600">PKR {purchase.totalManagment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={closeView}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

                                                       {/* Ledger View Modal */}
         {viewingLedger && (
           <div className="fixed inset-0 backdrop-blur-md overflow-y-auto h-full w-full z-50">
           <div className="relative top-10 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
             <div className="mt-3">
               {/* Header */}
               <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-xl font-semibold text-gray-900">
                     Ledger - {viewingLedger.name}
                   </h3>
                   <p className="text-sm text-gray-500 mt-1">
                     Account Type: {viewingLedger.type.replace('_', ' ')}
                   </p>
                 </div>
                 <button
                   onClick={closeLedger}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>

               {/* Account Summary */}
               <div className="bg-gray-50 rounded-lg p-4 mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                   <div>
                     <div className="text-sm text-gray-500">Total Debit</div>
                     <div className="text-lg font-semibold text-red-600">
                                                PKR {viewingLedger.ledgers?.reduce((sum, entry) => sum + (entry.drAmount || 0), 0).toFixed(2) || '0.00'}
                     </div>
                   </div>
                   <div>
                     <div className="text-sm text-gray-500">Total Credit</div>
                     <div className="text-lg font-semibold text-green-600">
                                                PKR {viewingLedger.ledgers?.reduce((sum, entry) => sum + (entry.crAmount || 0), 0).toFixed(2) || '0.00'}
                     </div>
                   </div>
                   <div>
                     <div className="text-sm text-gray-500">Net Balance</div>
                     <div className={`text-lg font-semibold ${
                       (viewingLedger.ledgers?.reduce((sum, entry) => sum + (entry.crAmount || 0) - (entry.drAmount || 0), 0) || 0) >= 0 
                         ? 'text-green-600' 
                         : 'text-red-600'
                     }`}>
                                                PKR {Math.abs(viewingLedger.ledgers?.reduce((sum, entry) => sum + (entry.crAmount || 0) - (entry.drAmount || 0), 0) || 0).toFixed(2)}
                       {(viewingLedger.ledgers?.reduce((sum, entry) => sum + (entry.crAmount || 0) - (entry.drAmount || 0), 0) || 0) < 0 ? ' (Dr)' : ' (Cr)'}
                     </div>
                   </div>
                   <div>
                     <div className="text-sm text-gray-500">Total Entries</div>
                     <div className="text-lg font-semibold text-gray-900">
                       {viewingLedger.ledgers?.length || 0}
                     </div>
                   </div>
                 </div>
               </div>

               {/* Ledger Table */}
               <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                 <div className="px-6 py-4 border-b border-gray-200">
                   <h4 className="text-lg font-semibold text-gray-900">Ledger Entries</h4>
                 </div>

                 {(!viewingLedger.ledgers || viewingLedger.ledgers.length === 0) ? (
                   <div className="p-8 text-center">
                     <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                     <h3 className="mt-2 text-sm font-medium text-gray-900">No ledger entries</h3>
                     <p className="mt-1 text-sm text-gray-500">This account has no ledger entries yet.</p>
                   </div>
                 ) : (
                   <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-gray-200">
                       <thead className="bg-gray-50">
                         <tr>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Date & Time
                           </th>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Details
                           </th>
                           <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Debit (Dr)
                           </th>
                           <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Credit (Cr)
                           </th>
                           <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Balance
                           </th>
                         </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-200">
                         {(() => {
                           let balance = 0;
                           // Since API now returns newest first, we need to reverse to calculate running balance from oldest
                           const entriesOldestFirst = [...(viewingLedger.ledgers || [])].reverse();
                           
                           const entriesWithBalance = entriesOldestFirst.map(entry => {
                             if (entry.drAmount > 0) {
                               balance -= entry.drAmount;
                             } else {
                               balance += entry.crAmount;
                             }
                             return { ...entry, runningBalance: balance };
                           });
                           
                           // Reverse back to show newest first (which is what we want for display)
                           return entriesWithBalance.reverse();
                         })().map((entry, index) => (
                           <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                               <div>
                                 <div className="font-medium">{new Date(entry.createdAt).toLocaleDateString('en-US', {
                                   year: 'numeric',
                                   month: 'short',
                                   day: 'numeric'
                                 })}</div>
                                 <div className="text-gray-500">{new Date(entry.createdAt).toLocaleTimeString('en-US', {
                                   hour: '2-digit',
                                   minute: '2-digit'
                                 })}</div>
                               </div>
                             </td>
                             <td className="px-6 py-4 text-sm text-gray-900">
                               <div className="max-w-xs">
                                 {entry.details || 'Ledger Entry'}
                               </div>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                               {entry.drAmount > 0 ? (
                                 <span className="font-medium text-red-600">PKR {entry.drAmount.toFixed(2)}</span>
                               ) : (
                                 <span className="text-gray-400">-</span>
                               )}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                               {entry.crAmount > 0 ? (
                                 <span className="font-medium text-green-600">PKR {entry.crAmount.toFixed(2)}</span>
                               ) : (
                                 <span className="text-gray-400">-</span>
                               )}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                               <span className={`font-medium ${
                                 entry.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'
                               }`}>
                                 PKR {Math.abs(entry.runningBalance).toFixed(2)}
                                 {entry.runningBalance >= 0 ? ' (Cr)' : ' (Dr)'}
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
               </div>

               {/* Close Button */}
               <div className="flex justify-end pt-6">
                 <button
                   onClick={closeLedger}
                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                 >
                   Close
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
      </DashboardLayout>
    </>
  );
}
