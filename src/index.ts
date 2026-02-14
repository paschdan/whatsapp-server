import express, { type Request, type Response } from 'express';
import { config } from './config/index.js';
import { whatsappService } from './services/whatsapp.js';
import whatsappRoutes from './routes/whatsapp.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  const connected = whatsappService.isConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'healthy' : 'unhealthy',
    whatsapp: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/', whatsappRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    await whatsappService.disconnect();
    console.log('WhatsApp disconnected.');
  } catch (error) {
    console.error('Error during WhatsApp disconnect:', error);
  }
  
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main(): Promise<void> {
  try {
    console.log('Connecting to WhatsApp...');
    await whatsappService.connect();
    
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`\nWhatsApp REST API server running on 0.0.0.0:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
      console.log(`Send message: POST http://localhost:${config.port}/send`);
      console.log(`\nAllowed phones: ${config.allowedPhones.join(', ')}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
