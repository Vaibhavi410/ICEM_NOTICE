import { Resend } from 'resend';
import { env } from '../config/env';

export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export class EmailService {
  private static resend: Resend | null = null;

  private static getClient(): Resend | null {
    if (!env.RESEND_API_KEY) {
      return null;
    }

    if (!this.resend) {
      this.resend = new Resend(env.RESEND_API_KEY);
    }

    return this.resend;
  }

  private static async deliverEmail(
    mailOptions: { to: string; subject: string; text: string; html: string },
    emailType: string
  ): Promise<EmailSendResult> {
    const client = this.getClient();
    if (!client) {
      const error = 'Resend API key is not configured.';
      console.error(`[EmailService] ${error} Unable to send ${emailType}.`);
      return { success: false, error };
    }

    if (!env.EMAIL_FROM) {
      const error = 'EMAIL_FROM is not configured.';
      console.error(`[EmailService] ${error} Unable to send ${emailType}.`);
      return { success: false, error };
    }

    try {
      const { data, error } = await client.emails.send({
        ...mailOptions,
        from: env.EMAIL_FROM,
      });

      if (error) {
        const safeMessage = error.message.replace(env.RESEND_API_KEY || '', '[redacted]');
        console.error(`[EmailService] Resend email failed: ${safeMessage}`);
        return { success: false, error: safeMessage };
      }

      const messageId = data?.id;
      console.info(
        `[EmailService] Resend email sent successfully. Resend message ID: ${messageId ?? 'unknown'}`
      );
      return { success: true, id: messageId ?? undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected email delivery failure.';
      const safeMessage = message.replace(env.RESEND_API_KEY || '', '[redacted]');
      console.error(`[EmailService] Resend email failed: ${safeMessage}`);
      return { success: false, error: safeMessage };
    }
  }

  /**
   * Sends a professional subscription confirmation email to the subscriber.
   * Email failures do not affect the saved subscription.
   */
  static async sendSubscriptionConfirmation(toEmail: string): Promise<EmailSendResult> {
    const portalUrl = env.CLIENT_URLS[1] || env.CLIENT_URLS[0] || 'http://localhost:5174';

    const mailOptions = {
      to: toEmail,
      subject: 'ICEM Smart Notice Portal — Subscription Confirmed',
      text: `Indira College of Engineering and Management (ICEM)
Smart Notice Portal — Subscription Confirmed

Hello,

This email confirms that your address (${toEmail}) has been successfully subscribed to the ICEM Smart Notice Portal.

You will now receive priority notifications and official college announcements directly in your inbox, including:
• Official Academic Circulars & Semester Schedules
• Examination Schedules & Hall Ticket Notices
• Placement Drives, Internship Offers & Career Opportunities
• Campus Events, Technical Workshops & Cultural Fests
• Administrative & Holiday Updates

You can access and search all current notices at any time by visiting:
${portalUrl}

If you did not request this subscription or believe this is in error, please contact the student helpdesk at support@indiraicem.ac.in.

Best regards,
Office of Academic Affairs & Student Support
Indira College of Engineering and Management (ICEM)
Pune, Maharashtra, India
`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ICEM Smart Notice Portal — Subscription Confirmed</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 16px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #00275a 0%, #003c84 100%);
      padding: 32px 28px;
      text-align: center;
      color: #ffffff;
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.15);
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 12px;
      color: #e0e7ff;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 0;
      font-size: 13px;
      color: #cbd5e1;
    }
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24);
    }
    .content {
      padding: 32px 28px;
    }
    .status-card {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
    }
    .status-title {
      font-size: 14px;
      font-weight: 700;
      color: #166534;
      margin: 0 0 4px 0;
    }
    .status-text {
      font-size: 13px;
      color: #15803d;
      margin: 0;
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .feature-list {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .feature-list h3 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #00275a;
    }
    .feature-item {
      display: flex;
      margin-bottom: 10px;
      font-size: 13px;
      color: #475569;
      line-height: 1.4;
    }
    .feature-item:last-child {
      margin-bottom: 0;
    }
    .feature-bullet {
      color: #003c84;
      font-weight: bold;
      margin-right: 8px;
    }
    .action-container {
      text-align: center;
      margin: 32px 0 20px 0;
    }
    .btn {
      display: inline-block;
      background-color: #003c84;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 6px;
      letter-spacing: 0.02em;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 28px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
    .footer strong {
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-badge">Official Communication</div>
        <h1>Indira College of Engineering & Management</h1>
        <p>ICEM Smart Notice & Circular Distribution Portal</p>
      </div>
      <div class="accent-bar"></div>
      <div class="content">
        <div class="status-card">
          <div>
            <div class="status-title">✓ Subscription Confirmed</div>
            <div class="status-text">Your email <strong>${toEmail}</strong> has been enrolled for official notice bulletins.</div>
          </div>
        </div>

        <p class="message">
          Hello,<br><br>
          You have successfully subscribed to circular updates from the <strong>ICEM Smart Notice Portal</strong>. Whenever new critical notices, schedules, or announcements are authorized and published by department heads or college administration, you will receive timely notifications directly to this email address.
        </p>

        <div class="feature-list">
          <h3>Notices You Will Receive</h3>
          <div class="feature-item">
            <span class="feature-bullet">▸</span>
            <span><strong>Academic & Examination:</strong> Exam timetables, hall ticket circulars, and university guidelines.</span>
          </div>
          <div class="feature-item">
            <span class="feature-bullet">▸</span>
            <span><strong>Training & Placements:</strong> Campus placement drives, interview schedules, and internships.</span>
          </div>
          <div class="feature-item">
            <span class="feature-bullet">▸</span>
            <span><strong>Campus & Events:</strong> Technical fests, sports meets, guest lectures, and institutional workshops.</span>
          </div>
          <div class="feature-item">
            <span class="feature-bullet">▸</span>
            <span><strong>Administrative:</strong> Fee payment deadlines, holiday notices, and campus advisories.</span>
          </div>
        </div>

        <div class="action-container">
          <a href="${portalUrl}" class="btn" target="_blank" rel="noopener noreferrer">Access Smart Notice Portal</a>
        </div>
      </div>

      <div class="footer">
        <p><strong>Indira College of Engineering and Management (ICEM)</strong><br>
        Parandwadi, Off Pune-Mumbai Expressway, Pune - 410506<br>
        Approved by AICTE | Affiliated to Savitribai Phule Pune University (SPPU)</p>
        <p style="margin-top: 12px; color: #94a3b8;">
          This is an automated confirmation from the ICEM Smart Notice Portal.<br>
          For student support or queries, contact <a href="mailto:support@indiraicem.ac.in" style="color: #003c84;">support@indiraicem.ac.in</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
    };

    return this.deliverEmail(mailOptions, 'subscription confirmation email');
  }

  static async sendNewNoticeNotification(
    toEmail: string,
    notice: {
      title: string;
      category?: string;
      issuedBy?: string;
      summary?: string;
      id: string;
      refNo?: string;
    }
  ): Promise<EmailSendResult> {
    const portalUrl =
      env.CLIENT_URLS[0] || 'http://localhost:5173';

    const noticeUrl = `${portalUrl}/#/notice/${notice.id}`;

    const mailOptions = {
      to: toEmail,
      subject: `New ICEM Notice: ${notice.title}`,

      text: `ICEM Smart Notice Portal

A new notice has been published.

Title: ${notice.title}
Category: ${notice.category || 'General'}
Issued By: ${notice.issuedBy || 'ICEM Administration'}
${notice.refNo ? `Reference No: ${notice.refNo}` : ''}

${notice.summary || ''}

View the notice:
${noticeUrl}

You are receiving this email because you subscribed to ICEM Notice alerts.
`,

      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New ICEM Notice</title>
</head>

<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">

  <div style="padding:32px 16px;">

    <div style="
      max-width:600px;
      margin:0 auto;
      background:#ffffff;
      border:1px solid #e2e8f0;
      border-radius:8px;
      overflow:hidden;
    ">

      <div style="
        background:#003c84;
        padding:28px;
        text-align:center;
        color:white;
      ">
        <div style="
          font-size:11px;
          letter-spacing:1.5px;
          text-transform:uppercase;
          font-weight:bold;
          margin-bottom:10px;
        ">
          Official Communication
        </div>

        <h1 style="margin:0;font-size:22px;">
          New Notice Published
        </h1>

        <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">
          ICEM Smart Notice Portal
        </p>
      </div>

      <div style="height:4px;background:#f59e0b;"></div>

      <div style="padding:28px;">

        <h2 style="
          margin:0 0 16px;
          color:#00275a;
          font-size:20px;
        ">
          ${notice.title}
        </h2>

        <div style="
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:6px;
          padding:16px;
          margin-bottom:20px;
        ">

          <p style="margin:0 0 8px;font-size:13px;">
            <strong>Category:</strong>
            ${notice.category || 'General'}
          </p>

          <p style="margin:0 0 8px;font-size:13px;">
            <strong>Issued By:</strong>
            ${notice.issuedBy || 'ICEM Administration'}
          </p>

          ${
            notice.refNo
              ? `
          <p style="margin:0;font-size:13px;">
            <strong>Reference No:</strong>
            ${notice.refNo}
          </p>
          `
              : ''
          }

        </div>

        ${
          notice.summary
            ? `
        <p style="
          font-size:14px;
          line-height:1.6;
          color:#475569;
        ">
          ${notice.summary}
        </p>
        `
            : ''
        }

        <div style="text-align:center;margin:30px 0 20px;">

          <a
            href="${noticeUrl}"
            style="
              display:inline-block;
              background:#003c84;
              color:#ffffff;
              text-decoration:none;
              font-size:14px;
              font-weight:bold;
              padding:12px 28px;
              border-radius:6px;
            "
          >
            View Notice
          </a>

        </div>

      </div>

      <div style="
        background:#f8fafc;
        border-top:1px solid #e2e8f0;
        padding:20px 28px;
        text-align:center;
        font-size:11px;
        color:#64748b;
        line-height:1.5;
      ">

        <strong>Indira College of Engineering and Management (ICEM)</strong>
        <br>
        ICEM Smart Notice & Circular Distribution Portal

        <p style="margin:12px 0 0;">
          You are receiving this email because you subscribed
          to official ICEM notice alerts.
        </p>

      </div>

    </div>

  </div>

</body>
</html>
`,
    };

    return this.deliverEmail(mailOptions, 'new-notice notification email');
  }
}
