import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  FileCheck,
  Briefcase,
  Megaphone,
  Sparkles,
  Building2,
  ChevronRight,
  X,
  Mail,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StudentApiService } from '../../services/studentApi';
import {
  createDepartmentTargetAudience,
  DEPARTMENT_ACADEMIC_TARGETS,
  FINAL_YEAR_PROGRAMS,
  parseDepartmentTargetAudience,
  TARGET_AUDIENCES,
} from '../../../../shared/targetAudiences';

interface SidebarProps {
  currentView: string;
  selectedCategory?: string;
  selectedTargetAudience?: string;
  onSelectCategory: (category: string) => void;
  onSelectTargetAudience: (targetAudience: string) => void;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  categoryCounts?: {
    all: number;
    exam: number;
    placement: number;
    general: number;
    events?: number;
  };
  totalNoticesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  selectedCategory = 'all',
  selectedTargetAudience = '',
  onSelectCategory,
  onSelectTargetAudience,
  onNavigate,
  isOpen,
  onClose,
  categoryCounts,
  totalNoticesCount = 13,
}) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionEmailStatus, setSubscriptionEmailStatus] = useState<
    'sent' | 'failed' | 'not_sent_already_active' | null
  >(null);
  const subscriptionInFlightRef = useRef(false);
  const [isDepartmentMenuOpen, setIsDepartmentMenuOpen] = useState(false);
  const [expandedAcademicTarget, setExpandedAcademicTarget] = useState<string | null>(null);
  const [departmentMenuPosition, setDepartmentMenuPosition] = useState({ top: 0, left: 0 });
  const departmentButtonRef = useRef<HTMLButtonElement>(null);
  const departmentMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDepartmentMenuTimeout = () => {
    if (departmentMenuTimeoutRef.current) {
      clearTimeout(departmentMenuTimeoutRef.current);
      departmentMenuTimeoutRef.current = null;
    }
  };

  const openDepartmentMenu = () => {
    clearDepartmentMenuTimeout();
    const buttonRect = departmentButtonRef.current?.getBoundingClientRect();
    if (buttonRect) {
      setDepartmentMenuPosition({
        top: Math.max(
          8,
          Math.min(buttonRect.top, window.innerHeight - 150)
        ),
        left: buttonRect.right,
      });
    }
    setIsDepartmentMenuOpen(true);
  };

  const scheduleDepartmentMenuClose = () => {
    clearDepartmentMenuTimeout();
    departmentMenuTimeoutRef.current = setTimeout(() => {
      setIsDepartmentMenuOpen(false);
      setExpandedAcademicTarget(null);
    }, 150);
  };

  const handleDepartmentClick = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      return;
    }
    setIsDepartmentMenuOpen((open) => !open);
  };

  const handleTargetAudienceClick = (targetAudience: string) => {
    onSelectTargetAudience(targetAudience);
    setIsDepartmentMenuOpen(false);
    setExpandedAcademicTarget(null);
    onClose();
  };

  const selectedDepartmentTarget = parseDepartmentTargetAudience(selectedTargetAudience);
  const isDepartmentAudienceSelected =
    Boolean(selectedDepartmentTarget) ||
    DEPARTMENT_ACADEMIC_TARGETS.some((target) => target === selectedTargetAudience);
  const additionalTargetAudiences = TARGET_AUDIENCES.filter(
    (audience) => !DEPARTMENT_ACADEMIC_TARGETS.some((academicTarget) => academicTarget === audience)
  );

  const handleBrandClick = () => {
    onNavigate('dashboard');
    onClose();
  };

  const handleCategoryClick = (catId: string) => {
    onSelectCategory(catId);
    onClose();
  };

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Email address is required.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid email address.';
    }
    return '';
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionInFlightRef.current) return;

    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError('');
    setSubscriptionError('');
    subscriptionInFlightRef.current = true;
    setIsSubscribing(true);

    try {
      const result = await StudentApiService.subscribeNewsletter({ email: email.trim() });
      if (!result.subscriptionSaved) {
        throw new Error('The subscription was not saved.');
      }

      setIsSubscribed(true);
      setSubscriptionEmailStatus(result.emailStatus);
    } catch (err) {
      console.warn('Backend newsletter subscription error:', err);
      setSubscriptionError('We could not complete your subscription. Please try again.');
    } finally {
      subscriptionInFlightRef.current = false;
      setIsSubscribing(false);
    }
  };

  const isNoticesView = currentView === 'dashboard' || currentView === 'notices' || currentView === 'notice-detail' || currentView === 'events';

  const navCategories = [
    {
      id: 'all',
      label: 'All Notices',
      icon: BellRing,
      count: categoryCounts?.all ?? totalNoticesCount,
    },
    {
      id: 'exam',
      label: 'Exam Notices',
      icon: FileCheck,
      count: categoryCounts?.exam ?? 0,
    },
    {
      id: 'placement',
      label: 'Placement Notices',
      icon: Briefcase,
      count: categoryCounts?.placement ?? 0,
    },
    {
      id: 'general',
      label: 'General Notices',
      icon: Megaphone,
      count: categoryCounts?.general ?? 0,
    },
    {
      id: 'events',
      label: 'Events & Cultures',
      icon: Sparkles,
      count: categoryCounts?.events ?? 8,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 max-w-[85vw] bg-[#EAF4FC] z-50 flex flex-col border-r border-[#D5E5F2] shadow-sm transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 gap-3 border-b border-[#D5E5F2] shrink-0">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={handleBrandClick}
          >
            <div className="w-8 h-8 rounded-sm bg-white p-0.5 border border-[#e2e6ec] flex items-center justify-center shrink-0 shadow-2xs">
              <img
                src="/indira-logo.png"
                alt="Indira Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-[#00275A] text-lg tracking-tight leading-none block">ICEM Portal</span>
              <span className="text-[10px] text-[#5C6470] font-semibold tracking-wider uppercase">INDIRA COLLEGE</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-[#5C6470] hover:text-[#1C1B1B] rounded"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation & Content Section */}
        <div className="flex-1 flex flex-col justify-between px-3 py-4 overflow-y-auto">
          {/* Notice Categories Navigation Stack */}
          <div className="flex flex-col gap-1.5">
            <div className="px-3.5 pb-1 pt-0.5">
              <span className="text-[10px] font-bold text-[#737782] uppercase tracking-wider">
                Categories
              </span>
            </div>

            {navCategories.map((item) => {
              const IconComponent = item.icon;
              const isActive = isNoticesView && selectedCategory === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleCategoryClick(item.id)}
                  className={`group w-full flex items-center px-3.5 py-3 text-sm font-semibold transition-all rounded-sm text-left cursor-pointer ${isActive
                      ? 'bg-[#D4E3F2] text-[#17365D] border-l-4 border-[#003C84] shadow-2xs'
                      : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D] border-l-4 border-transparent'
                    }`}
                >
                  <IconComponent
                    className={`w-5 h-5 mr-3 shrink-0 ${isActive ? 'text-[#003C84]' : 'text-[#737782] group-hover:text-[#003C84]'}`}
                  />
                  <span className="flex-1 truncate text-sm">{item.label}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${isActive
                        ? 'bg-[#B8CCE3] text-[#17365D]'
                        : 'bg-[#E2E6EC] text-[#5C6470]'
                      }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}

            <div
              className="relative"
              onMouseEnter={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) openDepartmentMenu();
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) scheduleDepartmentMenuClose();
              }}
            >
              <button
                ref={departmentButtonRef}
                type="button"
                aria-expanded={isDepartmentMenuOpen}
                onClick={handleDepartmentClick}
                onFocus={() => {
                  if (window.matchMedia('(min-width: 1024px)').matches) openDepartmentMenu();
                }}
                onBlur={() => {
                  if (
                    window.matchMedia('(min-width: 1024px)').matches &&
                    !departmentButtonRef.current?.parentElement?.contains(document.activeElement)
                  ) {
                    scheduleDepartmentMenuClose();
                  }
                }}
                className={`group w-full flex items-center px-3.5 py-3 text-sm font-semibold transition-all rounded-sm text-left cursor-pointer ${
                  isDepartmentAudienceSelected
                    ? 'bg-[#D4E3F2] text-[#17365D] border-l-4 border-[#003C84] shadow-2xs'
                    : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D] border-l-4 border-transparent'
                }`}
              >
                <Building2
                  className={`w-5 h-5 mr-3 shrink-0 ${
                    isDepartmentAudienceSelected ? 'text-[#003C84]' : 'text-[#737782]'
                  }`}
                />
                <span className="flex-1 truncate text-sm">Department</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>

              {!window.matchMedia('(min-width: 1024px)').matches && isDepartmentMenuOpen && (
                <div className="ml-8 mt-1 flex flex-col border-l border-[#D5E5F2] pl-2">
                  {DEPARTMENT_ACADEMIC_TARGETS.map((target) => (
                    <div key={target}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleTargetAudienceClick(createDepartmentTargetAudience(target))}
                          className={`flex-1 px-3 py-2 text-left text-xs font-medium rounded-sm transition-colors ${
                            (selectedDepartmentTarget?.academicTarget === target && !selectedDepartmentTarget.program) ||
                            selectedTargetAudience === target
                              ? 'bg-[#D4E3F2] text-[#17365D]'
                              : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D]'
                          }`}
                        >
                          {target}
                        </button>
                        <button
                          type="button"
                          aria-label={`Show ${target} branches`}
                          aria-expanded={expandedAcademicTarget === target}
                          onClick={() => {
                            setExpandedAcademicTarget((expanded) =>
                              expanded === target ? null : target
                            );
                          }}
                          className="px-2 py-2 text-[#737782] hover:bg-[#DCE9F8] hover:text-[#17365D] rounded-sm"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {expandedAcademicTarget === target && (
                        <div className="ml-3 flex flex-col border-l border-[#D5E5F2] pl-2">
                          {FINAL_YEAR_PROGRAMS.map((program) => {
                            const targetAudience = createDepartmentTargetAudience(target, program);
                            return (
                              <button
                                key={program}
                                type="button"
                                onClick={() => handleTargetAudienceClick(targetAudience)}
                                className={`w-full px-3 py-2 text-left text-xs font-medium rounded-sm transition-colors ${
                                  selectedTargetAudience === targetAudience
                                    ? 'bg-[#D4E3F2] text-[#17365D]'
                                    : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D]'
                                }`}
                              >
                                {program}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {additionalTargetAudiences.map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => handleTargetAudienceClick(audience)}
                      className={`w-full px-3 py-2 text-left text-xs font-medium rounded-sm transition-colors ${
                        selectedTargetAudience === audience
                          ? 'bg-[#D4E3F2] text-[#17365D]'
                          : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D]'
                      }`}
                    >
                      {audience}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Email Subscription Card (Compact & Secondary) */}
          <div className="mt-auto pt-4">
            <div className="p-3.5 bg-[#E8F0FA]/80 backdrop-blur-md border border-white/70 rounded-[13px] shadow-[0_4px_12px_rgba(23,54,93,0.12)] ring-1 ring-[#B8CCE3]/60">
              <div className="flex items-center gap-1.5 text-[#17365D] mb-1">
                <Mail className="w-4 h-4 text-[#315B8A] shrink-0" />
                <h4 className="text-xs font-bold text-[#17365D] leading-tight">
                  Never miss an important notice
                </h4>
              </div>

              <p className="text-[11px] text-[#5B6F86] leading-snug mb-3">
                Get the latest college announcements directly in your inbox.
              </p>

              {isSubscribed ? (
                <div className={`border rounded-sm p-2.5 text-xs flex items-start gap-2 animate-in fade-in ${
                  subscriptionEmailStatus === 'failed'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${
                    subscriptionEmailStatus === 'failed' ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                  <p className={`text-[11px] leading-snug font-medium ${
                    subscriptionEmailStatus === 'failed' ? 'text-amber-800' : 'text-emerald-800'
                  }`}>
                    {subscriptionEmailStatus === 'sent'
                      ? "You're subscribed! A confirmation email has been sent."
                      : subscriptionEmailStatus === 'not_sent_already_active'
                        ? 'This email is already subscribed. No duplicate confirmation was sent.'
                        : "You're subscribed, but we couldn't send the confirmation email. Please try again later."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={email}
                    disabled={isSubscribing}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                      if (subscriptionError) setSubscriptionError('');
                    }}
                    placeholder="Enter your email address"
                    className={`w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border rounded-md text-[#17365D] placeholder:text-[#5B6F86] focus:border-[#315B8A] focus:ring-2 focus:ring-[#315B8A]/20 focus:outline-none transition-colors ${emailError ? 'border-red-400 focus:border-red-500' : 'border-[#C5D3E2]'
                      }`}
                  />
                  {emailError && (
                    <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{emailError}</span>
                    </div>
                  )}
                  {subscriptionError && (
                    <div role="alert" className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{subscriptionError}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isSubscribing}
                    className="w-full py-1.5 px-3 bg-[#173F6B] hover:bg-[#0F2F52] text-white text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer text-center shadow-2xs hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </aside>
      {isDepartmentMenuOpen && window.matchMedia('(min-width: 1024px)').matches &&
        createPortal(
          <div
            className="fixed z-[60] w-64 bg-[#EAF4FC] border border-[#D5E5F2] rounded-sm shadow-lg p-1"
            style={{ top: departmentMenuPosition.top, left: departmentMenuPosition.left }}
            onMouseEnter={clearDepartmentMenuTimeout}
            onMouseLeave={scheduleDepartmentMenuClose}
          >
            {DEPARTMENT_ACADEMIC_TARGETS.map((target) => (
              <div
                key={target}
                className="relative"
                onMouseEnter={() => setExpandedAcademicTarget(target)}
                onMouseLeave={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                    setExpandedAcademicTarget(null);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => handleTargetAudienceClick(createDepartmentTargetAudience(target))}
                  className={`w-full px-3 py-2.5 text-left text-xs font-medium rounded-sm transition-colors flex items-center justify-between ${
                    (expandedAcademicTarget
                      ? expandedAcademicTarget === target
                      : selectedDepartmentTarget?.academicTarget === target || selectedTargetAudience === target)
                      ? 'bg-[#D4E3F2] text-[#17365D]'
                      : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D]'
                  }`}
                >
                  <span>{target}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {expandedAcademicTarget === target && (
                  <div                   className="absolute left-full top-0 z-[61] w-64 bg-[#EAF4FC] border border-[#D5E5F2] rounded-sm shadow-lg p-1">
                    {FINAL_YEAR_PROGRAMS.map((program) => {
                      const targetAudience = createDepartmentTargetAudience(target, program);
                      return (
                        <button
                          key={program}
                          type="button"
                          onClick={() => handleTargetAudienceClick(targetAudience)}
                          className={`w-full px-3 py-2.5 text-left text-xs font-medium rounded-sm transition-colors ${
                            selectedTargetAudience === targetAudience
                              ? 'bg-[#D4E3F2] text-[#17365D]'
                              : 'text-[#434751] hover:bg-[#DCE9F8] hover:text-[#17365D]'
                          }`}
                        >
                          {program}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {additionalTargetAudiences.map((audience) => (
              <button
                key={audience}
                type="button"
                onClick={() => handleTargetAudienceClick(audience)}
                className={`w-full px-3 py-2.5 text-left text-xs font-medium rounded-sm transition-colors ${
                  selectedTargetAudience === audience
                    ? 'bg-[#003c84]/10 text-[#00275a]'
                    : 'text-[#434751] hover:bg-[#f5f7fa] hover:text-[#1c1b1b]'
                }`}
              >
                {audience}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
