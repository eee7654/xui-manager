import DefaultModel from './Default.js';

class XuiServer extends DefaultModel {
  static get tableName() {
    return 'xui_servers';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'panel_domain', 'inbound_id'],
      properties: {
        id: { type: ['integer', 'string'] },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        panel_domain: { type: 'string', minLength: 1, maxLength: 255 },
        panel_port: { type: ['integer', 'null'] },
        subscription_port: { type: ['integer', 'null'] },
        panel_path: { type: 'string', minLength: 1, maxLength: 255 },
        panel_ssl: { type: ['boolean', 'integer'] },
        api_mode: { type: 'string', enum: ['legacy_session', 'token_v3'] },
        api_token: { type: ['string', 'null'] },
        username: { type: ['string', 'null'], maxLength: 255 },
        password: { type: ['string', 'null'] },
        inbound_id: { type: ['integer', 'string'] },
        inbound_tag: { type: ['string', 'null'], maxLength: 255 },
        max_clients: { type: ['integer', 'string'] },
        is_active: { type: ['boolean', 'integer'] },
        comment_key: { type: 'string', minLength: 1, maxLength: 255 },
        cloudflare_clearance: { type: ['string', 'null'] },
        cloudflare_user_agent: { type: ['string', 'null'], maxLength: 512 },
        proxy_url: { type: ['string', 'null'], maxLength: 1024 },
        connect_timeout_ms: { type: ['integer', 'string'] },
        meta: { type: ['object', 'array', 'null'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }

  static get secretColumns() {
    return ['password', 'api_token', 'cloudflare_clearance'];
  }

  static get publicColumns() {
    return this.schemaColumns.filter(col => !this.secretColumns.includes(col));
  }

  static buildPanelUrl(server) {
    const protocol = server.panel_ssl ? 'https' : 'http';
    const port = server.panel_port ? `:${server.panel_port}` : '';
    const path = server.panel_path?.startsWith('/') ? server.panel_path : `/${server.panel_path || ''}`;
    return `${protocol}://${server.panel_domain}${port}${path}`;
  }
}

export default XuiServer;
