import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const apiKeyQuery = req.query.apikey as string | undefined;
  
  const providedKey = apiKeyHeader || apiKeyQuery;
  
  if (!providedKey) {
    res.status(401).json({
      success: false,
      error: 'API key required. Provide via X-API-Key header or apikey query parameter.',
    });
    return;
  }
  
  if (providedKey !== config.apiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key.',
    });
    return;
  }
  
  next();
}
