'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';

export default function ReceivingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receivings, setReceivings] = useState([]);
  const [customerAccounts, setCustomerAccounts] = useState([]);
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
    accountId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
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

  const fetchCustomerAccounts = async () => {
    try {
      const response = await fetch('/api/accounts?type=CUSTOMER_ACCOUNT');
      if (response.ok) {
        const data = await response.json();
        setCustomerAccounts(data);
      }
    } catch (error) {
      console.error('Error fetching customer accounts:', error);
    }
  };

  const fetchReceivings = async () => {
    try {
      setIsLoading(true);
      let url = `/api/receivings?page=${currentPage}&limit=50`;
      
      if (selectedAccount !== 'ALL') {
        url += `&accountId=${selectedAccount}`;
      }
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReceivings(data.receivings || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error('Error fetching receivings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCustomerAccounts();
      fetchReceivings();
    }
  }, [user, currentPage, selectedAccount, startDate, endDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.accountId || !formData.amount || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/receivings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Payment received recorded successfully!');
        setFormData({
          accountId: '',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        setShowForm(false);
        fetchReceivings();
        fetchCustomerAccounts(); // Refresh account balances
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating receiving:', error);
      alert('Failed to record payment received');
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedAccount('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PK');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Customer Receivings</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Record Payment Received'}
          </button>
        </div>

        {/* Receiving Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Record Payment Received from Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Account *
                  </label>
                  <select
                    name="accountId"
                    value={formData.accountId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select Customer Account</option>
                    {customerAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} (Balance: {formatCurrency(account.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Received *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter amount"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter payment description"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Recording...' : 'Record Payment Received'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All Customers</option>
                {customerAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Receivings List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Payment Received Records</h2>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading receivings...</div>
              </div>
            ) : receivings.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-lg text-gray-500">No payments received found</div>
              </div>
            ) : (
              <>
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
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {receivings.map((receiving) => (
                        <tr key={receiving.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(receiving.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {receiving.account?.name || 'Unknown Account'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {formatCurrency(receiving.amount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {receiving.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-6 flex justify-between items-center">
                    <div className="text-sm text-gray-700">
                      Showing {((pagination.currentPage - 1) * 50) + 1} to {Math.min(pagination.currentPage * 50, pagination.totalCount)} of {pagination.totalCount} receivings
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!pagination.hasPrevPage}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm">
                        Page {pagination.currentPage} of {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={!pagination.hasNextPage}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
