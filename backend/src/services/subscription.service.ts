import { prisma } from '../config/prisma';
import { EmailService, EmailSendResult } from './email.service';

export type SubscriptionEmailStatus = 'sent' | 'failed' | 'not_sent_already_active';

export class SubscriptionService {
  private static async sendConfirmation(email: string): Promise<EmailSendResult> {
    console.info('[SubscriptionService] Attempting confirmation email');
    try {
      const result = await EmailService.sendSubscriptionConfirmation(email);
      if (!result.success) {
        console.error(
          `[SubscriptionService] Resend email failed: ${result.error || 'Unknown email delivery error.'}`
        );
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected email delivery failure.';
      console.error(`[SubscriptionService] Unexpected subscription confirmation email failure: ${message}`);
      return { success: false, error: message };
    }
  }

  static async subscribe(email: string): Promise<{
    message: string;
    subscriptionSaved: true;
    emailStatus: SubscriptionEmailStatus;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (existing.isActive) {
        // Already active subscription → do not send another email
        return {
          message: "You're already subscribed to ICEM Notice alerts.",
          subscriptionSaved: true,
          emailStatus: 'not_sent_already_active',
        };
      }

      // Reactivated subscription → update DB → attempt confirmation email
      await prisma.newsletterSubscription.update({
        where: { id: existing.id },
        data: { isActive: true },
      });

      const emailResult = await this.sendConfirmation(normalizedEmail);

      return {
        message: emailResult.success
          ? "Successfully subscribed! You'll receive official college circulars."
          : 'Subscription saved, but the confirmation email could not be sent.',
        subscriptionSaved: true,
        emailStatus: emailResult.success ? 'sent' : 'failed',
      };
    }

    // New subscription → save to DB → attempt confirmation email
    await prisma.newsletterSubscription.create({
      data: { email: normalizedEmail },
    });

    const emailResult = await this.sendConfirmation(normalizedEmail);

    return {
      message: emailResult.success
        ? "Successfully subscribed! You'll receive official college circulars."
        : 'Subscription saved, but the confirmation email could not be sent.',
      subscriptionSaved: true,
      emailStatus: emailResult.success ? 'sent' : 'failed',
    };
  }
}
