import DefaultModel from './Default.js';

class XuiWriteLock extends DefaultModel {
  static get tableName() {
    return 'xui_write_locks';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['lock_key', 'owner_token', 'expires_at'],
      properties: {
        id: { type: 'integer' },
        lock_key: { type: 'string', minLength: 1, maxLength: 255 },
        owner_token: { type: 'string', minLength: 1, maxLength: 255 },
        expires_at: { type: 'string' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }
}

export default XuiWriteLock;
