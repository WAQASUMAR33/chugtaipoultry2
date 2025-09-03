'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/DashboardLayout';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
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

  const fetchSales = useCallback(async () => {
    try {
      const response = await fetch('/api/sales');
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    try {
      const response = await fetch('/api/purchases');
      if (response.ok) {
        const data = await response.json();
        setPurchases(data);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  }, []);

  const createRecentActivity = useCallback(() => {
    const allTransactions = [];
    
    // Add sales
    sales.forEach(sale => {
      allTransactions.push({
        id: `sale-${sale.id}`,
        type: 'sale',
        date: new Date(sale.date),
        amount: sale.totalAmount,
        account: sale.account.name,
        description: `Sale to ${sale.account.name}`,
        icon: '📈',
        color: 'text-green-600',
        bgColor: 'bg-green-100'
      });
    });
    
    // Add purchases
    purchases.forEach(purchase => {
      allTransactions.push({
        id: `purchase-${purchase.id}`,
        type: 'purchase',
        date: new Date(purchase.date),
        amount: purchase.totalManagment,
        account: purchase.account.name,
        description: `Purchase from ${purchase.account.name}`,
        icon: '📦',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100'
      });
    });
    
    // Sort by date (most recent first) and take top 10
    const sorted = allTransactions.sort((a, b) => b.date - a.date).slice(0, 10);
    setRecentActivity(sorted);
  }, [sales, purchases]);

  useEffect(() => {
    if (user) {
      fetchSales();
      fetchPurchases();
    }
  }, [user, fetchSales, fetchPurchases]);

  useEffect(() => {
    if (sales.length > 0 || purchases.length > 0) {
      createRecentActivity();
    }
  }, [sales, purchases, createRecentActivity]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [router]);

  const handleMenuClick = useCallback((menu) => {
    // Handle different menu options
    switch (menu) {
      case 'sales':
        router.push('/dashboard/sales');
        break;
      case 'purchase':
        router.push('/dashboard/purchases');
        break;
      case 'accounts':
        router.push('/dashboard/accounts');
        break;
      case 'ledger':
        router.push('/dashboard/ledger');
        break;
      case 'users':
        router.push('/dashboard/users');
        break;
      case 'reports':
        // TODO: Navigate to reports page
        console.log('Reports clicked');
        break;
      default:
        break;
    }
  }, [router]);

  const handleRefreshData = useCallback(() => {
    fetchSales();
    fetchPurchases();
  }, [fetchSales, fetchPurchases]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate totals for better performance
  const totalSales = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalManagment || 0), 0);
  const netRevenue = totalSales - totalPurchases;

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout 
      user={user} 
      onLogout={handleLogout} 
      currentPage="dashboard"
      title="Dashboard"
    >
             {/* Welcome Section */}
       <div className="mb-10">
         <div className="flex justify-between items-start">
           <div>
                         <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome back, {user.fullName}!</h2>
            <p className="text-gray-600 text-lg">Here&apos;s what&apos;s happening with your POS system today.</p>
           </div>
           <button
             onClick={handleRefreshData}
             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center"
           >
             <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
             </svg>
             Refresh Data
           </button>
         </div>
       </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
           <div className="flex items-center">
             <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
               <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
               </svg>
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Total Sales</p>
               <p className="text-2xl font-bold text-gray-900">PKR {totalSales.toFixed(2)}</p>
             </div>
           </div>
         </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
           <div className="flex items-center">
             <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
               <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
               </svg>
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Total Purchases</p>
               <p className="text-2xl font-bold text-gray-900">PKR {totalPurchases.toFixed(2)}</p>
             </div>
           </div>
         </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
           <div className="flex items-center">
             <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
               <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
               </svg>
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Total Transactions</p>
               <p className="text-2xl font-bold text-gray-900">{sales.length + purchases.length}</p>
             </div>
           </div>
         </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
           <div className="flex items-center">
             <div className="h-12 w-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
               <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
               </svg>
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Net Revenue</p>
               <p className="text-2xl font-bold text-gray-900">
                 PKR {netRevenue.toFixed(2)}
               </p>
             </div>
           </div>
         </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-10">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sales */}
          <div 
            onClick={() => handleMenuClick('sales')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-green-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-green-200 transition duration-200">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition duration-200">Sales</h3>
                <p className="text-gray-600 text-sm">Process new sales transactions</p>
              </div>
            </div>
          </div>

          {/* Purchase */}
          <div 
            onClick={() => handleMenuClick('purchase')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-blue-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-blue-200 transition duration-200">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition duration-200">Purchase</h3>
                <p className="text-gray-600 text-sm">Manage inventory purchases</p>
              </div>
            </div>
          </div>

          {/* Account Management */}
          <div 
            onClick={() => handleMenuClick('accounts')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-purple-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-purple-200 transition duration-200">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-700 transition duration-200">Account Management</h3>
                <p className="text-gray-600 text-sm">Manage customer accounts</p>
              </div>
            </div>
          </div>

          {/* Ledger */}
          <div 
            onClick={() => handleMenuClick('ledger')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-indigo-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-indigo-200 transition duration-200">
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition duration-200">Ledger</h3>
                <p className="text-gray-600 text-sm">View financial records</p>
              </div>
            </div>
          </div>

          {/* User Management */}
          <div 
            onClick={() => handleMenuClick('users')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-yellow-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-yellow-200 transition duration-200">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-yellow-700 transition duration-200">User Management</h3>
                <p className="text-gray-600 text-sm">Manage system users</p>
              </div>
            </div>
          </div>

          {/* Reports */}
          <div 
            onClick={() => handleMenuClick('reports')}
            className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-red-300 group transform hover:-translate-y-1"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-red-200 transition duration-200">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-700 transition duration-200">Reports</h3>
                <p className="text-gray-600 text-sm">Generate system reports</p>
              </div>
            </div>
          </div>
        </div>
      </div>

             {/* Recent Activity */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h3>
         {recentActivity.length === 0 ? (
           <div className="text-center py-8">
             <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
             </svg>
             <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
             <p className="mt-1 text-sm text-gray-500">Start using the system to see your activity here.</p>
           </div>
         ) : (
           <div className="space-y-4">
             {recentActivity.map((activity) => (
               <div key={activity.id} className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                 <div className={`h-10 w-10 ${activity.bgColor} rounded-full flex items-center justify-center mr-4`}>
                   <span className="text-lg">{activity.icon}</span>
                 </div>
                 <div className="flex-1">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                       <p className="text-xs text-gray-500">
                         {activity.date.toLocaleDateString('en-US', {
                           year: 'numeric',
                           month: 'short',
                           day: 'numeric',
                           hour: '2-digit',
                           minute: '2-digit'
                         })}
                       </p>
                     </div>
                     <div className={`text-right ${activity.color}`}>
                       <p className="text-sm font-semibold">PKR {activity.amount.toFixed(2)}</p>
                       <p className="text-xs capitalize">{activity.type}</p>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>
    </DashboardLayout>
  );
}
