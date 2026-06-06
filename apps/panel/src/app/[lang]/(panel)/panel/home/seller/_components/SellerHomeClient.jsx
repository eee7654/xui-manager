"use client";

import { Alert, Card, Col, Row, Skeleton, Statistic } from "antd";
import { useAtomValue } from "jotai";
import { dictAtom } from "@/store/i18nAtom";
import * as XuiClientService from "@/services/xuiClients.service";

const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / Math.pow(1024, index);
    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const SellerHomeClient = () => {
    const dict = useAtomValue(dictAtom);
    const { data, isLoading, error } = XuiClientService.useStats();
    const stats = data?.data || {};
    const serverErrors = data?._meta?.errors || [];

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-6 z-[1]">
                <Skeleton active paragraph={{ rows: 4 }} />
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
            key: 'total',
            title: dict.home.sellerStats.totalClients,
            value: stats.total_clients || 0,
            icon: 'bi-people'
        },
        {
            key: 'active',
            title: dict.home.sellerStats.activeClients,
            value: stats.active_clients || 0,
            icon: 'bi-check-circle'
        },
        {
            key: 'expired',
            title: dict.home.sellerStats.expiredClients,
            value: stats.expired_clients || 0,
            icon: 'bi-clock-history'
        },
        {
            key: 'usage',
            title: dict.home.sellerStats.totalUsage,
            value: formatBytes(stats.total_usage),
            icon: 'bi-activity'
        }
    ];

    return (
        <div className="container mx-auto px-4 py-6 z-[1]">
            {serverErrors.length > 0 && (
                <Alert
                    className="mb-4"
                    type="warning"
                    showIcon
                    message={dict.home.sellerStats.serverErrors}
                    description={serverErrors.map(item => `${item.server_name}: ${item.code}`).join(' | ')}
                />
            )}
            <Row gutter={[16, 16]}>
                {cards.map(card => (
                    <Col xs={24} sm={12} xl={6} key={card.key}>
                        <Card className="!bg-bgSurface !border-borderColor shadow-sm !rounded-xl">
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
        </div>
    );
};

export default SellerHomeClient;
