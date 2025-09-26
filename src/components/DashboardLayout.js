'use client';

import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({
  children,
  user,
  onLogout,
  currentPage,
  title,
  headerChildren,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden">
      {/* Sidebar - Fixed on left for desktop */}
      <Sidebar user={user} onLogout={onLogout} currentPage={currentPage} />

      {/* Main Content Area - Positioned to the right of sidebar */}
      <div className="lg:ml-64 overflow-x-hidden">
        {/* Header */}
        <Header title={title} user={user}>
          {headerChildren}
        </Header>

        {/* Main Content */}
        <main className="py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
