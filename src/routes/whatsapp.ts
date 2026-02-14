import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { whatsappService } from '../services/whatsapp.js';
import { normalizePhoneToJid } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { allowlistMiddleware } from '../middleware/allowlist.js';

const router = Router();

const sendMessageSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  message: z.string().min(1, 'Message is required'),
});

router.post(
  '/send',
  authMiddleware,
  allowlistMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = sendMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const { phone, message } = parseResult.data;

      if (!whatsappService.isConnected()) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp is not connected. Please scan QR code first.',
        });
        return;
      }

      const jid = normalizePhoneToJid(phone);
      await whatsappService.sendMessage(jid, message);

      res.status(200).json({
        success: true,
        message: 'Message sent successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        details: errorMessage,
      });
    }
  }
);

export default router;
