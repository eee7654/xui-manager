import DefaultModel from './Default.js';

class CloudflareBannedIp extends DefaultModel {
  static get tableName() {
    return 'cloudflare_banned_ips';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['ip', 'banned_at', 'expires_at', 'duration_minutes'],
      properties: {
        id: { type: ['integer', 'string'] },
        ip: { type: 'string', minLength: 3, maxLength: 45 },
        source_server: { type: ['string', 'null'], maxLength: 255 },
        reason: { type: ['string', 'null'], maxLength: 255 },
        metadata: { type: ['object', 'array', 'null'] },
        banned_at: { type: 'string' },
        expires_at: { type: 'string' },
        last_seen_at: { type: ['string', 'null'] },
        last_synced_at: { type: ['string', 'null'] },
        duration_minutes: { type: ['integer', 'string'] },
        is_active: { type: ['boolean', 'integer'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }
}

export default CloudflareBannedIp;
