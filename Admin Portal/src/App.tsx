import React, { useState, useEffect, useCallback } from 'react';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminHeader } from './components/AdminHeader';
import { AdminNoticeWorkbench } from './views/AdminNoticeWorkbench';
import { AdminBannerManager } from './views/AdminBannerManager';
import { AdminLoginView } from './views/AdminLoginView';
import { AdminUserManager } from './views/AdminUserManager';

import { AdminApiService } from './services/adminApi';
import type { AdminUser } from './services/adminApi';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return AdminApiService.isAuthenticated();
  });
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() =>
    AdminApiService.isAuthenticated() ? AdminApiService.getStoredUser() : null
  );
  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(() => AdminApiService.isAuthenticated());

  useEffect(() => {
    const accessToken = AdminApiService.getAccessToken();
    if (accessToken) {
      AdminApiService.getMe()
        .then((user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        })
        .catch(() => {
          if (AdminApiService.getAccessToken() === accessToken) {
            AdminApiService.clearAuth();
            setCurrentUser(null);
            setIsAuthenticated(false);
          } else {
            setCurrentUser(AdminApiService.getStoredUser());
            setIsAuthenticated(AdminApiService.isAuthenticated());
          }
        })
        .finally(() => {
          setIsCheckingUser(false);
        });
    } else {
      setIsCheckingUser(false);
    }
  }, []);

  const handleLogout = async () => {
    await AdminApiService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);

  const getStudentPortalUrl = () => {
    if (typeof window === 'undefined') return '/';
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const targetPort = port === '5173' ? '5174' : (port === '5174' ? '5173' : '5173');
      return `${protocol}//${hostname}:${targetPort}/`;
    }
    return 'https://icem-notice-7ppq.vercel.app/';
  };

  // Hash-based routing
  const parseRoute = useCallback(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!rawHash || rawHash === 'dashboard' || rawHash === 'manage-notices' || rawHash === 'admin') {
      return { tab: 'dashboard', category: 'all' };
    }
    if (rawHash === 'create-notice') {
      return { tab: 'create-notice', category: 'all' };
    }
    if (rawHash === 'dashboard-banner' || rawHash === 'banners' || rawHash === 'banner-manager') {
      return { tab: 'dashboard-banner', category: 'all' };
    }
    if (rawHash === 'account-requests') {
      return { tab: 'account-requests', category: 'all' };
    }
    if (rawHash.startsWith('category/')) {
      const cat = decodeURIComponent(rawHash.replace('category/', ''));
      return { tab: 'dashboard', category: cat };
    }
    return { tab: 'dashboard', category: 'all' };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseRoute();
      setCurrentTab(route.tab);
      setSelectedCategory(route.category);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [parseRoute]);

  const handleNavigateTab = (tab: string, category: string = 'all') => {
    setCurrentTab(tab);
    setSelectedCategory(category);
    if (tab === 'create-notice') {
      window.location.hash = '#/create-notice';
    } else if (tab === 'dashboard-banner') {
      window.location.hash = '#/dashboard-banner';
    } else if (tab === 'account-requests') {
      window.location.hash = '#/account-requests';
    } else if (category && category !== 'all') {
      window.location.hash = `#/category/${encodeURIComponent(category)}`;
    } else {
      window.location.hash = '#/dashboard';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatsChange = (total: number, published: number) => {
    setTotalCount(total);
    setPublishedCount(published);
  };

  const canManageAdminFeatures =
    !isCheckingUser &&
    (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN');

  if (!isAuthenticated) {
    return (
      <AdminLoginView
        onBackToStudentPortal={() => {
          window.location.href = getStudentPortalUrl();
        }}
        onLoginSuccess={() => {
          setCurrentUser(AdminApiService.getStoredUser());
          setIsCheckingUser(false);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1c1b1b] flex flex-col selection:bg-[#003c84] selection:text-white overflow-x-clip font-sans">
      {/* Sidebar Navigation */}
      <AdminSidebar
        currentTab={currentTab}
        selectedCategory={selectedCategory}
        isSuperAdmin={!isCheckingUser && currentUser?.role === 'SUPERADMIN'}
        currentUser={currentUser}
        isUserLoading={isCheckingUser}
        onNavigateTab={handleNavigateTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSwitchToStudentPortal={() => {
          window.location.href = getStudentPortalUrl();
        }}
        onLogout={handleLogout}
      />

      {/* Top Header */}
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        totalNoticesCount={totalCount}
        publishedNoticesCount={publishedCount}
        showCreateNotice={canManageAdminFeatures}
        onCreateNotice={() => handleNavigateTab('create-notice')}
      />

      {/* Main Administrative Content Area */}
      <main className="relative min-h-screen bg-[#f5f7fa] lg:ml-64 flex flex-col flex-1 px-3 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
        {currentTab === 'account-requests' ? (
          isCheckingUser ? (
            <div className="p-6 text-sm text-[#5c6470]">Checking account permissions...</div>
          ) : currentUser?.role === 'SUPERADMIN' ? (
            <AdminUserManager />
          ) : (
            <div role="alert" className="p-6 text-sm font-medium text-red-700">
              You do not have permission to access account management.
            </div>
          )
        ) : currentTab === 'dashboard-banner' && canManageAdminFeatures ? (
          <AdminBannerManager onNavigateTab={handleNavigateTab} />
        ) : (
          <AdminNoticeWorkbench
            initialSearch={searchTerm}
            currentTab={currentTab}
            selectedCategory={selectedCategory}
            canManageNotices={canManageAdminFeatures}
            onNavigateTab={handleNavigateTab}
            onStatsChange={handleStatsChange}
          />
        )}
      </main>
    </div>
  );
};

export default App;
