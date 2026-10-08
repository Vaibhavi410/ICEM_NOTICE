import type {
  Notice,
  ActionItem,
  FeaturedEvent,
  CollegeDocument,
  ScheduleItem,
} from '../types/notice';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000/api/v1';
export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:5000';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  errors?: any;
}

export interface StudentNoticeParams {
  category?: string;
  departmentKey?: string;
  targetAudience?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class StudentApiService {
  private static studentTokenKey = 'icem_student_token';
  private static studentUserKey = 'icem_student_user';

  static getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.studentTokenKey);
    } catch {
      return null;
    }
  }

  static setAuth(token: string, user?: any): void {
    try {
      localStorage.setItem(this.studentTokenKey, token);
      if (user) {
        localStorage.setItem(this.studentUserKey, JSON.stringify(user));
      }
    } catch (err) {
      console.error('Failed to store student token:', err);
    }
  }

  static clearAuth(): void {
    try {
      localStorage.removeItem(this.studentTokenKey);
      localStorage.removeItem(this.studentUserKey);
    } catch (err) {
      console.error('Failed to clear student token:', err);
    }
  }

  /**
   * Helper to resolve relative upload URLs to full URLs
   */
  static resolveFileUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${SERVER_URL}${cleanUrl}`;
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (error: any) {
      console.error(`Student API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ==================== NOTICES ====================

  static async getNotices(params: StudentNoticeParams = {}): Promise<Notice[]> {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') {
      query.append('category', params.category);
    }
    if (params.departmentKey && params.departmentKey !== 'all') {
      query.append('departmentKey', params.departmentKey);
    }
    if (params.targetAudience && params.targetAudience !== 'all') {
      query.append('targetAudience', params.targetAudience);
    }
    if (params.search) {
      query.append('search', params.search);
    }
    if (params.page) {
      query.append('page', String(params.page));
    }
    if (params.limit) {
      query.append('limit', String(params.limit));
    } else {
      query.append('limit', '100'); // fetch up to 100 for student feed
    }

    const endpoint = `/notices?${query.toString()}`;
    const res = await this.request<Notice[]>(endpoint);
    const list = res.data || [];
    return list.map((notice) => ({
      ...notice,
      attachments: notice.attachments?.map((att) => ({
        ...att,
        url: this.resolveFileUrl(att.url),
      })),
    }));
  }

  static async getNoticeById(id: string): Promise<Notice> {
    const res = await this.request<Notice>(`/notices/${id}`);
    if (!res.data) throw new Error('Notice not found');
    const notice = res.data;
    return {
      ...notice,
      attachments: notice.attachments?.map((att) => ({
        ...att,
        url: this.resolveFileUrl(att.url),
      })),
    };
  }

  static async getActionRequired(): Promise<ActionItem[]> {
    const res = await this.request<ActionItem[]>('/notices/action-required');
    return res.data || [];
  }

  static async getCalendar(month?: number, year?: number): Promise<any[]> {
    const query = new URLSearchParams();
    if (month !== undefined) query.append('month', String(month));
    if (year !== undefined) query.append('year', String(year));

    const endpoint = `/notices/calendar?${query.toString()}`;
    const res = await this.request<any[]>(endpoint);
    return res.data || [];
  }

  static async toggleAcknowledge(noticeId: string): Promise<{ acknowledged: boolean; count: number }> {
    const res = await this.request<{ acknowledged: boolean; count: number }>(
      `/notices/${noticeId}/acknowledge`,
      { method: 'POST' }
    );
    return res.data || { acknowledged: true, count: 1 };
  }

  static async toggleBookmark(noticeId: string): Promise<{ bookmarked: boolean }> {
    const res = await this.request<{ bookmarked: boolean }>(
      `/notices/${noticeId}/bookmark`,
      { method: 'POST' }
    );
    return res.data || { bookmarked: true };
  }

  // ==================== BANNERS & EVENTS ====================

  static async getBanners(): Promise<FeaturedEvent[]> {
    const res = await this.request<FeaturedEvent[]>('/banners?activeOnly=true');
    const banners = res.data || [];
    return banners.map((b) => ({
      ...b,
      image: this.resolveFileUrl(b.image),
    }));
  }

  // ==================== DOCUMENTS ====================

  static async getDocuments(category?: string, fileType?: string, search?: string): Promise<CollegeDocument[]> {
    const query = new URLSearchParams();
    if (category && category !== 'All') query.append('category', category);
    if (fileType && fileType !== 'All') query.append('fileType', fileType);
    if (search) query.append('search', search);

    const res = await this.request<CollegeDocument[]>(`/documents?${query.toString()}`);
    const docs = res.data || [];
    return docs.map((doc) => ({
      ...doc,
      downloadUrl: this.resolveFileUrl(doc.downloadUrl),
    }));
  }

  // ==================== TIMETABLE ====================

  static async getTimetable(department?: string, day?: string): Promise<ScheduleItem[]> {
    const query = new URLSearchParams();
    if (department && department !== 'all') query.append('department', department);
    if (day) query.append('day', day);

    const res = await this.request<ScheduleItem[]>(`/timetable?${query.toString()}`);
    return res.data || [];
  }

  // ==================== SUBSCRIPTIONS ====================

  static async subscribeNewsletter(payload: {
    email: string;
    department?: string;
    year?: string;
  }): Promise<{
    message: string;
    subscriptionSaved: boolean;
    emailStatus: 'sent' | 'failed' | 'not_sent_already_active';
  }> {
    const res = await this.request<{
      subscriptionSaved: boolean;
      emailStatus: 'sent' | 'failed' | 'not_sent_already_active';
    }>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error('Subscription response was incomplete.');
    }

    return {
      message: res.message || 'Subscription processed.',
      ...res.data,
    };
  }
}
