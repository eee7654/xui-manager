"use client";

import { Alert, App, Button, Card, Col, Flex, Row, Skeleton, Statistic, Table } from "antd";
import { useAtomValue } from "jotai";
import { dictAtom } from "@/store/i18nAtom";
import * as XuiClientService from "@/services/xuiClients.service";
import { convertEmojiShortcodes } from "@/lib/emoji";

const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / Math.pow(1024, index);
    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const AdminHomeClient = () => {
    const dict = useAtomValue(dictAtom);
    const { message } = App.useApp();
    const { data, isLoading, error } = XuiClientService.useStats();
    const { mutate: runAccounting, isPending: isRunningAccounting } = XuiClientService.useRunAccounting();
    const stats = data?.data || {};
    const serverErrors = data?._meta?.errors || [];

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-6 z-[1]">
                <Skeleton active paragraph={{ rows: 6 }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-6 z-[1]">
                <Alert type="error" showIcon message={dict.errors?.[error] || error} />
            </div>
        );
    }

    const cards = [
        {
            key: 'clients',
            title: dict.home.adminStats.totalClients,
            value: stats.total_clients || 0,
            icon: 'bi-hdd-network'
        },
        {
            key: 'sellers',
            title: dict.home.adminStats.sellerUsers,
            value: stats.seller_users || 0,
            icon: 'bi-person-lines-fill'
        },
        {
            key: 'active',
            title: dict.home.adminStats.activeClients,
            value: stats.active_clients || 0,
            icon: 'bi-check-circle'
        },
        {
            key: 'expired',
            title: dict.home.adminStats.expiredClients,
            value: stats.expired_clients || 0,
            icon: 'bi-clock-history'
        },
        {
            key: 'usage',
            title: dict.home.adminStats.totalUsage,
            value: formatBytes(stats.total_usage),
            icon: 'bi-activity'
        }
    ];

    const columns = [
        {
            title: dict.home.adminStats.table.server,
            key: 'server',
            render: (_, row) => (
                <div className="flex flex-col">
                    <span className="text-textBase font-medium">{convertEmojiShortcodes(row.server_name)}</span>
                    <span className="text-textMuted text-xs font-mono">#{row.inbound_id} {row.inbound_tag || ''}</span>
                </div>
            )
        },
        {
            title: dict.home.adminStats.table.clients,
            dataIndex: 'total_clients',
            key: 'total_clients',
            align: 'center'
        },
        {
            title: dict.home.adminStats.table.active,
            dataIndex: 'active_clients',
            key: 'active_clients',
            align: 'center'
        },
        {
            title: dict.home.adminStats.table.expired,
            dataIndex: 'expired_clients',
            key: 'expired_clients',
            align: 'center'
        },
        {
            title: dict.home.adminStats.table.download,
            dataIndex: 'total_download',
            key: 'total_download',
            render: (value) => <span className="font-mono text-textMuted">{formatBytes(value)}</span>
        },
        {
            title: dict.home.adminStats.table.upload,
            dataIndex: 'total_upload',
            key: 'total_upload',
            render: (value) => <span className="font-mono text-textMuted">{formatBytes(value)}</span>
        },
        {
            title: dict.home.adminStats.table.usage,
            dataIndex: 'total_usage',
            key: 'total_usage',
            render: (value) => <span className="font-mono text-textBase">{formatBytes(value)}</span>
        }
    ];

    return (
        <div className="container mx-auto px-4 py-6 z-[1]">
            <Flex justify="flex-end" className="mb-4">
                <Button
                    type="primary"
                    icon={<i className="bi bi-play-circle" />}
                    loading={isRunningAccounting}
                    onClick={() => runAccounting(undefined, {
                        onSuccess: (result) => message.success(
                            dict.home.adminStats.accountingComplete.replace('{usage}', formatBytes(result?.data?.total_usage_delta))
                        )
                    })}
                >
                    {dict.home.adminStats.runAccounting}
                </Button>
            </Flex>
            {serverErrors.length > 0 && (
                <Alert
                    className="mb-4"
                    type="warning"
                    showIcon
                    message={dict.home.adminStats.serverErrors}
                    description={serverErrors.map(item => `${convertEmojiShortcodes(item.server_name)}: ${item.code}`).join(' | ')}
                />
            )}
            <Row gutter={[16, 16]}>
                {cards.map(card => (
                    <Col xs={24} sm={12} xl={card.key === 'usage' ? 24 : 6} key={card.key}>
                        <Card className="!bg-bgSurface !border-borderColor shadow-sm !rounded-xl h-full">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-lg bg-bgBase border border-borderColor text-primary flex items-center justify-center">
                                    <i className={`bi ${card.icon} text-xl`} />
                                </div>
                                <Statistic
                                    title={<span className="text-textMuted">{card.title}</span>}
                                    value={card.value}
                                    valueStyle={{ color: 'var(--text-base)', fontSize: 24, fontWeight: 700 }}
                                />
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Card
                className="!bg-bgSurface !border-borderColor shadow-sm !rounded-xl mt-4"
                title={<span className="text-textBase font-bold">{dict.home.adminStats.serverTraffic}</span>}
            >
                <Table
                    className="custom-table"
                    columns={columns}
                    dataSource={stats.servers || []}
                    rowKey={(row) => String(row.server_id)}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: dict.common.no_data }}
                />
            </Card>
        </div>
    );
};

export default AdminHomeClient;
