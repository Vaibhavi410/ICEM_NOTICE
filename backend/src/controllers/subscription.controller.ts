import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { ApiResponse } from '../utils/apiResponse';
import { subscriptionSchema } from '../validators';

export class SubscriptionController {
  static async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = subscriptionSchema.parse(req.body);
      const result = await SubscriptionService.subscribe(validated.email);
      return ApiResponse.success(res, result.message, {
        subscriptionSaved: result.subscriptionSaved,
        emailStatus: result.emailStatus,
      });
    } catch (error) {
      next(error);
    }
  }
}
