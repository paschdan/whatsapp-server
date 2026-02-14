# WhatsApp REST API Server

A REST API server for sending WhatsApp messages via the Baileys library. Designed for Home Assistant integration.

## Features

- REST API endpoint for sending WhatsApp messages
- API key authentication
- Phone number allowlist (only registered numbers can receive messages)
- Session persistence (no need to re-scan QR code after restart)
- Docker support

## Setup

### Prerequisites

- Node.js 20+
- A phone with WhatsApp installed

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
API_KEY=your-secret-api-key-here
ALLOWED_PHONES=+491234567890,+491111111111
AUTH_DIR=./auth_info
LOG_LEVEL=info
```

### Running

```bash
npm run dev
```

On first run, scan the QR code with your WhatsApp app. The session is saved to `auth_info/` directory.

## Docker

```bash
docker-compose up -d
```

First run requires QR scanning - view logs:

```bash
docker-compose logs -f
```

## API

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "whatsapp": "connected",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Send Message

```
POST /send
Content-Type: application/json
X-API-Key: your-api-key

{
  "phone": "+491234567890",
  "message": "Hello from WhatsApp API!"
}
```

Or with query parameter:

```
POST /send?apikey=your-api-key
Content-Type: application/json

{
  "phone": "+491234567890",
  "message": "Hello from WhatsApp API!"
}
```

Response:
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

## Home Assistant Integration

Add to `configuration.yaml`:

```yaml
rest_command:
  whatsapp_message:
    url: "http://localhost:3000/send"
    method: POST
    headers:
      Content-Type: "application/json"
      X-API-Key: "your-api-key"
    payload: '{"phone": "{{ phone }}", "message": "{{ message }}"}'
    content_type: "application/json"
```

Use in automations:

```yaml
automation:
  - alias: "Send WhatsApp Alert"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door
        to: "on"
    action:
      - service: rest_command.whatsapp_message
        data:
          phone: "+491234567890"
          message: "Front door opened!"
```

## Troubleshooting

### QR Code Not Appearing
Ensure terminal supports QR display. Check logs for connection status.

### Session Lost After Restart
Verify `auth_info/` directory is persisted (Docker: check volume mount).

### Messages Not Sending
1. Check `/health` endpoint - WhatsApp must be "connected"
2. Verify phone number is in `ALLOWED_PHONES`
3. Check API key is correct
