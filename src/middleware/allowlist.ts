import type { Request, Response, NextFunction } from 'express';
import { isPhoneAllowed, normalizePhone } from '../config/index.js';

export function allowlistMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { phone } = req.body as { phone?: string };
  
  if (!phone) {
    res.status(400).json({
      success: false,
      error: 'Phone number is required.',
    });
    return;
  }
  
  if (!isPhoneAllowed(phone)) {
    const normalized = normalizePhone(phone);
    res.status(403).json({
      success: false,
      error: `Phone number ${normalized} is not in the allowed list.`,
    });
    return;
  }
  
  next();
}
