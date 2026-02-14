import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, normalizePhoneToJid } from '../config/index.js';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const QR_SCAN_TIMEOUT_MS = 120000;
const RECONNECT_DELAY_MS = 3000;

export class WhatsAppService {
  private sock: WASocket | null = null;
  private isConnecting = false;
  private logger: pino.Logger;
  // NEW: Track connection resolver to handle reconnects properly
  private connectionResolver: ((value: void) => void) | null = null;
  private connectionRejecter: ((reason: Error) => void) | null = null;

  constructor() {
    this.logger = pino({
      level: config.logLevel,
    });
  }

  async connect(): Promise<void> {
    // If already connecting, wait for that connection
    if (this.isConnecting) {
      return new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            if (this.sock) {
              resolve();
            } else {
              reject(new Error('Connection failed'));
            }
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    try {
      await this.initConnection();
    } finally {
      this.isConnecting = false;
    }
  }

  private async initConnection(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.logger.info({ version }, 'Connecting to WhatsApp...');

    const baileysLogger = this.logger.child({ module: 'baileys' }) as any;
    
    // Clean up old socket if exists
    if (this.sock) {
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.ev.removeAllListeners('creds.update');
      this.sock = null;
    }

    this.sock = makeWASocket({
      version,
      logger: baileysLogger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    // FIX: Create connection promise BEFORE registering event handlers
    const connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionResolver = resolve;
      this.connectionRejecter = reject;

      const timeout = setTimeout(() => {
        this.connectionRejecter?.(new Error('Connection timeout - please scan QR code'));
        this.connectionResolver = null;
        this.connectionRejecter = null;
      }, QR_SCAN_TIMEOUT_MS);

      // Clear timeout if resolved/rejected
      const originalResolver = this.connectionResolver;
      const originalRejecter = this.connectionRejecter;
      
      this.connectionResolver = (value) => {
        clearTimeout(timeout);
        originalResolver(value);
      };
      
      this.connectionRejecter = (reason) => {
        clearTimeout(timeout);
        originalRejecter(reason);
      };
    });

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Scan this QR code with WhatsApp (Linked Devices):\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.logger.warn(
          { statusCode, shouldReconnect },
          'Connection closed'
        );

        if (shouldReconnect) {
          this.logger.info('Attempting to reconnect...');
          
          // FIX: Don't call this.connect() recursively - call initConnection directly
          await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
          
          // Mark as not connecting so reconnection can proceed
          this.isConnecting = false;
          
          this.connect().catch((err) => {
            this.logger.error({ err }, 'Reconnection failed');
          });
        } else {
          this.logger.error(
            'Logged out from WhatsApp. Please delete auth_info folder and restart to re-authenticate.'
          );
          
          // Reject the connection promise if still pending
          if (this.connectionRejecter) {
            this.connectionRejecter(new Error('Logged out'));
            this.connectionResolver = null;
            this.connectionRejecter = null;
          }
        }
      } else if (connection === 'open') {
        this.logger.info('WhatsApp connection established successfully!');
        
        // FIX: Resolve the connection promise
        if (this.connectionResolver) {
          this.connectionResolver();
          this.connectionResolver = null;
          this.connectionRejecter = null;
        }
      }
    });

    await connectionPromise;
  }

  async sendMessage(phone: string, text: string): Promise<SendMessageResult> {
    if (!this.sock) {
      return {
        success: false,
        error: 'WhatsApp not connected',
      };
    }

    try {
      const jid = normalizePhoneToJid(phone);
      this.logger.info({ jid, textLength: text.length }, 'Sending message');

      const result = await this.sock.sendMessage(jid, { text });

      this.logger.info({ messageId: result?.key?.id }, 'Message sent successfully');

      return {
        success: true,
        messageId: result?.key?.id ?? undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: errorMessage, phone }, 'Failed to send message');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  isConnected(): boolean {
    return this.sock !== null;
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      this.logger.info('Disconnecting from WhatsApp...');
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.ev.removeAllListeners('creds.update');
      this.sock.end(undefined);
      this.sock = null;
    }
  }
}

export const whatsappService = new WhatsAppService();
