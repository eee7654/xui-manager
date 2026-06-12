

export const SYSTEM_MENUS = [
  { key: '1', label: 'home', icon: <i className='bi bi-house-door'/>, route: '/panel/home' },
  { key: '0', label: 'roles', icon: <i className='bi bi-shield-check'/>, route: '/panel/roles', action: 'read', subject: 'Role' },
  { key: '2', label: 'organizations', icon: <i className='bi bi-grid-1x2'/>, route: '/panel/organs', action: 'read', subject: 'Organization' },
  { key: '3', label: 'users', icon: <i className='bi bi-people'/>, route: '/panel/users', action: 'read', subject: 'User' },
  { key: '4', label: 'xuiServers', icon: <i className='bi bi-hdd-network'/>, route: '/panel/xui-servers', action: 'read', subject: 'XuiServer' },
  { key: '5', label: 'xuiClients', icon: <i className='bi bi-person-lines-fill'/>, route: '/panel/xui-clients', action: 'read', subject: 'XuiClient' },
  { key: '6', label: 'cloudflareDns', icon: <i className='bi bi-cloud-upload'/>, route: '/panel/cloudflare-dns', action: 'read', subject: 'CloudflareDns' },
  { key: '7', label: 'cloudflareBans', icon: <i className='bi bi-shield-slash'/>, route: '/panel/cloudflare-bans', action: 'read', subject: 'CloudflareBan' },
  { key: '10', label: 'settings', icon: <i className='bi bi-gear'/>, route: '/panel/settings' },
];
