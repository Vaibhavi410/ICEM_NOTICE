import { EmailService } from './email.service';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { supabase } from '../config/supabase';
import { env } from '../config/env';

/**
 * Checks if a fileUrl represents a Supabase Storage path (as opposed to legacy local /uploads/ or external HTTP)
 */
export function isSupabaseStoragePath(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl) return false;
  if (pathOrUrl.startsWith('/uploads/')) return false;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return false;
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) return false;
  return true;
}

/**
 * Normalizes input from frontend into a clean storage path (e.g. notices/123-file.pdf)
 * Strips access URL query parameters if the frontend passed a download endpoint URL.
 */
export function normalizeStoragePath(rawPathOrUrl?: string | null): string {
  if (!rawPathOrUrl) return '';
  const trimmed = rawPathOrUrl.trim();

  // If passed as download/access URL (e.g. /api/v1/upload/attachments/access?path=notices%2F...)
  if (trimmed.includes('access?path=') || trimmed.includes('download?path=')) {
    try {
      const urlObj = new URL(trimmed, 'http://localhost');
      const pathParam = urlObj.searchParams.get('path');
      if (pathParam) {
        return decodeURIComponent(pathParam);
      }
    } catch {
      const match = trimmed.match(/[?&]path=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  }

  return trimmed;
}

export interface NoticeQueryParams {
  search?: string;
  category?: string;
  department?: string;
  departmentKey?: string;
  targetAudience?: string;
  status?: string;
  isImportant?: boolean | string;
  isUrgent?: boolean | string;
  actionRequired?: boolean | string;
  date?: string;
  month?: number | string;
  year?: number | string;
  page?: number | string;
  limit?: number | string;
}

export class NoticeService {
  private emailService = new EmailService();

  /**
   * Normalizes notice object to satisfy both Admin Portal and Student Portal interfaces
   */
  static normalizeNotice(notice: any, userId?: string) {
    const isBookmarked = userId
      ? notice.bookmarks && notice.bookmarks.length > 0
      : false;
    const isAcknowledged = userId
      ? notice.acknowledgements && notice.acknowledgements.length > 0
      : false;

    const formattedAttachments = (notice.attachments || []).map((att: any) => {
      let downloadUrl = att.fileUrl;
      // If it's a Supabase storage path (not an absolute URL and not a legacy local /uploads/ URL)
      if (isSupabaseStoragePath(att.fileUrl)) {
        downloadUrl = `/api/v1/upload/attachments/access?path=${encodeURIComponent(att.fileUrl)}`;
      }

      return {
        id: att.id,
        name: att.name,
        originalName: att.originalName,
        size: att.fileSize || att.size,
        type: att.fileType ? att.fileType.toLowerCase() : 'pdf',
        url: downloadUrl,
        fileUrl: downloadUrl,
        storagePath: att.fileUrl,
      };
    });

    return {
      id: notice.id,
      refNo: notice.refNo,
      title: notice.title,
      category: notice.category,
      status: notice.status === 'PUBLISHED' ? 'Published' : 'Archived',
      summary: notice.summary,
      content: notice.content,
      fullBody: notice.fullBody,
      issuedBy: notice.issuedBy,
      department: notice.department,
      departmentKey: notice.departmentKey,
      targetAudience: notice.targetAudience,
      academicYear: notice.academicYear || 'AY 2026-27',
      date: notice.date,
      time: notice.time || '',
      // Dual property naming for 100% frontend backward compatibility
      isImportant: Boolean(notice.isImportant),
      important: Boolean(notice.isImportant),
      isUrgent: Boolean(notice.isUrgent),
      urgent: Boolean(notice.isUrgent),
      actionRequired: Boolean(notice.actionRequired),
      actionDeadline: notice.actionDeadline || undefined,
      actionDescription: notice.actionDescription || undefined,
      attachments: formattedAttachments,
      bookmarked: isBookmarked,
      acknowledged: isAcknowledged,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
    };
  }

  static async getNotices(params: NoticeQueryParams, userId?: string, isAdmin: boolean = false) {
    const page = Math.max(1, parseInt(String(params.page || 1), 10));
    const limit = Math.max(1, parseInt(String(params.limit || 10), 10));
    const skip = (page - 1) * limit;

    const where: Prisma.NoticeWhereInput = {};

    // For public / non-admin users, restrict to published notices only
    if (!isAdmin) {
      where.status = 'PUBLISHED';
    } else if (params.status) {
      const st = params.status.toLowerCase();
      if (st === 'published') where.status = 'PUBLISHED';
      else if (st === 'archived') where.status = 'ARCHIVED';
    }

    // Category filter
    if (params.category && params.category !== 'all') {
      const cat = params.category.toLowerCase().trim();
      if (cat === 'exam' || cat === 'examination') {
        where.category = { contains: 'Exam', mode: 'insensitive' };
      } else if (cat === 'placement') {
        where.category = { contains: 'Placement', mode: 'insensitive' };
      } else if (cat === 'events' || cat === 'cultural') {
        where.category = { contains: 'Event', mode: 'insensitive' };
      } else if (cat === 'general' || cat === 'administration' || cat === 'admin') {
        where.OR = [
          { category: { contains: 'General', mode: 'insensitive' } },
          { category: { contains: 'Admin', mode: 'insensitive' } },
          { category: { contains: 'Academic', mode: 'insensitive' } },
        ];
      } else {
        where.category = { equals: params.category, mode: 'insensitive' };
      }
    }

    // Department / departmentKey filter
    if (params.departmentKey && params.departmentKey !== 'all') {
      where.departmentKey = { equals: params.departmentKey, mode: 'insensitive' };
    } else if (params.department && params.department !== 'all') {
      where.department = { contains: params.department, mode: 'insensitive' };
    }

    if (params.targetAudience && params.targetAudience !== 'all') {
      const academicTargets = ['SY-BTECH', 'TY-BTECH', 'FINAL YEAR'];
      const isBroadAcademicTarget = academicTargets.includes(params.targetAudience);
      const isLegacyBroadDepartmentTarget =
        params.targetAudience.startsWith('Department|') && !params.targetAudience.slice('Department|'.length).includes('|');
      if (isBroadAcademicTarget || isLegacyBroadDepartmentTarget) {
        const targetPrefixes = isLegacyBroadDepartmentTarget
          ? [params.targetAudience]
          : [params.targetAudience, `Department|${params.targetAudience}`];
        if (params.targetAudience === 'FINAL YEAR' || params.targetAudience === 'Department|FINAL YEAR') {
          targetPrefixes.push('FINAL YEAR ENGG', 'Department|FINAL YEAR ENGG');
        } else if (params.targetAudience === 'Department|FINAL YEAR ENGG') {
          targetPrefixes.push('FINAL YEAR', 'Department|FINAL YEAR');
        }
        const targetAudienceConditions: Prisma.NoticeWhereInput[] = [];
        targetPrefixes.forEach((prefix) => {
          targetAudienceConditions.push(
            { targetAudience: { equals: prefix, mode: 'insensitive' } },
            { targetAudience: { startsWith: `${prefix}|`, mode: 'insensitive' } }
          );
        });
        if (where.OR) {
          const existingOr = where.OR;
          const existingAnd = where.AND
            ? Array.isArray(where.AND)
              ? where.AND
              : [where.AND]
            : [];
          where.AND = [...existingAnd, { OR: existingOr }, { OR: targetAudienceConditions }];
          delete where.OR;
        } else {
          where.OR = targetAudienceConditions;
        }
      } else {
        where.targetAudience = { equals: params.targetAudience, mode: 'insensitive' };
      }
    }

    // Flags
    if (params.isImportant !== undefined) {
      where.isImportant = String(params.isImportant) === 'true';
    }
    if (params.isUrgent !== undefined) {
      where.isUrgent = String(params.isUrgent) === 'true';
    }
    if (params.actionRequired !== undefined) {
      where.actionRequired = String(params.actionRequired) === 'true';
    }

    // Date search
    if (params.date) {
      where.date = { contains: params.date, mode: 'insensitive' };
    }

    // Search query
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
        { issuedBy: { contains: q, mode: 'insensitive' } },
        { refNo: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, notices] = await Promise.all([
      prisma.notice.count({ where }),
      prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attachments: true,
          bookmarks: userId ? { where: { userId } } : false,
          acknowledgements: userId ? { where: { userId } } : false,
        },
      }),
    ]);

    const normalized = notices.map((n) => this.normalizeNotice(n, userId));

    return {
      notices: normalized,
      total,
      page,
      limit,
    };
  }

  static async getNoticeById(id: string, userId?: string, isAdmin: boolean = false) {
    if (!id || typeof id !== 'string') {
      return null;
    }

    try {
      const notice = await prisma.notice.findUnique({
        where: { id },
        include: {
          attachments: true,
          bookmarks: userId ? { where: { userId } } : false,
          acknowledgements: userId ? { where: { userId } } : false,
        },
      });

      if (!notice) {
        return null;
      }

      if (!isAdmin && notice.status !== 'PUBLISHED') {
        return null;
      }

      // Fetch related notices (up to 3 from same category or department, excluding current)
      const related = await prisma.notice.findMany({
        where: {
          id: { not: id },
          status: 'PUBLISHED',
          OR: [{ category: notice.category }, { department: notice.department }],
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: { attachments: true },
      });

      return {
        notice: this.normalizeNotice(notice, userId),
        relatedNotices: related.map((r) => this.normalizeNotice(r, userId)),
      };
    } catch {
      return null;
    }
  }

  static async createNotice(data: any, authorId?: string) {
    const now = new Date();
    const displayDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const displayTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const refNo =
      data.refNo ||
      `REF-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const status = (data.status || 'PUBLISHED').toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'PUBLISHED';

    const isImportant = data.isImportant !== undefined ? Boolean(data.isImportant) : Boolean(data.important);
    const isUrgent = data.isUrgent !== undefined ? Boolean(data.isUrgent) : Boolean(data.urgent);

    const finalSummary =
      (data.summary && data.summary.trim()) ||
      (data.content && data.content.replace(/<[^>]+>/g, ' ').trim()) ||
      data.title.trim();
    const finalContent = (data.content && data.content.trim()) || finalSummary;

    // Extract new Supabase storage paths for rollback in case of partial database failure
    const newStoragePaths = (data.attachments || [])
      .map((att: any) => normalizeStoragePath(att.storagePath || att.fileUrl || att.url || ''))
      .filter((p: string) => isSupabaseStoragePath(p));

    try {
      const notice = await prisma.notice.create({
        data: {
          refNo,
          title: data.title.trim(),
          category: data.category,
          status,
          summary: finalSummary,
          content: finalContent,
          fullBody: data.fullBody || null,
          issuedBy: data.issuedBy,
          department: data.department,
          departmentKey: data.departmentKey || 'admin',
          targetAudience: data.targetAudience || 'FY-BTECH',
          academicYear: data.academicYear || 'AY 2026-27',
          date: data.date || displayDate,
          time: data.time || displayTime,
          isImportant,
          isUrgent,
          actionRequired: Boolean(data.actionRequired),
          actionDeadline: data.actionDeadline || null,
          actionDescription: data.actionDescription || null,
          createdById: authorId || null,
          attachments: {
            create: (data.attachments || []).map((att: any) => ({
              name: att.name,
              originalName: att.originalName || att.name,
              fileUrl: normalizeStoragePath(att.storagePath || att.fileUrl || att.url || ''),
              fileType: (att.type || 'PDF').toUpperCase(),
              fileSize: att.size || att.fileSize || '1.0 MB',
              mimeType: att.mimeType || null,
            })),
          },
        },
        include: {
          attachments: true,
        },
      });

      try {
        const subscribers = await prisma.newsletterSubscription.findMany({
          where: { isActive: true },
        });

        const emailResults = await Promise.allSettled(
          subscribers.map((subscriber) =>
            EmailService.sendNewNoticeNotification(subscriber.email, {
              id: notice.id,
              title: notice.title,
              category: notice.category,
              issuedBy: notice.issuedBy,
              summary: notice.summary,
              refNo: notice.refNo,
            })
          )
        );

        emailResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(
              `[NoticeService] Failed to send new-notice email to ${subscribers[index].email}:`,
              result.reason
            );
          } else if (!result.value.success) {
            console.error(
              `[NoticeService] New-notice email failed for ${subscribers[index].email}: ${result.value.error || 'Unknown email delivery error.'}`
            );
          } else {
            console.info(
              `[NoticeService] New-notice email sent successfully. Resend message ID: ${result.value.id ?? 'unknown'}`
            );
          }
        });
      } catch (emailError: any) {
        console.error(
          '[NoticeService] Failed to notify newsletter subscribers about the new notice:',
          emailError?.message || emailError
        );
      }

      return this.normalizeNotice(notice);
    } catch (error: any) {
      // Partial failure safety: Clean up newly uploaded Supabase objects if database save failed
      if (newStoragePaths.length > 0) {
        try {
          console.warn(`[NoticeService] DB insertion failed. Cleaning up ${newStoragePaths.length} orphaned Supabase storage objects.`);
          await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove(newStoragePaths);
        } catch (cleanupErr: any) {
          console.error('[NoticeService] Failed to clean up Supabase storage objects after DB error:', cleanupErr.message || cleanupErr);
        }
      }
      throw error;
    }
  }

  static async updateNotice(id: string, data: any) {
    const existing = await prisma.notice.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!existing) {
      throw new Error('Notice not found');
    }

    const isImportant =
      data.isImportant !== undefined
        ? Boolean(data.isImportant)
        : data.important !== undefined
        ? Boolean(data.important)
        : existing.isImportant;

    const isUrgent =
      data.isUrgent !== undefined
        ? Boolean(data.isUrgent)
        : data.urgent !== undefined
        ? Boolean(data.urgent)
        : existing.isUrgent;

    const status = data.status
      ? data.status.toUpperCase() === 'ARCHIVED'
        ? 'ARCHIVED'
        : 'PUBLISHED'
      : existing.status;

    // If attachments are passed, recreate them and clean up replaced storage objects
    let attachmentsUpdate: any = undefined;
    if (data.attachments && Array.isArray(data.attachments)) {
      const newPaths = new Set(
        data.attachments.map((att: any) =>
          normalizeStoragePath(att.storagePath || att.fileUrl || att.url || '')
        )
      );

      // Identify old storage paths that are NOT in the new attachments list
      const pathsToRemove = (existing.attachments || [])
        .map((att) => att.fileUrl)
        .filter((p: string) => isSupabaseStoragePath(p) && !newPaths.has(p));

      if (pathsToRemove.length > 0) {
        try {
          const { error: removeError } = await supabase.storage
            .from(env.SUPABASE_STORAGE_BUCKET)
            .remove(pathsToRemove);
          if (removeError) {
            console.error('[Supabase Storage] Failed to remove replaced attachments:', removeError.message);
          }
        } catch (err: any) {
          console.error('[Supabase Storage] Error removing replaced attachments from storage:', err.message || err);
        }
      }

      attachmentsUpdate = {
        deleteMany: {},
        create: data.attachments.map((att: any) => ({
          name: att.name,
          originalName: att.originalName || att.name,
          fileUrl: normalizeStoragePath(att.storagePath || att.fileUrl || att.url || ''),
          fileType: (att.type || 'PDF').toUpperCase(),
          fileSize: att.size || att.fileSize || '1.0 MB',
          mimeType: att.mimeType || null,
        })),
      };
    }

    const updatedSummary =
      data.summary !== undefined
        ? (data.summary.trim() || (data.content && data.content.replace(/<[^>]+>/g, ' ').trim()) || existing.summary)
        : existing.summary;
    const updatedContent =
      data.content !== undefined
        ? (data.content.trim() || updatedSummary)
        : existing.content;

    const updated = await prisma.notice.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : existing.title,
        category: data.category !== undefined ? data.category : existing.category,
        status,
        summary: updatedSummary,
        content: updatedContent,
        fullBody: data.fullBody !== undefined ? data.fullBody : existing.fullBody,
        issuedBy: data.issuedBy !== undefined ? data.issuedBy : existing.issuedBy,
        department: data.department !== undefined ? data.department : existing.department,
        departmentKey: data.departmentKey !== undefined ? data.departmentKey : existing.departmentKey,
        targetAudience: data.targetAudience !== undefined ? data.targetAudience : existing.targetAudience,
        academicYear: data.academicYear !== undefined ? data.academicYear : existing.academicYear,
        date: data.date !== undefined ? data.date : existing.date,
        time: data.time !== undefined ? data.time : existing.time,
        isImportant,
        isUrgent,
        actionRequired: data.actionRequired !== undefined ? Boolean(data.actionRequired) : existing.actionRequired,
        actionDeadline: data.actionDeadline !== undefined ? data.actionDeadline : existing.actionDeadline,
        actionDescription: data.actionDescription !== undefined ? data.actionDescription : existing.actionDescription,
        attachments: attachmentsUpdate,
      },
      include: {
        attachments: true,
      },
    });

    return this.normalizeNotice(updated);
  }

  static async toggleStatus(id: string, statusOverride?: string) {
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      throw new Error('Notice not found');
    }

    const nextStatus = statusOverride
      ? statusOverride.toUpperCase() === 'ARCHIVED'
        ? 'ARCHIVED'
        : 'PUBLISHED'
      : notice.status === 'PUBLISHED'
      ? 'ARCHIVED'
      : 'PUBLISHED';

    const updated = await prisma.notice.update({
      where: { id },
      data: { status: nextStatus },
      include: { attachments: true },
    });

    return this.normalizeNotice(updated);
  }

  static async deleteNotice(id: string) {
    const existing = await prisma.notice.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!existing) {
      throw new Error('Notice not found');
    }

    // Identify Supabase storage paths associated with this notice
    const storagePaths = (existing.attachments || [])
      .map((att) => att.fileUrl)
      .filter((fileUrl: string) => isSupabaseStoragePath(fileUrl));

    if (storagePaths.length > 0) {
      try {
        const { error: removeError } = await supabase.storage
          .from(env.SUPABASE_STORAGE_BUCKET)
          .remove(storagePaths);
        if (removeError) {
          console.error('[Supabase Storage] Failed to delete objects during notice deletion:', removeError.message);
        }
      } catch (err: any) {
        console.error('[Supabase Storage] Error deleting storage files on notice delete:', err.message || err);
      }
    }

    await prisma.notice.delete({ where: { id } });
    return { id, message: 'Notice deleted successfully' };
  }

  static async getStats() {
    const [totalNotices, publishedNotices, archivedNotices, actionRequiredCount] = await Promise.all([
      prisma.notice.count(),
      prisma.notice.count({ where: { status: 'PUBLISHED' } }),
      prisma.notice.count({ where: { status: 'ARCHIVED' } }),
      prisma.notice.count({ where: { status: 'PUBLISHED', actionRequired: true } }),
    ]);

    return {
      totalNotices,
      publishedNotices,
      archivedNotices,
      actionRequiredCount,
    };
  }

  static async getActionRequiredNotices() {
    const notices = await prisma.notice.findMany({
      where: {
        status: 'PUBLISHED',
        actionRequired: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return notices.map((n) => ({
      id: `action-${n.id}`,
      noticeId: n.id,
      title: n.title,
      dateLabel: n.actionDeadline || n.date,
      type: n.isUrgent ? 'error' : n.isImportant ? 'warning' : 'info',
    }));
  }

  static async getCalendarNotices() {
    const notices = await prisma.notice.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        date: true,
        time: true,
        department: true,
        isImportant: true,
        isUrgent: true,
      },
    });

    return notices.map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      date: n.date,
      time: n.time,
      department: n.department,
      important: n.isImportant,
      urgent: n.isUrgent,
    }));
  }
}
