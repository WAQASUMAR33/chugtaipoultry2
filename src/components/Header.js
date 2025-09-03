'use client';

export default function Header({ title, user, children }) {
  return (
    <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="flex items-center space-x-4">
          {children}
          {user && (
            <div className="hidden sm:flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                <p className="text-xs text-gray-500">{user.role || 'User'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
