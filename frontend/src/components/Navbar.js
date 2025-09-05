import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Package, 
  Calculator, 
  Upload, 
  Settings, 
  LogOut,
  User,
  Smartphone,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';

const Navbar = ({ dark, setDark }) => {
  const { logout, user, hasPermission, isAdmin } = useAuth();
  const location = useLocation();

  // Build navigation with permission metadata
  const navigationAll = [
    { name: 'Dashboard', href: '/', icon: Home, adminOnly: true },
    { name: 'Parts', href: '/parts', icon: Package },
    { name: 'Calculator', href: '/calculator', icon: Calculator },
    { name: 'Formulas', href: '/formulas', icon: Settings, perm: 'manage_formulas' },
    { name: 'Upload', href: '/upload', icon: Upload, perm: 'upload_excel' },
    { name: 'Samsung Models', href: '/samsung-models', icon: Smartphone, perm: 'manage_samsung_models' },
    // Admin/authorized users page
    { name: 'Users', href: '/admin/users', icon: User, perm: 'manage_users' }
  ];

  const allowedNavigation = navigationAll.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.perm) return isAdmin || hasPermission(item.perm);
    return true;
  });

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white/90 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/60 shadow-lg border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-primary-600 via-pink-500 to-violet-600 bg-clip-text text-transparent flex items-center">
                Service Tool
                <Sparkles className="w-5 h-5 ml-2 text-primary-600" />
              </h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {allowedNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`$${''}{
                      isActive(item.href)
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                aria-label="Toggle dark mode"
                onClick={() => setDark(!dark)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <User className="w-4 h-4 mr-2" />
                <span>{user?.username || 'User'}</span>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center space-x-2">
            <button
              type="button"
              aria-label="Toggle dark mode"
              onClick={() => setDark(!dark)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              {dark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {allowedNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`$${''}{
                  isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200`}
              >
                <div className="flex items-center">
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
