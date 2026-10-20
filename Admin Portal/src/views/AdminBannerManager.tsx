import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DashboardBanner } from '../types/adminBanner';
import { sampleBannerPresets } from '../types/adminBanner';
import {
  getStoredBanners,
  saveStoredBanners,
  toggleBannerStatus,
  deleteStoredBanner,
  resetToDefaultBanners,
} from '../utils/bannerStorage';
import { AdminApiService } from '../services/adminApi';

interface AdminBannerManagerProps {
  onNavigateTab?: (tab: string) => void;
}

const emptyBannerState: Partial<DashboardBanner> = {
  title: '',
  tag: 'HACKATHON',
  image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
  shortDescription: '',
  registrationUrl: '',
  actionText: 'Register',
  deadlineText: 'Registration Open',
  startDate: '',
  endDate: '',
  venue: 'ICEM Campus Quad / Online',
  isFeatured: true,
  status: 'open',
  isActive: true,
};

export const AdminBannerManager: React.FC<AdminBannerManagerProps> = ({
  onNavigateTab,
}) => {
  const [banners, setBanners] = useState<DashboardBanner[]>([]);
  const [formData, setFormData] = useState<Partial<DashboardBanner>>(emptyBannerState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'preset' | 'url' | 'upload'>('preset');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const loadBanners = async () => {
    try {
      const data = await AdminApiService.getBanners();
      if (data && data.length > 0) {
        setBanners(data);
        saveStoredBanners(data);
        return;
      }
    } catch (err) {
      console.warn('Backend banners fetch failed, fallback to local storage:', err);
    }
    setBanners(getStoredBanners());
  };

  // Load banners on mount and listen to updates
  useEffect(() => {
    loadBanners();

    const handleBannerUpdate = (e: any) => {
      if (e.detail) {
        setBanners(e.detail);
      } else {
        setBanners(getStoredBanners());
      }
    };

    window.addEventListener('icem-banner-update', handleBannerUpdate);
    window.addEventListener('storage', handleBannerUpdate);

    return () => {
      window.removeEventListener('icem-banner-update', handleBannerUpdate);
      window.removeEventListener('storage', handleBannerUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const activeCount = useMemo(() => banners.filter((b) => b.isActive !== false).length, [banners]);
  const inactiveCount = useMemo(() => banners.filter((b) => b.isActive === false).length, [banners]);

  // Handle Edit banner
  const handleStartEdit = (banner: DashboardBanner) => {
    setEditingId(banner.id);
    setFormData({ ...banner });
    setImageInputMode('url');
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    showToast(`Loaded "${banner.title}" into editor.`);
  };

  // Handle Cancel / Reset Edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(emptyBannerState);
    setImageInputMode('preset');
  };

  // Handle Status Toggle (1-click activate/deactivate)
  const handleToggle = async (id: string, currentStatus: boolean, title: string) => {
    try {
      await AdminApiService.toggleBannerStatus(id, !currentStatus);
      const updated = banners.map((b) => (b.id === id ? { ...b, isActive: !currentStatus } : b));
      setBanners(updated);
      saveStoredBanners(updated);
      showToast(
        currentStatus
          ? `Deactivated "${title}" — removed from Student Dashboard.`
          : `Activated "${title}" — published live to Student Dashboard.`
      );
    } catch (err: any) {
      console.warn('Backend banner toggle failed, falling back to local:', err);
      const updated = toggleBannerStatus(id);
      setBanners(updated);
      showToast(
        currentStatus
          ? `Deactivated "${title}".`
          : `Activated "${title}".`
      );
    }
  };

  // Handle Delete Banner
  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete banner "${title}"?`)) {
      try {
        await AdminApiService.deleteBanner(id);
        const updated = banners.filter((b) => b.id !== id);
        setBanners(updated);
        saveStoredBanners(updated);
        if (editingId === id) {
          handleCancelEdit();
        }
        showToast(`Deleted banner "${title}".`);
      } catch (err: any) {
        console.warn('Backend banner delete failed, falling back to local:', err);
        const updated = deleteStoredBanner(id);
        setBanners(updated);
        if (editingId === id) {
          handleCancelEdit();
        }
        showToast(`Deleted banner "${title}".`);
      }
    }
  };

  // Handle Reset to Defaults
  const handleResetDefaults = async () => {
    if (
      window.confirm(
        'Reset all banners to institutional default cards (Hackathon 24, AI Workshop, Tech Fest)?'
      )
    ) {
      try {
        const defaults = await AdminApiService.resetBanners();
        setBanners(defaults);
        saveStoredBanners(defaults);
        handleCancelEdit();
        showToast('Reset banners to default institutional events.');
      } catch (err: any) {
        console.warn('Backend banner reset failed, falling back to local:', err);
        const defaults = resetToDefaultBanners();
        setBanners(defaults);
        handleCancelEdit();
        showToast('Reset banners to default institutional events.');
      }
    }
  };

  // Handle File Upload to Backend Disk or fallback Data URL
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.');
      return;
    }

    try {
      showToast('Uploading banner graphic to server...');
      const { imageUrl } = await AdminApiService.uploadBannerImage(file);
      setFormData((prev) => ({ ...prev, image: imageUrl }));
      showToast('Image uploaded successfully to server.');
    } catch (err: any) {
      console.warn('Backend upload failed, converting to local preview:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFormData((prev) => ({ ...prev, image: reader.result as string }));
          showToast('Image loaded locally.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Form Submit (Save / Update Banner)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      showToast('Please enter a banner title.');
      return;
    }

    if (!formData.image?.trim()) {
      showToast('Please provide a banner image URL or upload an image.');
      return;
    }

    const bannerPayload: Partial<DashboardBanner> = {
      title: formData.title.trim(),
      tag: (formData.tag?.trim() || 'ANNOUNCEMENT').toUpperCase(),
      image: formData.image.trim(),
      shortDescription: formData.shortDescription?.trim() || 'Institutional announcement for ICEM students.',
      registrationUrl: formData.registrationUrl?.trim() || '',
      actionText: formData.actionText?.trim() || 'Register',
      deadlineText: formData.deadlineText?.trim() || 'Registration Open',
      startDate: formData.startDate?.trim() || undefined,
      endDate: formData.endDate?.trim() || undefined,
      venue: formData.venue?.trim() || undefined,
      isFeatured: true,
      status: (formData.status as any) || 'open',
      isActive: formData.isActive !== false,
    };

    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      if (editingId) {
        const saved = await AdminApiService.updateBanner(editingId, bannerPayload);
        const updatedList = banners.map((b) => (b.id === editingId ? saved : b));
        setBanners(updatedList);
        saveStoredBanners(updatedList);
        showToast(`Updated "${saved.title}" successfully on server.`);
      } else {
        const saved = await AdminApiService.createBanner(bannerPayload);
        const updatedList = [saved, ...banners];
        setBanners(updatedList);
        saveStoredBanners(updatedList);
        showToast(
          saved.isActive
            ? `Created and published "${saved.title}" to Student Dashboard.`
            : `Created "${saved.title}" as draft.`
        );
      }
    } catch (err: any) {
      console.warn('Backend banner save failed, falling back to local:', err);
      const bannerToSave: DashboardBanner = {
        id: editingId || `banner-${Date.now()}`,
        title: bannerPayload.title!,
        tag: bannerPayload.tag!,
        image: bannerPayload.image!,
        shortDescription: bannerPayload.shortDescription!,
        registrationUrl: bannerPayload.registrationUrl,
        actionText: bannerPayload.actionText,
        deadlineText: bannerPayload.deadlineText!,
        startDate: bannerPayload.startDate,
        endDate: bannerPayload.endDate,
        venue: bannerPayload.venue,
        isFeatured: true,
        status: (bannerPayload.status as any) || 'open',
        isActive: bannerPayload.isActive !== false,
        updatedAt: new Date().toISOString(),
        createdAt: formData.createdAt || new Date().toISOString(),
      };

      let updatedList: DashboardBanner[];
      if (editingId) {
        updatedList = banners.map((b) => (b.id === editingId ? bannerToSave : b));
        showToast(`Updated "${bannerToSave.title}" locally.`);
      } else {
        updatedList = [bannerToSave, ...banners];
        showToast(`Saved "${bannerToSave.title}" locally.`);
      }

      saveStoredBanners(updatedList);
      setBanners(updatedList);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }

    handleCancelEdit();
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00275a] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-[#d8e2ff]/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
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

      {/* Page Header & Navigation Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 sm:pt-3 border-b border-[#e2e6ec] pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) onNavigateTab('dashboard');
              else window.location.hash = '#/dashboard';
            }}
            className="p-2 sm:p-2.5 bg-white text-[#5c6470] hover:text-[#00275a] hover:bg-[#f0f4fd] border border-[#e2e6ec] hover:border-[#00275a]/40 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0"
            title="Return to Notice Dashboard"
            aria-label="Return to Notice Dashboard"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#5c6470] tracking-wide">
                Institutional Management
              </span>
              <span className="text-xs text-[#737782]">/</span>
              <span className="text-xs font-semibold text-[#00275a]">Student Portal</span>
              <span className="text-[10px] font-bold uppercase bg-[#d8e2ff] text-[#001a41] px-1.5 py-0.5 rounded">
                Dashboard Banner
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#00275a] tracking-tight leading-tight mt-0.5">
              Dashboard Banner
            </h1>
            <p className="text-xs sm:text-sm text-[#5c6470] leading-relaxed">
              Manage, feature, and publish promotional cards, hackathon circulars, and event banners displayed on the Student Portal dashboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-white text-[#5c6470] border border-[#e2e6ec] text-xs sm:text-sm font-semibold hover:bg-[#f6f3f2] hover:text-[#1c1b1b] transition-colors rounded-lg cursor-pointer shadow-2xs flex items-center gap-1.5"
            title="Reset to default mock events"
          >
            <span className="material-symbols-outlined text-[17px]">restart_alt</span>
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleCancelEdit();
              formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3.5 sm:px-4 py-2 bg-[#003c84] text-white text-xs sm:text-sm font-semibold hover:bg-[#00275a] transition-colors rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>Create New Banner</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5 w-full items-stretch">
        {/* Total Banners */}
        <div className="flex flex-col justify-between h-full min-h-[104px] bg-white rounded-xl border border-[#e2e6ec] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5c6470]">
              Total Configured
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#d8e2ff] text-[#00275a] flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">view_carousel</span>
            </div>
          </div>
          <div className="mt-auto pt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#00275a] tracking-tight leading-none">
              {banners.length}
            </span>
            <span className="text-[11px] font-medium text-[#5c6470] bg-[#f5f7fa] px-2 py-0.5 rounded border border-[#e2e6ec]/60">
              Repository
            </span>
          </div>
        </div>

        {/* Active on Student Dashboard */}
        <div className="flex flex-col justify-between h-full min-h-[104px] bg-white rounded-xl border border-[#059669]/30 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-emerald-50/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Active / Published
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
          </div>
          <div className="mt-auto pt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-emerald-700 tracking-tight leading-none">
              {activeCount}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
              Live on Student Feed
            </span>
          </div>
        </div>

        {/* Inactive / Drafts */}
        <div className="flex flex-col justify-between h-full min-h-[104px] bg-white rounded-xl border border-[#e2e6ec] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5c6470]">
              Inactive / Drafts
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#f0eded] text-[#5c6470] flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
            </div>
          </div>
          <div className="mt-auto pt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-[#5c6470] tracking-tight leading-none">
              {inactiveCount}
            </span>
            <span className="text-[11px] font-medium text-[#5c6470] bg-[#f5f7fa] px-2 py-0.5 rounded border border-[#e2e6ec]/60">
              Hidden from Feed
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Existing Banners Table & List */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#e2e6ec] bg-[#f6f3f2] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#00275a]">featured_play_list</span>
            <h2 className="font-bold text-base text-[#00275a]">Configured Student Dashboard Banners</h2>
          </div>
          <span className="text-xs text-[#5c6470]">
            {activeCount} of {banners.length} banners currently visible in Student Portal carousel
          </span>
        </div>

        {banners.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#737782] mb-2">
              view_carousel
            </span>
            <p className="text-sm font-semibold text-[#1c1b1b]">No banners configured</p>
            <p className="text-xs text-[#5c6470] mt-1">
              Create a new banner below or click "Reset Defaults" to restore initial cards.
            </p>
            <button
              onClick={handleResetDefaults}
              className="mt-3 px-3.5 py-1.5 text-xs bg-[#00275a] text-white rounded-lg font-medium cursor-pointer"
            >
              Load Default Institutional Banners
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#e2e6ec]">
            {banners.map((banner, index) => {
              const isActive = banner.isActive !== false;
              const isEditing = editingId === banner.id;

              return (
                <div
                  key={banner.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${isEditing
                    ? 'bg-[#d8e2ff]/25 border-l-4 border-[#00275a]'
                    : 'hover:bg-[#f5f7fa]/80'
                    }`}
                >
                  {/* Left: Thumbnail & Content Details */}
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                    {/* Thumbnail */}
                    <div className="w-full sm:w-28 h-28 sm:h-18 rounded-lg overflow-hidden border border-[#e2e6ec] shrink-0 relative bg-slate-900 group">
                      <img
                        src={AdminApiService.resolveFileUrl(banner.image)}
                        alt={banner.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-teal-300 uppercase tracking-wider">
                        {banner.tag || 'EVENT'}
                      </span>
                    </div>

                    {/* Metadata & Description */}
                    <div className="flex flex-col min-w-0 flex-1 w-full">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase bg-[#d8e2ff] text-[#001a41] px-2 py-0.5 rounded">
                          {banner.tag || 'EVENT'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
                              }`}
                          ></span>
                          {isActive ? 'Active / Live' : 'Inactive / Hidden'}
                        </span>
                        {index === 0 && isActive && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                            Primary Slide
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-[#00275a] leading-snug line-clamp-1">
                        {banner.title}
                      </h3>

                      <p className="text-xs text-[#5c6470] line-clamp-1 mt-0.5">
                        {banner.shortDescription || 'No description provided.'}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-[#737782] mt-1.5 flex-wrap">
                        {banner.deadlineText && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-[#ea580c]">
                              schedule
                            </span>
                            <span>{banner.deadlineText}</span>
                          </span>
                        )}
                        {banner.registrationUrl && (
                          <a
                            href={banner.registrationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-0.5 text-[#003c84] hover:underline"
                            title={banner.registrationUrl}
                          >
                            <span className="material-symbols-outlined text-[13px]">link</span>
                            <span className="truncate max-w-[200px]">{banner.registrationUrl}</span>
                          </a>
                        )}
                        {banner.actionText && (
                          <span className="bg-[#f0eded] text-[#434751] px-1.5 py-0.2 rounded font-medium">
                            CTA: {banner.actionText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Controls */}
                  <div className="flex items-center gap-2 self-start sm:self-end md:self-center shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggle(banner.id, isActive, banner.title)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${isActive
                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      title={isActive ? 'Deactivate and hide from Student Portal' : 'Publish live to Student Portal'}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isActive ? 'visibility_off' : 'visibility'}
                      </span>
                      <span>{isActive ? 'Deactivate' : 'Publish Live'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(banner)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border ${isEditing
                        ? 'bg-[#00275a] text-white border-[#00275a]'
                        : 'bg-white text-[#00275a] hover:bg-[#f0f4fd] border-[#e2e6ec]'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>{isEditing ? 'Editing' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(banner.id, banner.title)}
                      className="p-1.5 text-[#5c6470] hover:text-[#ef4444] hover:bg-[#ffdad6]/40 rounded-lg transition-colors cursor-pointer border border-[#e2e6ec]"
                      title="Delete banner"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Banner Creation & Edit Form Section */}
      <div ref={formSectionRef} className="pt-2">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Form Details Cards */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {/* Card 1: Core Banner Details */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e6ec]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      {editingId ? 'edit_note' : 'add_photo_alternate'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#00275a]">
                      {editingId ? 'Edit Dashboard Banner' : 'Create New Dashboard Banner'}
                    </h2>
                    <p className="text-xs text-[#5c6470]">
                      Configure event headline, badge tag, short summary, and action text.
                    </p>
                  </div>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-[#5c6470] hover:text-[#ef4444] underline font-medium cursor-pointer"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              {/* Banner Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#434751] flex items-center justify-between">
                  <span>Banner Title <span className="text-[#ef4444]">*</span></span>
                  <span className="text-[11px] font-normal text-[#737782] lowercase">required</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. National Innovation Hackathon '24"
                  value={formData.title || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm placeholder:text-[#737782] border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors"
                />
              </div>

              {/* Tag & Action Text Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Tag */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Badge Tag <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HACKATHON, WORKSHOP, TECH FEST"
                    value={formData.tag || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tag: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-[#737782]">Presets:</span>
                    {['HACKATHON', 'WORKSHOP', 'TECH FEST', 'PLACEMENT', 'ANNOUNCEMENT'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, tag: t }))}
                        className="text-[10px] bg-[#f0eded] hover:bg-[#d8e2ff] text-[#00275a] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button / Action Text */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Action Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Register, Apply Now, Learn More"
                    value={formData.actionText || 'Register'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, actionText: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-[#737782]">Presets:</span>
                    {['Register', 'Apply Now', 'Learn More', 'View Notice'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, actionText: label }))}
                        className="text-[10px] bg-[#f0eded] hover:bg-[#d8e2ff] text-[#00275a] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Short Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                  Short Description / Event Summary <span className="text-[#ef4444]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide brief details about the event, prize pool, eligibility, or agenda displayed in the student popup..."
                  value={formData.shortDescription || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm placeholder:text-[#737782] border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Card 2: Destination Link */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#e2e6ec]">
                <div className="w-8 h-8 rounded-lg bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">link</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#00275a]">Destination Link</h2>
                  <p className="text-xs text-[#5c6470]">
                    Configure the link users open when they interact with the Student Portal banner.
                  </p>
                </div>
              </div>

              {/* Destination URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                  Destination / Registration Link
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737782] text-[18px]">
                    language
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. https://indiraicem.ac.in/hackathon24 or #/notices/exam"
                    value={formData.registrationUrl || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationUrl: e.target.value }))}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm placeholder:text-[#737782] border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Visual Media & Image Configuration */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#e2e6ec]">
                <div className="w-8 h-8 rounded-lg bg-[#003c84]/10 text-[#003c84] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">image</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#00275a]">Banner Visual &amp; Artwork</h2>
                  <p className="text-xs text-[#5c6470]">
                    Select high-quality background imagery for the Student Portal dashboard card.
                  </p>
                </div>
              </div>

              {/* Input Mode Selector */}
              <div className="flex items-center gap-2 p-1 bg-[#f5f7fa] rounded-lg border border-[#e2e6ec]">
                <button
                  type="button"
                  onClick={() => setImageInputMode('preset')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${imageInputMode === 'preset'
                    ? 'bg-white text-[#00275a] shadow-xs'
                    : 'text-[#5c6470] hover:text-[#1c1b1b]'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">collections</span>
                  <span>Institutional Presets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('url')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${imageInputMode === 'url'
                    ? 'bg-white text-[#00275a] shadow-xs'
                    : 'text-[#5c6470] hover:text-[#1c1b1b]'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span>Image URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('upload')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${imageInputMode === 'upload'
                    ? 'bg-white text-[#00275a] shadow-xs'
                    : 'text-[#5c6470] hover:text-[#1c1b1b]'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Upload Image</span>
                </button>
              </div>

              {/* Preset Gallery Picker */}
              {imageInputMode === 'preset' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  {sampleBannerPresets.map((preset) => {
                    const isSelected = formData.image === preset.image;
                    return (
                      <div
                        key={preset.name}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            image: preset.image,
                            tag: prev.tag || preset.tag,
                          }));
                        }}
                        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all aspect-video group ${isSelected
                          ? 'border-[#00275a] ring-2 ring-[#00275a]/30'
                          : 'border-[#e2e6ec] hover:border-[#00275a]/60'
                          }`}
                      >
                        <img
                          src={preset.image}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex flex-col justify-end">
                          <span className="text-[10px] font-bold text-white line-clamp-1">
                            {preset.name}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#00275a] text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* URL Input */}
              {imageInputMode === 'url' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                    Image Direct URL <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={formData.image || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                      className="flex-1 px-3.5 py-2.5 bg-white text-[#1c1b1b] text-sm border border-[#e2e6ec] rounded-lg focus:border-[#003c84] focus:ring-1 focus:ring-[#003c84] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Upload Input */}
              {imageInputMode === 'upload' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-[#e2e6ec] hover:border-[#003c84] rounded-xl bg-[#f5f7fa] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
                  >
                    <span className="material-symbols-outlined text-3xl text-[#003c84]">
                      cloud_upload
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#00275a]">Click to select an image from your computer</p>
                      <p className="text-[11px] text-[#5c6470] mt-0.5">Supports PNG, JPG, WebP (up to 5MB)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Publishing Controls & Live Student Preview */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Publishing Controls Card */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#e2e6ec]">
                <span className="material-symbols-outlined text-[#00275a]">publish</span>
                <h3 className="font-bold text-sm text-[#00275a]">Publishing &amp; Status</h3>
              </div>

              {/* Status Radio / Selector */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#434751]">
                  Student Dashboard Status
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, isActive: true }))}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${formData.isActive !== false
                      ? 'bg-[#ecfdf5] border-[#059669] text-[#059669] ring-1 ring-[#059669]'
                      : 'bg-white border-[#e2e6ec] text-[#5c6470] hover:bg-[#f6f3f2]'
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                    <span>Active / Live</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, isActive: false }))}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${formData.isActive === false
                      ? 'bg-[#fff7ed] border-[#ea580c] text-[#ea580c] ring-1 ring-[#ea580c]'
                      : 'bg-white border-[#e2e6ec] text-[#5c6470] hover:bg-[#f6f3f2]'
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#ea580c]"></span>
                    <span>Inactive</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#737782] mt-0.5">
                  {formData.isActive !== false
                    ? '✓ Banner will appear immediately in the Student Dashboard carousel.'
                    : '○ Banner will be saved as a draft and hidden from students.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-3 border-t border-[#e2e6ec]">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 bg-[#003c84] hover:bg-[#00275a] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {editingId ? 'save' : 'publish'}
                  </span>
                  <span>
                    {isSaving
                      ? (editingId ? 'Saving…' : 'Publishing…')
                      : (editingId ? 'Save Changes' : 'Publish Banner')}
                  </span>
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-full py-2 bg-white border border-[#e2e6ec] text-[#5c6470] hover:bg-[#f6f3f2] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
            </div>

            {/* Live Student Portal Preview Card */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] p-5 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e6ec]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#00275a] text-[18px]">preview</span>
                  <span className="font-bold text-xs text-[#00275a] uppercase tracking-wider">Live Preview</span>
                </div>
                <span className="text-[10px] text-[#5c6470] bg-[#f6f3f2] px-2 py-0.5 rounded font-medium">
                  Student Feed Card
                </span>
              </div>

              {/* Exact Card Preview */}
              <div className="border border-[#e2e6ec] rounded-lg overflow-hidden relative h-36 shadow-2xs select-none bg-slate-900">
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${AdminApiService.resolveFileUrl(formData.image) || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80'}')`,
                  }}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Top Tag */}
                <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between z-10">
                  <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-sm">
                    <span className="material-symbols-outlined text-[13px] text-[#43ccd1]">
                      sparkles
                    </span>{' '}
                    {formData.tag || 'EVENT'}
                  </span>

                  {formData.isActive === false && (
                    <span className="text-[9px] font-bold text-orange-300 bg-black/60 px-1.5 py-0.2 rounded uppercase">
                      Draft Mode
                    </span>
                  )}
                </div>

                {/* Bottom Details & Action */}
                <div className="absolute bottom-0 left-0 p-3.5 w-full flex justify-between items-end">
                  <div className="min-w-0 flex-1 mr-2">
                    <h4 className="text-sm font-bold text-white leading-tight truncate">
                      {formData.title || 'Untitled Banner Headline'}
                    </h4>
                    <p className="text-[11px] text-slate-300 truncate mt-0.5">
                      {formData.deadlineText || 'Registration Open'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="bg-[#003c84] text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-sm shadow-sm shrink-0 pointer-events-none"
                  >
                    {formData.actionText || 'Register'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f5f7fa] border border-[#e2e6ec] text-[11px] text-[#5c6470] leading-relaxed">
                <span className="font-semibold text-[#00275a] block mb-0.5">Student Interaction:</span>
                Clicking this banner on the Student Portal dashboard opens the registration modal or takes the student directly to{' '}
                <code className="text-[#00275a] font-mono text-[10px]">
                  {formData.registrationUrl || '(Destination URL)'}
                </code>.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
