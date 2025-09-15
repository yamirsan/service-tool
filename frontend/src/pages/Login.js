import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    const redirectTo = isAdmin ? '/' : (location.state?.from?.pathname || '/');
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setLoading(true);
    const result = await login(username, password);
    
    if (result.success) {
      toast.success('Login successful!');
      const from = location.state?.from?.pathname;
      if (String(result.user?.role || '').toLowerCase() === 'admin') {
        navigate('/', { replace: true });
      } else {
        navigate(from || '/', { replace: true });
      }
    } else {
      toast.error(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-slate-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors" />
      <div className="pointer-events-none select-none opacity-40 absolute inset-0 [background-image:radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.30),transparent_55%)]" />
      <div className="relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Gradient border wrapper */}
            <div className="p-[2px] rounded-2xl bg-gradient-to-br from-indigo-400/60 via-fuchsia-400/50 to-pink-400/60 shadow-xl shadow-indigo-200/40">
            <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-[inherit] p-8 transition-colors">
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-300/40 mb-6 ring-2 ring-white/40">
                  <LogIn className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Welcome Back
                </h2>
                <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">Sign in to continue</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-5">
                  <div className="group">
                    <label htmlFor="username" className="block text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400 mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <input
                        id="username"
                        name="username"
                        type="text"
                        required
                        autoComplete="username"
                        className="peer w-full px-4 py-3 rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all text-gray-900 dark:text-gray-100"
                        placeholder="your.username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <div className="absolute inset-0 rounded-xl pointer-events-none peer-focus:ring-0" />
                    </div>
                  </div>
                  <div className="group">
                    <label htmlFor="password" className="block text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        className="peer w-full px-4 py-3 pr-12 rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all text-gray-900 dark:text-gray-100"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full relative overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all shadow-lg shadow-indigo-300/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500 transition-colors" />
                  <span className="relative flex items-center justify-center py-3 px-4 text-sm font-semibold tracking-wide text-white">
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/70 border-t-transparent mr-3" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign In
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="mt-10">
                <div className="relative pt-5">
                  {/* Gradient separator line for better visibility */}
                  <span className="pointer-events-none select-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent dark:via-indigo-500/60" />
                  <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="font-medium tracking-wide">Service Tool</span>
                    <sup className="ml-1 text-[10px] align-super">™</sup>
                    <span className="mx-2 text-gray-400">•</span>
                    by Mohammed Shakir
                    <span className="mx-2 text-gray-400">•</span>
                    © {new Date().getFullYear()} All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
