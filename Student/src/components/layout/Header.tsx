import React from 'react';
import { Search, Menu, X, ShieldCheck, ChevronRight } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  onNavigateNotice?: (id: string) => void;
  onNavigateAdminLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  onNavigateAdminLogin,
}) => {
  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateAdminLogin) {
      onNavigateAdminLogin();
    } else {
      window.location.href = 'https://icemnoticeadmin.vercel.app/';
    }
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-14 bg-[#f5f9fd]/95 backdrop-blur-sm z-30 px-3 sm:px-4 flex items-center justify-between border-b border-[#d7e4ef] shadow-xs">
      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-xl min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 text-[#5c6470] hover:text-[#00275a] hover:bg-[#f5f7fa] rounded transition-colors shrink-0 cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative flex-1 min-w-0">
          <div className="relative flex items-center w-full bg-white rounded-sm px-2.5 py-1.5 border border-[#d7e4ef] focus-within:border-[#003c84] focus-within:bg-white transition-all shadow-2xs">
            <Search className="w-4 h-4 text-[#737782] shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearchSubmit) {
                  onSearchSubmit();
                }
              }}
              placeholder="Search notices, events, departments..."
              className="bg-transparent border-none outline-none w-full px-2 text-xs sm:text-sm text-[#1c1b1b] placeholder:text-[#5c6470] placeholder:truncate"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="text-[#737782] hover:text-[#1c1b1b] shrink-0 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block text-[10px] text-[#5c6470] bg-white border border-[#e2e6ec] px-1.5 py-0.5 rounded font-mono shadow-2xs ml-1 shrink-0">
              Ctrl+K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Institutional Label & Admin Portal Button */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Institutional Portal Label */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-sm text-xs font-semibold text-[#245b4a]">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>ICEM Notice Portal</span>
        </div>

        {/* Polished Admin Portal Entry Button */}
        <a
          href="https://icemnoticeadmin.vercel.app/"
          onClick={handleAdminClick}
          className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-gradient-to-b from-[#003c84] to-[#00275a] hover:from-[#002e6b] hover:to-[#001d45] active:scale-[0.98] text-white text-xs font-semibold rounded-sm shadow-xs hover:shadow-sm border border-[#00275a]/40 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#003c84]/30 select-none"
          title="Sign in to Admin Portal"
        >
          <div className="w-4 h-4 rounded-xs bg-white/10 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-white/20 transition-colors">
            <ShieldCheck className="w-3 h-3 text-blue-100 group-hover:text-white transition-colors" />
          </div>
          <span className="tracking-tight text-white font-medium text-xs hidden xs:inline sm:inline">Admin Portal</span>
          <span className="tracking-tight text-white font-medium text-[11px] xs:hidden sm:hidden">Admin</span>
          <ChevronRight className="w-3.5 h-3.5 text-blue-200/80 group-hover:text-white group-hover:translate-x-0.5 transition-all hidden sm:inline shrink-0 -ml-0.5" />
        </a>
      </div>
    </header>
  );
};
