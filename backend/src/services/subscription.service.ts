import { prisma } from '../config/prisma';
import { EmailService } from './email.service';

export type SubscriptionEmailStatus = 'sent' | 'failed' | 'not_sent_already_active';

export class SubscriptionService {
  private static async sendConfirmation(email: string): Promise<boolean> {
    try {
      return await EmailService.sendSubscriptionConfirmation(email);
    } catch {
      console.error('[SubscriptionService] Unexpected subscription confirmation email failure.');
      return false;
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

      const emailSent = await this.sendConfirmation(normalizedEmail);

      return {
        message: emailSent
          ? "Successfully subscribed! You'll receive official college circulars."
          : 'Subscription saved, but the confirmation email could not be sent.',
        subscriptionSaved: true,
        emailStatus: emailSent ? 'sent' : 'failed',
      };
    }

    // New subscription → save to DB → attempt confirmation email
    await prisma.newsletterSubscription.create({
      data: { email: normalizedEmail },
    });

    const emailSent = await this.sendConfirmation(normalizedEmail);

    return {
      message: emailSent
        ? "Successfully subscribed! You'll receive official college circulars."
        : 'Subscription saved, but the confirmation email could not be sent.',
      subscriptionSaved: true,
      emailStatus: emailSent ? 'sent' : 'failed',
    };
  }
}
