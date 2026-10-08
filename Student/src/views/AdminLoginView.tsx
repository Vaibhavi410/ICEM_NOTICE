import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  BellRing
} from 'lucide-react';

import { API_BASE_URL } from '../services/studentApi';

interface AdminLoginViewProps {
  onBackToStudentPortal: () => void;
  onLoginSuccess?: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onBackToStudentPortal,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const getAdminPortalUrl = () => {
    if (typeof window === 'undefined') return '/admin';
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const targetPort = port === '5174' ? '5173' : (port === '5173' ? '5174' : '5173');
      return `${protocol}//${hostname}:${targetPort}/`;
    }
    return 'https://icemnoticeadmin.vercel.app/';
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (usernameError) setUsernameError('');
    if (authError) setAuthError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (authError) setAuthError('');
  };

  const fillDemoCredentials = () => {
    setUsername('admin');
    setPassword('Admin@123');
    setUsernameError('');
    setPasswordError('');
    setAuthError('');
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSuccess) return;

    // Reset previous errors
    setUsernameError('');
    setPasswordError('');
    setAuthError('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    let hasError = false;

    if (!trimmedUser) {
      setUsernameError('Username is required.');
      hasError = true;
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
    }

    if (!trimmedPass) {
      setPasswordError('Password is required.');
      if (!hasError && passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, usernameOrEmail: trimmedUser, password: trimmedPass }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid username or password');
      }

      setIsLoading(false);
      setIsSuccess(true);

      try {
        localStorage.setItem('icem_access_token', data.data.tokens.accessToken);
        localStorage.setItem('icem_refresh_token', data.data.tokens.refreshToken);
        localStorage.setItem('icem_admin_auth', 'true');
        localStorage.setItem('icem_admin_user', JSON.stringify(data.data.user));
        sessionStorage.setItem('icem_admin_authenticated', 'true');
      } catch {
        // ignore storage security exceptions
      }

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          const adminUrl = getAdminPortalUrl();
          window.location.href = adminUrl;
        }
      }, 700);
    } catch (err: any) {
      setIsLoading(false);
      setAuthError(err.message || 'Invalid username or password. Please try again.');
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
        passwordInputRef.current.select();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col justify-between selection:bg-[#003c84] selection:text-white relative overflow-x-hidden">
      {/* Background subtle institutional geometric grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#003c84_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.035] pointer-events-none" />

      {/* Top Header Navigation Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between border-b border-[#e2e6ec]/80 bg-white/80 backdrop-blur-md">
        <button
          onClick={onBackToStudentPortal}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#003c84] hover:text-[#00275a] transition-colors py-1 px-2.5 -ml-2 rounded hover:bg-[#003c84]/5 cursor-pointer group"
          title="Return to Student Portal"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Student Portal</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#00275a]/5 border border-[#00275a]/10 rounded-sm text-xs font-semibold text-[#00275a]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Administrative Gateway</span>
          </div>
        </div>
      </header>

      {/* Main Split Layout Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: ICEM Institutional Branding & Trust Panel */}
          <div className="lg:col-span-6 flex flex-col gap-6 text-left">
            {/* College Emblem & Titles */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-lg bg-white p-1 border border-[#e2e6ec] shadow-sm flex items-center justify-center shrink-0">
                <img
                  src="/indira-logo.png"
                  alt="Indira College Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[#00275a] text-xl sm:text-2xl tracking-tight leading-none">
                  ICEM Admin Portal
                </span>
                <span className="text-[11px] sm:text-xs text-[#5c6470] font-semibold tracking-wider uppercase mt-1">
                  INDIRA COLLEGE OF ENGINEERING & MANAGEMENT
                </span>
              </div>
            </div>

            {/* Supporting Pitch Line */}
            <div className="border-l-2 border-[#003c84] pl-3.5 py-0.5">
              <p className="text-sm sm:text-base text-[#1c1b1b] font-medium leading-relaxed">
                Manage notices, announcements, and portal content across all academic departments.
              </p>
              <p className="text-xs text-[#5c6470] mt-1">
                Affiliated to Savitribai Phule Pune University (SPPU) • Approved by AICTE
              </p>
            </div>

            {/* Institutional Feature Highlights (Clean & Institutional) */}
            <div className="hidden sm:flex flex-col gap-3.5 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/70 border border-[#e2e6ec]/90 shadow-2xs">
                <div className="w-7 h-7 rounded bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1c1b1b]">Role-Based Access Governance</h4>
                  <p className="text-[11px] text-[#5c6470] mt-0.5 leading-snug">
                    Restricted to verified faculty coordinators, TPO cell heads, and administrative officers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/70 border border-[#e2e6ec]/90 shadow-2xs">
                <div className="w-7 h-7 rounded bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1c1b1b]">Instant Broadcast Engine</h4>
                  <p className="text-[11px] text-[#5c6470] mt-0.5 leading-snug">
                    Dispatches examinations, placements, and cultural circulars directly to student feeds.
                  </p>
                </div>
              </div>
            </div>

            {/* Security Disclaimer */}
            <div className="flex items-center gap-2 text-[11px] text-[#737782] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#003c84]"></span>
              <span>All administrative sign-in attempts are encrypted and monitored.</span>
            </div>
          </div>

          {/* Right Column: Polished Admin Login Card */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md bg-white border border-[#e2e6ec] rounded-xl shadow-md p-6 sm:p-8 relative">
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#003c84] via-[#0052b4] to-[#00275a] rounded-t-xl" />

              {/* Login Card Header */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#003c84]/10 text-[#00275a] rounded-full text-[10px] font-bold tracking-wider uppercase mb-2">
                  <Lock className="w-3 h-3 text-[#003c84]" />
                  <span>Authorized Personnel</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1c1b1b] tracking-tight">
                  Admin Portal
                </h2>
                <p className="text-xs sm:text-sm text-[#5c6470] mt-1">
                  Sign in to continue to the administration portal.
                </p>
              </div>

              {/* Authentication Error Alert */}
              {authError && (
                <div
                  role="alert"
                  className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">{authError}</p>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {isSuccess && (
                <div
                  role="status"
                  className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="font-medium">Authentication successful! Redirecting to Admin Dashboard...</p>
                </div>
              )}

              {/* Clean Admin Login Form (ONLY Username, Password, Login) */}
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                {/* Username Input Field */}
                <div>
                  <label
                    htmlFor="admin-username"
                    className="block text-xs font-semibold text-[#1c1b1b] mb-1.5"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <input
                      id="admin-username"
                      ref={usernameInputRef}
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      disabled={isLoading || isSuccess}
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoFocus
                      aria-invalid={!!usernameError}
                      aria-describedby={usernameError ? 'username-error-msg' : undefined}
                      className={`w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border rounded-lg text-[#1c1b1b] placeholder:text-[#737782] focus:outline-none transition-all ${
                        usernameError
                          ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                          : 'border-[#e2e6ec] focus:border-[#003c84] focus:ring-2 focus:ring-[#003c84]/15'
                      }`}
                    />
                    <User className="w-4 h-4 text-[#737782] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {usernameError && (
                    <p id="username-error-msg" className="mt-1 text-[11px] text-red-600 font-medium">
                      {usernameError}
                    </p>
                  )}
                </div>

                {/* Password Input Field */}
                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-semibold text-[#1c1b1b] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={handlePasswordChange}
                      disabled={isLoading || isSuccess}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? 'password-error-msg' : undefined}
                      className={`w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border rounded-lg text-[#1c1b1b] placeholder:text-[#737782] focus:outline-none transition-all ${
                        passwordError
                          ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                          : 'border-[#e2e6ec] focus:border-[#003c84] focus:ring-2 focus:ring-[#003c84]/15'
                      }`}
                    />
                    <Lock className="w-4 h-4 text-[#737782] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    
                    {/* Show/Hide Password Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading || isSuccess}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#737782] hover:text-[#1c1b1b] rounded focus:outline-none focus:ring-1 focus:ring-[#003c84] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p id="password-error-msg" className="mt-1 text-[11px] text-red-600 font-medium">
                      {passwordError}
                    </p>
                  )}
                </div>

                {/* Primary Login Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className="w-full mt-2 py-2.5 px-4 bg-[#003c84] hover:bg-[#00275a] active:bg-[#001d45] active:scale-[0.99] text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs hover:shadow transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </form>

              {/* Quick Demo Helper for review */}
              <div className="mt-6 pt-4 border-t border-[#e2e6ec] flex items-center justify-between text-[11px] text-[#5c6470]">
                <span>
                  Demo: <strong className="text-[#00275a]">admin</strong> / <strong className="text-[#00275a]">Admin@123</strong>
                </span>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="text-[#003c84] hover:text-[#00275a] font-semibold hover:underline cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-3 bg-white border-t border-[#e2e6ec] text-center text-[11px] text-[#737782]">
        <span>© {new Date().getFullYear()} Indira College of Engineering & Management (ICEM). All rights reserved.</span>
      </footer>
    </div>
  );
};
