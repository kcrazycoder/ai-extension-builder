import axios from 'axios';

export class SchemaService {
  private static cache: string[] | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private static schemaUrl = 'https://json.schemastore.org/chrome-manifest';
  // "runtime" lists in schema but causes "unknown permission" error in Chrome
  private static denyList = new Set(['runtime', 'app', 'usb', 'bluetooth', 'system.display']);

  static async getValidPermissions(): Promise<string[]> {
    // 1. Try In-Memory Cache
    if (this.cache && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      console.log('[Schema] Loading permissions from memory cache');
      return this.cache;
    }

    // 2. Fetch Fresh
    console.log('[Schema] Fetching fresh permissions from official source');
    try {
      const list = await this.fetchFromSource();
      if (list.length > 0) {
        this.cache = list;
        this.cacheTimestamp = Date.now();
        return list;
      }
    } catch (error) {
      console.error('[Schema] Fetch failed:', error);
    }

    // 3. Fallback to embedded list if fetch fails
    return this.getFallbackList();
  }

  private static async fetchFromSource(): Promise<string[]> {
    const response = await axios.get(this.schemaUrl);
    const schema = response.data;

    let foundEnum: string[] = [];

    // Traverse to find definitions.permissions or definitions.permission
    // Based on inspection, it's often in definitions.permission.enum OR definitions.permissions.anyOf[].enum

    // Strategy: Look for "definitions.permission" first (Single Item)
    if (schema.definitions?.permission?.enum) {
      foundEnum = schema.definitions.permission.enum;
    }
    // Strategy: Look for "definitions.permissions" (Array/List)
    else if (schema.definitions?.permissions?.items?.anyOf) {
      // Extract from all anyOf branches
      for (const item of schema.definitions.permissions.items.anyOf) {
        if (item.enum) foundEnum.push(...item.enum);
      }
    } else if (schema.definitions?.permissions?.anyOf) {
      for (const item of schema.definitions.permissions.anyOf) {
        if (item.enum) foundEnum.push(...item.enum);
      }
    }

    // Clean and Filter
    const unique = [...new Set(foundEnum)];
    return unique.filter((p) => !this.denyList.has(p)).sort();
  }

  private static getFallbackList(): string[] {
    return [
      'activeTab',
      'alarms',
      'background',
      'bookmarks',
      'browsingData',
      'clipboardRead',
      'clipboardWrite',
      'contentSettings',
      'contextMenus',
      'cookies',
      'debugger',
      'declarativeContent',
      'declarativeNetRequest',
      'desktopCapture',
      'downloads',
      'fontSettings',
      'gcm',
      'geolocation',
      'history',
      'identity',
      'idle',
      'management',
      'nativeMessaging',
      'notifications',
      'pageCapture',
      'power',
      'printerProvider',
      'printing',
      'privacy',
      'proxy',
      'scripting',
      'search',
      'sessions',
      'sidePanel',
      'storage',
      'system.cpu',
      'system.memory',
      'system.storage',
      'tabCapture',
      'tabGroups',
      'tabs',
      'topSites',
      'tts',
      'ttsEngine',
      'unlimitedStorage',
      'webNavigation',
      'webRequest',
    ];
  }
}
