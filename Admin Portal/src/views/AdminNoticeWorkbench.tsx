import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { AdminNotice, AdminFilterState, AdminNoticeCategory } from '../types/adminNotice';
import {
  isoToDisplayDate,
  displayDateToIso,
  time12To24,
  time24To12,
} from '../utils/noticeStorage';
import { RichTextEditor } from '../components/RichTextEditor';
import { AdminApiService } from '../services/adminApi';
import {
  createDepartmentTargetAudience,
  DEPARTMENT_ACADEMIC_TARGETS,
  FINAL_YEAR_PROGRAMS,
  isDepartmentAcademicTarget,
  parseDepartmentTargetAudience,
  TARGET_AUDIENCES,
} from '../../../shared/targetAudiences';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CATEGORIES: AdminNoticeCategory[] = [
  'Academics',
  'Examination',
  'Placement & Training',
  'Events & Cultural',
  'Administration',
];

const ISSUING_AUTHORITIES = [
  'Training & Placement Officer',
  'Controller of Examinations',
  'Dean Academics',
  'Registrar Office',
  'Head of Industry Relations',
  'Cultural Committee Head',
  'Chief Librarian',
  'Director of Physical Education',
  'Principal Office',
  'College Admin',
];

const normalizeNoticeDateToKey = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateForDisplay = (dateKey: string): string => {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Parses deadline string (e.g. "Oct 26, 05:00 PM" or "Oct 28, 2024 · 05:00 PM" or ISO) into date (YYYY-MM-DD) and time (HH:mm)
 */
const parseDeadlineToDateAndTime = (deadlineStr?: string): { date: string; time: string } => {
  if (!deadlineStr || !deadlineStr.trim()) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, time: '17:00' };
  }

  let timeStr = '17:00';
  const timeMatch = deadlineStr.match(/(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)/);
  if (timeMatch) {
    timeStr = time12To24(timeMatch[1]);
  }

  const dateCandidate = deadlineStr
    .replace(/·/g, '')
    .replace(/(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)/g, '')
    .trim();

  let dateIso = '';
  if (dateCandidate) {
    dateIso = displayDateToIso(dateCandidate);
  }
  if (!dateIso || dateIso === 'NaN-NaN-NaN' || dateIso.includes('NaN')) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    dateIso = `${y}-${m}-${d}`;
  }

  return { date: dateIso, time: timeStr };
};

/**
 * Formats ISO date (YYYY-MM-DD) and 24h time (HH:mm) into display deadline (e.g. "Oct 26, 2024 · 05:00 PM")
 */
const formatDeadlineToDisplay = (dateIso: string, time24: string): string => {
  if (!dateIso) return '';
  const displayDate = isoToDisplayDate(dateIso);
  const displayTime = time24To12(time24);
  return `${displayDate} · ${displayTime}`;
};

interface AdminNoticeWorkbenchProps {
  initialSearch?: string;
  currentTab?: string;
  selectedCategory?: string;
  canManageNotices?: boolean;
  onNavigateTab?: (tab: string, category?: string) => void;
  onStatsChange?: (total: number, published: number) => void;
}

const getInitialCreateNoticeState = (): Partial<AdminNotice> => {
  const now = new Date();
  const displayDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return {
    title: '',
    category: 'Academics',
    status: 'Published',
    department: 'Academics',
    departmentKey: 'admin',
    summary: '',
    content: '',
    issuedBy: 'Training & Placement Officer',
    targetAudience: 'FY-BTECH',
    academicYear: 'AY 2026-27',
    date: displayDate,
    time: displayTime,
    isImportant: false,
    isUrgent: false,
    actionRequired: false,
    actionDeadline: '',
    actionDescription: '',
    attachments: [],
  };
};

export const AdminNoticeWorkbench: React.FC<AdminNoticeWorkbenchProps> = ({
  initialSearch = '',
  currentTab = 'dashboard',
  selectedCategory = 'all',
  canManageNotices = true,
  onNavigateTab,
  onStatsChange,
}) => {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [, setIsLoadingNotices] = useState<boolean>(false);

  const loadNotices = async () => {
    try {
      setIsLoadingNotices(true);
      const res = await AdminApiService.getNotices({ limit: 100 });
      if (res && Array.isArray(res.notices)) {
        setNotices(res.notices);
        if (res.notices.length > 0) {
          if (!selectedNoticeId || !res.notices.some((n) => n.id === selectedNoticeId)) {
            setSelectedNoticeId(res.notices[0]?.id || '');
          }
        } else {
          setSelectedNoticeId('');
        }
      }
    } catch (err: any) {
      console.error('Failed to load notices from backend:', err);
      showToast(err.message || 'Failed to load notices from backend.', 'error');
    } finally {
      setIsLoadingNotices(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('icem_notices_v1');
    } catch {}
    loadNotices();
  }, []);

  // Dedicated Create Notice Form state
  const [createNoticeData, setCreateNoticeData] = useState<Partial<AdminNotice>>(getInitialCreateNoticeState);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Separate Action Deadline date & time state
  const [actionDeadlineDate, setActionDeadlineDate] = useState<string>(() => parseDeadlineToDateAndTime('').date);
  const [actionDeadlineTime, setActionDeadlineTime] = useState<string>(() => parseDeadlineToDateAndTime('').time);

  // Edit state for existing notice
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const savingRef = useRef(false);

  // Filter state
  const [filters, setFilters] = useState<AdminFilterState>({
    search: initialSearch,
    category: selectedCategory || 'all',
    department: 'all',
    statusTab: 'all',
    dateFilter: undefined,
    selectedDate: undefined,
  });

  // Date Picker dropdown state for list filtering
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth());

  // Update selected category from prop
  useEffect(() => {
    if (selectedCategory) {
      setFilters((prev) => ({ ...prev, category: selectedCategory }));
      setCurrentPage(1);
    }
  }, [selectedCategory]);

  // Update search from prop
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: initialSearch }));
    setCurrentPage(1);
  }, [initialSearch]);

  // Sync notice stats to parent/header
  useEffect(() => {
    const total = notices.length;
    const published = notices.filter((n) => n.status === 'Published').length;
    if (onStatsChange) {
      onStatsChange(total, published);
    }
  }, [notices, onStatsChange]);

  // Sync calendar view month/year when selectedDate changes
  useEffect(() => {
    if (filters.selectedDate) {
      const [y, m] = filters.selectedDate.split('-').map(Number);
      if (y && m) {
        setCalYear(y);
        setCalMonth(m - 1);
      }
    }
  }, [filters.selectedDate]);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  // Calendar calculations
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const selectedKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setFilters((prev) => ({ ...prev, selectedDate: selectedKey }));
    setCurrentPage(1);
    setIsDatePickerOpen(false);
  };

  const handleClearDate = () => {
    setFilters((prev) => ({ ...prev, selectedDate: undefined }));
    setCurrentPage(1);
    setIsDatePickerOpen(false);
  };

  // Dates in current month that have notices
  const activeDatesInMonth = useMemo(() => {
    const datesSet = new Set<number>();
    notices.forEach((n) => {
      const key = normalizeNoticeDateToKey(n.date);
      if (key) {
        const [y, m, d] = key.split('-').map(Number);
        if (y === calYear && m - 1 === calMonth) {
          datesSet.add(d);
        }
      }
    });
    return datesSet;
  }, [notices, calYear, calMonth]);

  // Show temporary toast notification
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered notices calculation
  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      // Search filter
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchTitle = notice.title.toLowerCase().includes(q);
        const matchSummary = notice.summary?.toLowerCase().includes(q);
        const matchContent = notice.content?.toLowerCase().includes(q);
        const matchDept = notice.department?.toLowerCase().includes(q);
        const matchIssuer = notice.issuedBy?.toLowerCase().includes(q);
        const matchCat = notice.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary && !matchContent && !matchDept && !matchIssuer && !matchCat) {
          return false;
        }
      }

      // Category filter
      if (filters.category && filters.category !== 'all') {
        const catFilter = filters.category.toLowerCase().trim();
        const noticeCat = (notice.category || '').toLowerCase().trim();
        
        if (catFilter === 'academics' || catFilter === 'academic') {
          if (noticeCat !== 'academics' && noticeCat !== 'academic') return false;
        } else if (catFilter === 'examination' || catFilter === 'exam') {
          if (noticeCat !== 'examination' && noticeCat !== 'exam') return false;
        } else if (catFilter === 'placement & training' || catFilter === 'placement' || catFilter === 'training & placement') {
          if (noticeCat !== 'placement & training' && noticeCat !== 'placement' && noticeCat !== 'training & placement') return false;
        } else if (catFilter === 'events & cultural' || catFilter === 'events' || catFilter === 'event' || catFilter === 'cultural') {
          if (noticeCat !== 'events & cultural' && noticeCat !== 'events' && noticeCat !== 'event' && noticeCat !== 'cultural') return false;
        } else if (catFilter === 'administration' || catFilter === 'admin' || catFilter === 'administrative') {
          if (noticeCat !== 'administration' && noticeCat !== 'admin' && noticeCat !== 'administrative') return false;
        } else if (noticeCat !== catFilter) {
          return false;
        }
      }

      // Specific Date Filter (Calendar-day match)
      if (filters.selectedDate) {
        const noticeDateKey = normalizeNoticeDateToKey(notice.date);
        if (noticeDateKey !== filters.selectedDate) {
          return false;
        }
      }

      return true;
    });
  }, [notices, filters]);

  // Single source of truth for the currently selected notice ID
  // Validates that selectedNoticeId belongs to current filtered list, otherwise defaults to first filtered notice
  const currentSelectedNoticeId = useMemo(() => {
    if (filteredNotices.length === 0) return '';
    const exists = filteredNotices.some((n) => n.id === selectedNoticeId);
    if (exists) return selectedNoticeId;
    return filteredNotices[0].id;
  }, [filteredNotices, selectedNoticeId]);

  // Keep selectedNoticeId state synchronized with current selection
  useEffect(() => {
    if (currentSelectedNoticeId && currentSelectedNoticeId !== selectedNoticeId) {
      setSelectedNoticeId(currentSelectedNoticeId);
    }
  }, [currentSelectedNoticeId, selectedNoticeId]);

  // Selected notice object (strictly synchronized with current selected notice ID)
  const activeNotice = useMemo(() => {
    if (!currentSelectedNoticeId) return null;
    return notices.find((n) => n.id === currentSelectedNoticeId) || null;
  }, [notices, currentSelectedNoticeId]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / itemsPerPage));
  const paginatedNotices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredNotices.slice(start, start + itemsPerPage);
  }, [filteredNotices, currentPage, itemsPerPage]);

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      department: 'all',
      statusTab: 'all',
      dateFilter: undefined,
      selectedDate: undefined,
    });
    setCurrentPage(1);
    setIsDatePickerOpen(false);
    if (onNavigateTab) {
      onNavigateTab('dashboard', 'all');
    }
    showToast('All filters reset.', 'success');
  };

  // Action: Delete Notice via Backend
  const handleDeleteNotice = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this notice?')) {
      try {
        await AdminApiService.deleteNotice(id);
        const updated = notices.filter((n) => n.id !== id);
        setNotices(updated);
        if (selectedNoticeId === id) {
          setSelectedNoticeId(updated[0]?.id || '');
        }
        showToast('Notice deleted successfully.', 'success');
      } catch (err: any) {
        console.error('Failed to delete notice from backend:', err);
        showToast(err.message || 'Failed to delete notice on server.', 'error');
      }
    }
  };

  // Action: Open Edit Notice in full page form
  const handleOpenEdit = (notice: AdminNotice) => {
    setEditingNoticeId(notice.id);
    const departmentTarget = parseDepartmentTargetAudience(notice.targetAudience);
    setSelectedBranch(departmentTarget?.program || '');
    const parsedDeadline = parseDeadlineToDateAndTime(notice.actionDeadline);
    setActionDeadlineDate(parsedDeadline.date);
    setActionDeadlineTime(parsedDeadline.time);

    setCreateNoticeData({
      id: notice.id,
      refNo: notice.refNo,
      title: notice.title,
      category: notice.category,
      status: 'Published',
      summary: notice.summary,
      content: notice.content || notice.summary,
      issuedBy: notice.issuedBy || 'Training & Placement Officer',
      department: notice.department,
      departmentKey: notice.departmentKey,
      date: notice.date,
      time: notice.time,
      targetAudience: departmentTarget?.academicTarget || (notice.targetAudience || 'FY-BTECH'),
      academicYear: notice.academicYear || 'AY 2026-27',
      isImportant: notice.isImportant || false,
      isUrgent: notice.isUrgent || false,
      actionRequired: notice.actionRequired || false,
      actionDeadline: notice.actionDeadline || '',
      actionDescription: notice.actionDescription || '',
      attachments: notice.attachments ? [...notice.attachments] : [],
    });

    if (onNavigateTab) {
      onNavigateTab('create-notice');
    } else {
      window.location.hash = '#/create-notice';
    }
  };

  // Dedicated Full-Page Create/Edit Notice Save Handler with Backend Persistence
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      showToast('Please wait for uploads to finish.', 'error');
      return;
    }
    if (!createNoticeData.title || !createNoticeData.title.trim()) {
      showToast('Please enter a notice title.', 'error');
      return;
    }

    const noticeSummary =
      createNoticeData.summary?.trim() ||
      createNoticeData.content?.replace(/<[^>]+>/g, ' ').trim() ||
      createNoticeData.title.trim();
    const noticeContent =
      createNoticeData.content?.trim() ||
      noticeSummary;
    const noticeDate = createNoticeData.date || isoToDisplayDate();
    const noticeTime = createNoticeData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const noticeAuthority = createNoticeData.issuedBy?.trim() || 'Training & Placement Officer';
    const noticeAudience = isDepartmentAcademicTarget(createNoticeData.targetAudience || '')
      ? createDepartmentTargetAudience(
          createNoticeData.targetAudience as (typeof DEPARTMENT_ACADEMIC_TARGETS)[number],
          selectedBranch
            ? selectedBranch as (typeof FINAL_YEAR_PROGRAMS)[number]
            : undefined
        )
      : (createNoticeData.targetAudience?.trim() || 'FY-BTECH');

    const finalDeadline = createNoticeData.actionRequired
      ? (actionDeadlineDate ? formatDeadlineToDisplay(actionDeadlineDate, actionDeadlineTime) : createNoticeData.actionDeadline?.trim())
      : undefined;

    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      if (editingNoticeId) {
        // Update existing notice on backend
        const updatePayload: Partial<AdminNotice> = {
          title: createNoticeData.title!.trim(),
          category: createNoticeData.category,
          summary: noticeSummary,
          content: noticeContent,
          issuedBy: noticeAuthority,
          department: createNoticeData.department || (createNoticeData.category as string),
          departmentKey: createNoticeData.departmentKey || 'admin',
          date: noticeDate,
          time: noticeTime,
          targetAudience: noticeAudience,
          academicYear: createNoticeData.academicYear || 'AY 2026-27',
          isImportant: createNoticeData.isImportant !== undefined ? createNoticeData.isImportant : false,
          isUrgent: createNoticeData.isUrgent !== undefined ? createNoticeData.isUrgent : false,
          actionRequired: createNoticeData.actionRequired !== undefined ? createNoticeData.actionRequired : false,
          actionDeadline: finalDeadline,
          actionDescription: createNoticeData.actionDescription?.trim() || undefined,
          attachments: createNoticeData.attachments ? [...createNoticeData.attachments] : [],
        };

        const updatedNotice = await AdminApiService.updateNotice(editingNoticeId, updatePayload);
        const updated = notices.map((n) => (n.id === editingNoticeId ? updatedNotice : n));
        setNotices(updated);
        setSelectedNoticeId(editingNoticeId);
        showToast('Notice updated successfully.', 'success');
      } else {
        // Create new notice on backend
        const createPayload: Partial<AdminNotice> = {
          title: createNoticeData.title.trim(),
          category: createNoticeData.category || 'Academics',
          status: 'Published',
          summary: noticeSummary,
          content: noticeContent,
          issuedBy: noticeAuthority,
          department: createNoticeData.department || (createNoticeData.category as string) || 'Academics',
          departmentKey: createNoticeData.departmentKey || 'admin',
          date: noticeDate,
          time: noticeTime,
          targetAudience: noticeAudience,
          academicYear: createNoticeData.academicYear || 'AY 2026-27',
          isImportant: createNoticeData.isImportant || false,
          isUrgent: createNoticeData.isUrgent || false,
          actionRequired: createNoticeData.actionRequired || false,
          actionDeadline: finalDeadline,
          actionDescription: createNoticeData.actionDescription?.trim() || undefined,
          attachments: createNoticeData.attachments || [],
        };

        const createdNotice = await AdminApiService.createNotice(createPayload);
        const updated = [createdNotice, ...notices];
        setNotices(updated);
        setSelectedNoticeId(createdNotice.id);
        showToast('Notice published successfully.', 'success');
      }

      setEditingNoticeId(null);
      setCreateNoticeData(getInitialCreateNoticeState());
      setSelectedBranch('');
      const resetDeadline = parseDeadlineToDateAndTime('');
      setActionDeadlineDate(resetDeadline.date);
      setActionDeadlineTime(resetDeadline.time);

      if (onNavigateTab) {
        onNavigateTab('dashboard');
      } else {
        window.location.hash = '#/dashboard';
      }
    } catch (err: any) {
      console.error('Failed to save notice to backend:', err);
      showToast(err.message || 'Failed to save notice to backend.', 'error');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleCancelCreate = () => {
    setEditingNoticeId(null);
    setCreateNoticeData(getInitialCreateNoticeState());
    const resetDeadline = parseDeadlineToDateAndTime('');
    setActionDeadlineDate(resetDeadline.date);
    setActionDeadlineTime(resetDeadline.time);
    if (onNavigateTab) {
      onNavigateTab('dashboard');
    } else {
      window.location.hash = '#/dashboard';
    }
  };

  const processUploadedFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    setIsUploading(true);
    try {
      showToast('Uploading attachments to server...');
      const uploaded = await AdminApiService.uploadNoticeAttachments(fileArray);
      setCreateNoticeData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploaded],
      }));
      showToast(`Attached ${uploaded.length} document${uploaded.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      console.error('Backend upload failed:', err);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processUploadedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleFileAttachmentDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setCreateNoticeData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index),
    }));
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'Examination':
        return 'text-[#92400e] bg-[#fef3c7] border border-[#fde68a]';
      case 'Placement & Training':
        return 'text-[#0f766e] bg-[#ccfbf1] border border-[#99f6e4]';
      case 'Academics':
        return 'text-[#334155] bg-[#f1f5f9] border border-[#e2e8f0]';
      case 'Events & Cultural':
        return 'text-[#6b21a8] bg-[#f3e8ff] border border-[#e9d5ff]';
      case 'Administration':
        return 'text-[#1e3a8a] bg-[#dbeafe] border border-[#bfdbfe]';
      default:
        return 'text-[#334155] bg-[#f1f5f9] border border-[#e2e8f0]';
    }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastType === 'error'
              ? 'bg-[#991b1b] border-[#fca5a5]/30'
              : 'bg-[#00275a] border-[#d8e2ff]/30'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              toastType === 'error' ? 'text-[#fca5a5]' : 'text-emerald-400'
            }`}
          >
            {toastType === 'error' ? 'error' : 'check_circle'}
          </span>
          <span className="text-sm font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/70 hover:text-white ml-2 cursor-pointer"
            aria-label="Close notification"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {currentTab === 'create-notice' && canManageNotices ? (
        /* ========================================================================= */
        /* CREATE / EDIT NOTICE VIEW                                                */
        /* ========================================================================= */
        <div className="w-full flex flex-col gap-5 sm:gap-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start sm:items-center gap-3.5 pt-2 border-b border-[#e2e6ec] pb-4">
            <button
              type="button"
              onClick={handleCancelCreate}
              className="p-2 sm:p-2.5 bg-white text-[#5c6470] hover:text-[#00275a] hover:bg-[#f0f4fd] border border-[#e2e6ec] hover:border-[#00275a]/40 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0"
              title="Return to Notice Dashboard"
              aria-label="Return to Notice Dashboard"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#5c6470]">Notice Management</span>
                <span className="text-xs text-[#737782]">/</span>
                <span className="text-xs font-semibold text-[#00275a]">
                  {editingNoticeId ? 'Edit Notice' : 'Create Notice'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#00275a] tracking-tight leading-tight mt-0.5 truncate">
                {editingNoticeId ? 'Edit Notice' : 'Create Notice'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5c6470] leading-relaxed">
                {editingNoticeId
                  ? 'Update circular details, schedule, attachments, and student requirements.'
                  : 'Compose and publish official announcements for students and faculty.'}
              </p>
            </div>
          </div>

          {/* Create/Edit Form */}
          <form onSubmit={handleSaveCreate} className="flex flex-col gap-5">
            {/* Card 1: Core Information */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-4 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#e2e6ec]">
                <div className="w-8 h-8 rounded-lg bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#00275a]">Notice Details</h2>
                  <p className="text-xs text-[#5c6470]">Headline, category, and date/time scheduling.</p>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#434751] flex items-center justify-between">
                  <span>Notice Title <span className="text-[#ef4444]">*</span></span>
                  <span className="text-[11px] font-normal text-[#737782] lowercase">required</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TCS Campus Recruitment Drive 2024 - Important Updates"
                  value={createNoticeData.title || ''}
                  onChange={(e) => setCreateNoticeData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm placeholder:text-[#737782] border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors"
                />
              </div>

              {/* Category, Issuing Authority, Target Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Category <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={createNoticeData.category || 'Academics'}
                      onChange={(e) =>
                        setCreateNoticeData((prev) => ({
                          ...prev,
                          category: e.target.value as AdminNoticeCategory,
                          department: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none appearance-none cursor-pointer pr-8"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737782] text-[18px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Issuing Authority (Dropdown) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Issuing Authority <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={createNoticeData.issuedBy || 'Training & Placement Officer'}
                      onChange={(e) => setCreateNoticeData((prev) => ({ ...prev, issuedBy: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none appearance-none cursor-pointer pr-8"
                    >
                      {createNoticeData.issuedBy && !ISSUING_AUTHORITIES.includes(createNoticeData.issuedBy) && (
                        <option value={createNoticeData.issuedBy}>{createNoticeData.issuedBy}</option>
                      )}
                      {ISSUING_AUTHORITIES.map((auth) => (
                        <option key={auth} value={auth}>
                          {auth}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737782] text-[18px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Target Audience (Dropdown) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Target Audience
                  </label>
                  <div className="relative">
                    <select
                      value={createNoticeData.targetAudience || 'FY-BTECH'}
                      onChange={(e) => {
                        const targetAudience = e.target.value;
                        setCreateNoticeData((prev) => ({ ...prev, targetAudience }));
                        setSelectedBranch('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none appearance-none cursor-pointer pr-8"
                    >
                      {createNoticeData.targetAudience &&
                        createNoticeData.targetAudience !== 'Department' &&
                        !isDepartmentAcademicTarget(createNoticeData.targetAudience || '') &&
                        !TARGET_AUDIENCES.some((audience) => audience === createNoticeData.targetAudience) && (
                        <option value={createNoticeData.targetAudience}>{createNoticeData.targetAudience}</option>
                      )}
                      {TARGET_AUDIENCES.map((aud) => (
                        <option key={aud} value={aud}>
                          {aud}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737782] text-[18px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
                {isDepartmentAcademicTarget(createNoticeData.targetAudience || '') && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                      Branch (optional)
                    </label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none appearance-none cursor-pointer pr-8"
                      >
                        <option value="">All branches</option>
                        {FINAL_YEAR_PROGRAMS.map((program) => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737782] text-[18px] pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time Picker Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Date Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#003c84]">calendar_today</span>
                    <span>Notice Date</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={displayDateToIso(createNoticeData.date)}
                    onChange={(e) => {
                      const iso = e.target.value;
                      setCreateNoticeData((prev) => ({
                        ...prev,
                        date: isoToDisplayDate(iso),
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors cursor-pointer"
                  />
                </div>

                {/* Time Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#003c84]">schedule</span>
                    <span>Notice Time</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={time12To24(createNoticeData.time)}
                    onChange={(e) => {
                      const time24 = e.target.value;
                      setCreateNoticeData((prev) => ({
                        ...prev,
                        time: time24To12(time24),
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Rich-Text Description Editor */}
              <div className="flex flex-col gap-1.5 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#434751] flex items-center justify-between">
                  <span>Notice Description &amp; Instructions <span className="text-[#ef4444]">*</span></span>
                  <span className="text-[11px] font-normal text-[#737782]">supports bold, italic, underline, lists, alignment</span>
                </label>
                <RichTextEditor
                  value={createNoticeData.content || createNoticeData.summary || ''}
                  onChange={(html) => {
                    const plain = html.replace(/<[^>]+>/g, ' ').trim();
                    setCreateNoticeData((prev) => ({
                      ...prev,
                      content: html,
                      summary: plain,
                    }));
                  }}
                  placeholder="Enter full notice announcement with rich formatting (bold, italic, underline, alignments, bullet points)..."
                  minHeight="180px"
                />
              </div>
            </div>

            {/* Card 2: Attachments */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-4 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#e2e6ec]">
                <div className="w-8 h-8 rounded-lg bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#00275a]">Supporting Attachments</h2>
                  <p className="text-xs text-[#5c6470]">Attach PDFs, spreadsheets, or circular documents.</p>
                </div>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                multiple
                ref={attachmentFileInputRef}
                onChange={handleFileAttachmentUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                className="hidden"
              />

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                }}
                onDrop={handleFileAttachmentDrop}
                onClick={() => attachmentFileInputRef.current?.click()}
                className={`p-5 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                  isDraggingFile
                    ? 'border-[#003c84] bg-[#f0f4fd]'
                    : 'border-[#cbd5e1] hover:border-[#003c84] bg-[#f8fafc] hover:bg-[#f0f4fd]/50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-[#e2e8f0] text-[#003c84] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#00275a]">
                  Drag &amp; drop files here, or <span className="underline">browse</span>
                </p>
                <p className="text-[11px] text-[#737782]">PDF, DOCX, XLSX, CSV, JPG, PNG (Max 10MB)</p>
              </div>

              {/* Attached files list */}
              {createNoticeData.attachments && createNoticeData.attachments.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {createNoticeData.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-[#f8fafc] rounded-lg border border-[#e2e6ec]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-[#003c84] text-[20px] shrink-0">
                          {att.type === 'pdf' ? 'picture_as_pdf' : att.type === 'excel' ? 'table_chart' : 'description'}
                        </span>
                        <span className="text-xs font-semibold text-[#1c1b1b] truncate">{att.name}</span>
                        <span className="text-[11px] text-[#5c6470] shrink-0">({att.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 text-[#737782] hover:text-[#ef4444] rounded cursor-pointer shrink-0"
                        title="Remove file"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Row */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelCreate}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-[#e2e6ec] text-[#434751] hover:bg-[#f1f5f9] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#003c84] hover:bg-[#00275a] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {editingNoticeId ? 'save' : 'publish'}
                </span>
                <span>
                  {isUploading
                    ? 'Uploading…'
                    : isSaving
                    ? editingNoticeId
                      ? 'Updating…'
                      : 'Publishing…'
                    : editingNoticeId
                    ? 'Update Notice'
                    : 'Publish Notice'}
                </span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ========================================================================= */
        /* MAIN NOTICE DASHBOARD WORKBENCH VIEW                                     */
        /* ========================================================================= */
        <>
          {/* Page Header */}
          <div className="flex flex-col gap-1 pt-1">
            <h1 className="text-2xl sm:text-[26px] font-bold text-[#00275a] tracking-tight leading-tight">
              {filters.category && filters.category !== 'all'
                ? `${filters.category} Notices`
                : canManageNotices ? 'Manage Notices' : 'Browse Notices'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5c6470] max-w-2xl leading-relaxed">
              {filters.category && filters.category !== 'all'
                ? `${canManageNotices ? 'Filter and manage' : 'Browse'} institutional circulars in the ${filters.category} category.`
                : canManageNotices
                  ? 'Search, review, edit, or publish institutional circulars and notices.'
                  : 'Search and review published institutional circulars and notices.'}
            </p>
          </div>

          {/* Split Master-Detail Workbench Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (lg:col-span-7): Filter Bar + Notice List */}
            <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
              {/* Filter & Query Command Bar */}
              <div className="bg-white p-3.5 rounded-lg border border-[#e2e6ec] shadow-xs flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  {/* Search Input */}
                  <div className="sm:col-span-5 relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737782] text-[18px]">
                      search
                    </span>
                    <input
                      value={filters.search}
                      onChange={(e) => {
                        setFilters((prev) => ({ ...prev, search: e.target.value }));
                        setCurrentPage(1);
                      }}
                      placeholder="Search title, authority, keywords..."
                      type="text"
                      className="w-full pl-9 pr-3 py-2 bg-white text-[#1c1b1b] text-xs sm:text-sm placeholder:text-[#737782] border border-[#e2e6ec] rounded-lg focus:border-[#00275a] focus:ring-1 focus:ring-[#00275a] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="sm:col-span-4 relative">
                    <select
                      value={filters.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setFilters((prev) => ({ ...prev, category: cat }));
                        setCurrentPage(1);
                        if (onNavigateTab) {
                          onNavigateTab('dashboard', cat);
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white text-[#1c1b1b] text-xs sm:text-sm border border-[#e2e6ec] rounded-lg focus:border-[#00275a] focus:ring-1 focus:ring-[#00275a] focus:outline-none appearance-none cursor-pointer pr-7 text-ellipsis overflow-hidden transition-colors"
                      aria-label="Filter notices by category"
                    >
                      <option value="all">All Categories</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#737782] text-[16px] pointer-events-none">
                      expand_more
                    </span>
                  </div>

                  {/* Date Filter */}
                  <div className="sm:col-span-3 relative" ref={datePickerRef}>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen((prev) => !prev)}
                      className={`w-full px-2.5 py-2 bg-white text-xs sm:text-sm border rounded-lg focus:border-[#00275a] focus:ring-1 focus:ring-[#00275a] focus:outline-none cursor-pointer transition-colors flex items-center justify-between gap-1 text-left ${
                        filters.selectedDate
                          ? 'border-[#00275a] text-[#00275a] font-semibold bg-[#f0f4fd]'
                          : 'border-[#e2e6ec] text-[#1c1b1b] hover:border-[#cbd5e1]'
                      }`}
                      aria-label="Filter notices by date"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className={`material-symbols-outlined text-[16px] shrink-0 ${filters.selectedDate ? 'text-[#00275a]' : 'text-[#737782]'}`}>
                          calendar_today
                        </span>
                        <span className="truncate text-xs">
                          {filters.selectedDate ? formatDateForDisplay(filters.selectedDate) : 'Date'}
                        </span>
                      </div>

                      {filters.selectedDate ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearDate();
                          }}
                          className="p-0.5 hover:bg-[#d8e2ff] text-[#737782] hover:text-[#00275a] rounded transition-colors cursor-pointer shrink-0"
                          title="Clear date"
                        >
                          <span className="material-symbols-outlined text-[14px] block">close</span>
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[#737782] text-[16px] shrink-0 pointer-events-none">
                          expand_more
                        </span>
                      )}
                    </button>

                    {/* Calendar Dropdown Popup */}
                    {isDatePickerOpen && (
                      <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 z-50 bg-white border border-[#e2e6ec] rounded-lg shadow-lg p-3 w-[270px] max-w-[calc(100vw-2.5rem)] text-[#1c1b1b]">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#e2e6ec]">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 text-[#737782] hover:text-[#00275a] hover:bg-[#f0eded] rounded transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px] block">chevron_left</span>
                          </button>
                          <span className="text-xs font-bold text-[#00275a]">
                            {MONTH_NAMES[calMonth]} {calYear}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 text-[#737782] hover:text-[#00275a] hover:bg-[#f0eded] rounded transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px] block">chevron_right</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <span key={d} className="text-[10px] font-semibold text-[#5c6470] uppercase">
                              {d}
                            </span>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-7 h-7" />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = filters.selectedDate === dayKey;
                            const hasNotices = activeDatesInMonth.has(day);

                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleSelectDay(day)}
                                className={`w-7 h-7 text-xs rounded flex flex-col items-center justify-center transition-colors relative cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#00275a] text-white font-bold shadow-xs'
                                    : 'hover:bg-[#f0f4fd] hover:text-[#00275a] text-[#1c1b1b]'
                                }`}
                              >
                                <span>{day}</span>
                                {hasNotices && !isSelected && (
                                  <span className="w-1 h-1 rounded-full bg-[#00275a] absolute bottom-0.5"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-[#e2e6ec] flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={handleClearDate}
                            className="text-[#00696c] hover:text-[#00275a] font-medium transition-colors cursor-pointer"
                          >
                            All Dates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter tags & Reset */}
                {(filters.category !== 'all' || filters.selectedDate || filters.search) && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e2e6ec]/80 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#5c6470] font-medium">Active Filters:</span>
                      {filters.category !== 'all' && (
                        <span className="px-2 py-0.5 bg-[#f0f4fd] text-[#00275a] font-semibold rounded border border-[#d8e2ff]">
                          {filters.category}
                        </span>
                      )}
                      {filters.selectedDate && (
                        <span className="px-2 py-0.5 bg-[#f0f4fd] text-[#00275a] font-semibold rounded border border-[#d8e2ff]">
                          {formatDateForDisplay(filters.selectedDate)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="text-[#00696c] hover:text-[#00275a] underline transition-colors cursor-pointer font-medium shrink-0"
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive Notice Master List */}
              <div className="bg-white rounded-lg shadow-xs border border-[#e2e6ec] overflow-hidden">
                {/* List Header */}
                <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e6ec] flex items-center justify-between text-[#434751]">
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    Notices ({filteredNotices.length})
                  </span>
                  <span className="text-xs text-[#5c6470]">
                    Showing <strong className="text-[#00275a] font-semibold">{paginatedNotices.length}</strong> of{' '}
                    {filteredNotices.length}
                  </span>
                </div>

                {/* List Items */}
                <div>
                  {paginatedNotices.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-[#737782] mb-2">
                        search_off
                      </span>
                      <p className="text-sm font-semibold text-[#1c1b1b]">No matching notices found</p>
                      <p className="text-xs text-[#5c6470] mt-1">
                        Try adjusting your search criteria or resetting filters.
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 text-xs bg-[#00275a] text-white rounded font-medium cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    paginatedNotices.map((notice) => {
                      const isSelected = notice.id === currentSelectedNoticeId;

                      return (
                        <div
                          key={notice.id}
                          onClick={() => setSelectedNoticeId(notice.id)}
                          style={{ borderLeftColor: isSelected ? '#00275a' : 'transparent' }}
                          className={`p-3.5 sm:p-4 transition-all cursor-pointer relative border-b border-[#e2e6ec] last:border-b-0 border-l-4 ${
                            isSelected
                              ? 'bg-[#d8e2ff]/30 !border-l-[#00275a]'
                              : 'hover:bg-[#f8fafc] !border-l-transparent'
                          }`}
                        >
                          <div className="flex flex-col gap-1.5">
                            {/* Title Row with status indicators (NO hover underline) */}
                            <div className="flex items-start gap-2">
                              {notice.isImportant && (
                                <span className="w-2 h-2 rounded-full bg-[#00275a] shrink-0 mt-1.5" title="Important Notice"></span>
                              )}
                              {notice.isUrgent && (
                                <span className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0 mt-1.5" title="Urgent Notice"></span>
                              )}
                              <h3 className="text-sm sm:text-base font-bold tracking-tight text-[#00275a] flex-1 min-w-0 leading-snug">
                                {notice.title}
                              </h3>
                            </div>

                            {/* Category Tag directly BELOW Title */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded shrink-0 ${getCategoryBadgeClass(notice.category)}`}>
                                {notice.category}
                              </span>
                              {notice.isUrgent && (
                                <span className="text-[10px] font-bold text-[#ef4444] bg-[#fee2e2] px-1.5 py-0.2 rounded border border-[#fca5a5] uppercase tracking-wider">
                                  Urgent
                                </span>
                              )}
                            </div>

                            {/* 2-line summary snippet */}
                            <p className="text-xs sm:text-sm text-[#434751] line-clamp-2 leading-relaxed">
                              {notice.summary}
                            </p>

                            {/* Authority & Date/Time Metadata */}
                            <div className="flex items-center gap-2 sm:gap-3 text-[#5c6470] text-xs flex-wrap pt-0.5">
                              <span className="flex items-center gap-1 font-medium text-[#1c1b1b]">
                                <span className="material-symbols-outlined text-[15px] text-[#737782]">
                                  person
                                </span>
                                {notice.issuedBy}
                              </span>
                              <span>•</span>
                              <span>
                                {notice.date} · {notice.time}
                              </span>
                              {notice.actionRequired && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#ea580c] font-semibold flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[13px]">alarm</span>
                                    Deadline: {notice.actionDeadline || 'Required'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredNotices.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1 text-xs text-[#5c6470]">
                  <div className="flex items-center gap-3">
                    <span>
                      Page <strong className="text-[#1c1b1b]">{currentPage}</strong> of {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>Items per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-0.5 bg-white border border-[#e2e6ec] text-[#1c1b1b] text-xs rounded focus:outline-none cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                    </div>
                  </div>

                  <nav aria-label="Notices pagination" className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white text-[#434751] border border-[#e2e6ec] rounded hover:bg-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-0.5 font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      <span>Prev</span>
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        onClick={() => setCurrentPage(pg)}
                        className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer ${
                          pg === currentPage
                            ? 'bg-[#00275a] text-white font-bold'
                            : 'bg-white text-[#1c1b1b] border border-[#e2e6ec] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        {pg}
                      </button>
                    ))}

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 bg-white text-[#434751] border border-[#e2e6ec] rounded hover:bg-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-0.5 font-medium"
                    >
                      <span>Next</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </nav>
                </div>
              )}
            </div>

            {/* Right Column (~40% width: lg:col-span-5): Notice Inspector */}
            <div className="lg:col-span-5 w-full lg:sticky lg:top-20">
              {activeNotice ? (
                <div className="bg-white rounded-lg border border-[#e2e6ec] shadow-xs overflow-hidden flex flex-col">
                  {/* Inspector Header */}
                  <div className="px-4 py-3 bg-[#f8fafc] border-b border-[#e2e6ec] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#00275a] text-[18px]">
                        info
                      </span>
                      <h2 className="text-sm font-bold text-[#00275a] tracking-tight">
                        Notice Details
                      </h2>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#059669] bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded">
                      Published
                    </span>
                  </div>

                  {/* Inspector Body */}
                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    {/* Category & Title */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-bold rounded ${getCategoryBadgeClass(activeNotice.category)}`}>
                          {activeNotice.category}
                        </span>
                        {activeNotice.isUrgent && (
                          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-[#ef4444] bg-[#fee2e2] rounded border border-[#fca5a5]">
                            Urgent
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg text-[#00275a] font-bold leading-snug">
                        {activeNotice.title}
                      </h3>
                    </div>

                    {/* Action Required Banner */}
                    {activeNotice.actionRequired && (
                      <div className="p-3 bg-[#fff7ed] border border-[#fed7aa] rounded-lg flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[#ea580c] text-[18px] mt-0.5 shrink-0">
                          alarm
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#ea580c]">
                            Action Deadline: {activeNotice.actionDeadline || 'Specified by Authority'}
                          </span>
                          <span className="text-xs text-[#5c6470] mt-0.5">
                            {activeNotice.actionDescription || 'Mandatory submission required.'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2.5 border-y border-[#e2e6ec] text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#5c6470] font-semibold">
                          Issued By
                        </span>
                        <span className="font-semibold text-[#1c1b1b] mt-0.5 truncate">
                          {activeNotice.issuedBy}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-[#5c6470] font-semibold">
                          Date &amp; Time
                        </span>
                        <span className="font-semibold text-[#1c1b1b] mt-0.5">
                          {activeNotice.date} · {activeNotice.time}
                        </span>
                      </div>
                    </div>

                    {/* Description Body */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#5c6470] font-semibold">
                        Content / Description
                      </span>
                      <div
                        className="text-xs sm:text-sm text-[#334155] leading-relaxed bg-[#f8fafc] p-3 rounded-lg border border-[#e2e6ec] max-h-56 overflow-y-auto prose prose-sm max-w-none [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        dangerouslySetInnerHTML={{
                          __html: activeNotice.content || activeNotice.summary || '<p>No description provided.</p>',
                        }}
                      />
                    </div>

                    {/* Attachments */}
                    {activeNotice.attachments && activeNotice.attachments.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#5c6470] font-semibold">
                          Attachments ({activeNotice.attachments.length})
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {activeNotice.attachments.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-[#f8fafc] border border-[#e2e6ec] rounded text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-[#003c84] text-[18px] shrink-0">
                                  {file.type === 'pdf' ? 'picture_as_pdf' : file.type === 'excel' ? 'table_chart' : 'description'}
                                </span>
                                <span className="font-medium text-[#1c1b1b] truncate">{file.name}</span>
                                <span className="text-[10px] text-[#5c6470] shrink-0">({file.size})</span>
                              </div>
                              {file.url && (
                                <a
                                  href={AdminApiService.resolveFileUrl(file.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="text-[#003c84] hover:text-[#00275a] p-1 rounded hover:bg-[#003c84]/10 transition-colors shrink-0"
                                  title={`Download ${file.name}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">download</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {canManageNotices && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#e2e6ec]">
                        <button
                          onClick={() => handleOpenEdit(activeNotice)}
                          className="py-2.5 px-3 bg-[#003c84] hover:bg-[#00275a] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 rounded-lg cursor-pointer shadow-2xs"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Edit Notice</span>
                        </button>
                        <button
                          onClick={() => handleDeleteNotice(activeNotice.id)}
                          className="py-2.5 px-3 bg-white border border-[#fca5a5] text-[#dc2626] hover:bg-[#fee2e2] text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 rounded-lg cursor-pointer"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Delete Notice</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-[#e2e6ec] p-8 text-center text-[#5c6470] shadow-xs">
                  <span className="material-symbols-outlined text-4xl text-[#737782] mb-2">
                    info
                  </span>
                  <p className="text-sm font-semibold text-[#1c1b1b]">No Notice Selected</p>
                  <p className="text-xs mt-1">Select a notice to view details or perform actions.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
