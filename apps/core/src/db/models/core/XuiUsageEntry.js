import DefaultModel from './Default.js';

class XuiUsageEntry extends DefaultModel {
    static get tableName() {
        return 'xui_usage_entries';
    }
}

export default XuiUsageEntry;
