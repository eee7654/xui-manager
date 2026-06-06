"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Card, Flex, Input, Modal, Popconfirm, QRCode, Space, Table, Tag, Tooltip, Typography } from "antd";
import { useAtomValue } from "jotai";
import { Can } from "@casl/react";
import { subject } from "@casl/ability";
import { abilityAtom } from "@/store/authAtom";
import { dictAtom, langAtom } from "@/store/i18nAtom";
import * as XuiClientService from "@/services/xuiClients.service";
import ErrComp from "@/components/ui/ErrComp";
import XuiClientFormDrawer from "./XuiClientFormDrawer";
import moment from "jalali-moment";

const { Text } = Typography;

const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / Math.pow(1024, index);
    return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatTraffic = (used, total) => {
    const totalBytes = Number(total || 0);
    return `${formatBytes(used)} / ${totalBytes > 0 ? formatBytes(totalBytes) : '∞'}`;
};

const formatExpiry = (value, lang, dict) => {
    const timestamp = Number(value || 0);
    if (!timestamp) return dict.xuiClients.expiry.unlimited;
    if (timestamp < 0) {
        const days = Math.ceil(Math.abs(timestamp) / 86400000);
        return dict.xuiClients.expiry.firstUse.replace('{days}', days);
    }
    return moment(timestamp).locale(lang).format('YYYY/MM/DD');
};

const XuiClientsClient = () => {
    const dict = useAtomValue(dictAtom);
    const lang = useAtomValue(langAtom);
    const ability = useAtomValue(abilityAtom);
    const { message } = App.useApp();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState("");
    const [searchText, setSearchText] = useState("");
    const [drawerState, setDrawerState] = useState({
        open: false,
        mode: "create",
        initialValues: null
    });
    const [qrClient, setQrClient] = useState(null);

    const { data, isLoading, isFetching, error } = XuiClientService.useList({ page, limit, search });
    const { mutate: deleteClient, isPending: isDeleting } = XuiClientService.useDelete();
    const serverErrors = data?._meta?.errors || [];

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearch(searchText);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchText]);

    const openCreateDrawer = () => setDrawerState({
        open: true,
        mode: "create",
        initialValues: { enable: true }
    });

    const openEditDrawer = (record) => setDrawerState({
        open: true,
        mode: "edit",
        initialValues: record
    });

    const closeDrawer = () => setDrawerState(prev => ({ ...prev, open: false }));

    const handleDeleteClient = useCallback((record) => {
        deleteClient({ server_id: record.server_id, id: record.id }, {
            onSuccess: () => {
                message.success(dict.xuiClients.actions.successDelete);
            }
        });
    }, [deleteClient, dict, message]);

    const copySubscriptionUrl = useCallback(async (url) => {
        if (!url) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            message.success(dict.common.copied);
        } catch {
            message.error(dict.errors?.GEN_UNKNOWN_ERROR || 'Copy failed');
        }
    }, [dict, message]);

    const columns = useMemo(() => [
        {
            title: dict.xuiClients.table.client,
            dataIndex: 'email',
            key: 'email',
            render: (text, row) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-bgBase border border-borderColor text-textMuted">
                        <i className="bi bi-person-badge" />
                    </div>
                    <Flex vertical>
                        <span className="font-semibold text-textBase">{text}</span>
                        <span className="text-textMuted text-xs mt-1">
                            {dict.xuiClients.table.seller}: <span className="font-mono">{row.seller_username || '-'}</span>
                        </span>
                        <span className="text-textMuted text-xs font-mono mt-1">{row.id}</span>
                    </Flex>
                </div>
            )
        },
        {
            title: dict.xuiClients.table.server,
            key: 'server',
            render: (_, row) => (
                <Flex vertical>
                    <span className="font-medium text-textBase">{row.server_name}</span>
                    <span className="text-textMuted text-xs font-mono">#{row.inbound_id} {row.inbound_tag || ''}</span>
                </Flex>
            )
        },
        {
            title: dict.xuiClients.table.quota,
            key: 'traffic',
            render: (_, row) => <span className="text-textMuted font-mono">{formatTraffic(row.traffic_used, row.traffic_total)}</span>
        },
        {
            title: dict.xuiClients.table.expiry,
            dataIndex: 'expiryTime',
            key: 'expiryTime',
            render: (value) => <span className="text-textMuted text-sm">{formatExpiry(value, lang, dict)}</span>
        },
        {
            title: dict.xuiClients.table.connection,
            dataIndex: 'is_online',
            key: 'is_online',
            align: 'center',
            render: (isOnline) => (
                isOnline ?
                    <Tag color="success" className="!rounded-md border-none !bg-green-50 dark:!bg-green-900/30 !text-success m-0">
                        <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            {dict.xuiClients.online.online}
                        </span>
                    </Tag>
                    :
                    <Tag className="!rounded-md border-none !bg-bgBase !text-textMuted m-0">
                        {dict.xuiClients.online.offline}
                    </Tag>
            )
        },
        {
            title: dict.xuiClients.table.limitIp,
            dataIndex: 'limitIp',
            key: 'limitIp',
            align: 'center',
            render: (value) => <Tag className="!rounded-md border-none !bg-bgBase !text-textBase">{value || 0}</Tag>
        },
        {
            title: dict.xuiClients.table.status,
            dataIndex: 'enable',
            key: 'enable',
            align: 'center',
            render: (enabled) => (
                enabled ?
                    <Tag color="success" className="!rounded-md border-none !bg-green-50 dark:!bg-green-900/30 !text-success m-0">
                        {dict.common.active}
                    </Tag>
                    :
                    <Tag color="error" className="!rounded-md border-none !bg-red-50 dark:!bg-red-900/30 !text-accent m-0">
                        {dict.common.inactive}
                    </Tag>
            )
        },
        {
            title: dict.common.actions,
            key: 'actions',
            align: 'center',
            render: (_, record) => (
                <Space size="small">
                    {record.subscription_url && (
                        <Tooltip title={dict.xuiClients.actions.showQr}>
                            <Button
                                type="text"
                                className="!text-borderColor !bg-textBase"
                                size="large"
                                icon={<i className="bi bi-qr-code grid" />}
                                onClick={() => setQrClient(record)}
                            />
                        </Tooltip>
                    )}
                    <Can I="update" this={subject('XuiClient', record)} ability={ability}>
                        <Tooltip title={dict.common.edit}>
                            <Button
                                type="text"
                                className="!text-borderColor !bg-textBase"
                                size="large"
                                icon={<i className="bi bi-pencil-square grid" />}
                                onClick={() => openEditDrawer(record)}
                            />
                        </Tooltip>
                    </Can>
                    <Can I="delete" this={subject('XuiClient', record)} ability={ability}>
                        <Popconfirm
                            title={dict.common.delete_title}
                            description={dict.xuiClients.actions.deleteConfirm}
                            okText={dict.common.yes}
                            cancelText={dict.common.no}
                            okButtonProps={{ danger: true, loading: isDeleting }}
                            onConfirm={() => handleDeleteClient(record)}
                        >
                            <Tooltip title={dict.common.delete}>
                                <Button
                                    danger
                                    type="text"
                                    className="!text-textBase !bg-accent"
                                    size="large"
                                    icon={<i className="bi bi-trash3 grid" />}
                                />
                            </Tooltip>
                        </Popconfirm>
                    </Can>
                </Space>
            )
        }
    ], [dict, ability, lang, isDeleting, handleDeleteClient]);

    return (
        <div className="container mx-auto px-4 py-6 box-border z-[1] h-[100dvh] max-sm:h-[calc(100dvh-92px)] min-h-0">
            {!error ? (
                <Card
                    className="w-full h-full min-h-0 flex flex-col !bg-bgSurface !border-borderColor shadow-sm !rounded-xl overflow-hidden"
                    classNames={{
                        header: '!border-b !border-borderColor !px-6 !py-4',
                        body: '!p-0 mt-1 flex flex-col flex-1 min-h-0 overflow-y-auto'
                    }}
                    title={
                        <Flex justify="space-between" align="center" className="w-full max-sm:flex-col max-sm:gap-4 max-sm:items-start">
                            <Flex vertical>
                                <span className="text-textBase text-lg font-bold">
                                    {dict.xuiClients.pageTitle}
                                </span>
                                <span className="text-textMuted text-sm mt-1 font-normal">
                                    {dict.xuiClients.header.desc}
                                </span>
                            </Flex>

                            <Flex gap="middle" align="center" className="max-sm:w-full">
                                <Input
                                    placeholder={dict.xuiClients.header.searchPlaceholder}
                                    prefix={<i className="bi bi-search text-textMuted" />}
                                    className="!bg-bgBase !border-borderColor !text-textBase hover:!border-primary focus:!border-primary rounded-lg min-w-[250px] max-sm:w-full"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    allowClear
                                />

                                <Can I="create" a="XuiClient" ability={ability}>
                                    <Button
                                        type="primary"
                                        className="!bg-primary hover:opacity-[0.85] !shadow-none rounded-lg font-medium"
                                        icon={<i className="bi bi-plus-lg" />}
                                        onClick={openCreateDrawer}
                                    >
                                        {dict.xuiClients.header.addBtn}
                                    </Button>
                                </Can>
                            </Flex>
                        </Flex>
                    }
                >
                    <div
                        className="content-wrap p-4 flex flex-col gap-3"
                    >
                        {serverErrors.length > 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                message={dict.xuiClients.serverErrors}
                                description={serverErrors.map(item => `${item.server_name}: ${item.code}`).join(' | ')}
                            />
                        )}
                        <Table
                            className="custom-table"
                            columns={columns}
                            dataSource={data?.data || []}
                            rowKey={(row) => `${row.server_id}-${row.id}`}
                            loading={isLoading || isFetching}
                            scroll={{ x: 'max-content' }}
                            pagination={{
                                current: page,
                                pageSize: limit,
                                total: data?.total || 0,
                                showSizeChanger: true,
                                onChange: (newPage, newPageSize) => {
                                    setPage(newPage);
                                    setLimit(newPageSize);
                                },
                            }}
                            locale={{ emptyText: dict.xuiClients.empty }}
                            rowClassName={() => "hover:!bg-bgBase transition-colors !text-textBase"}
                        />
                    </div>
                </Card>
            ) : (
                <ErrComp errorCode={error} className="mt-6" />
            )}

            <XuiClientFormDrawer
                open={drawerState.open}
                onClose={closeDrawer}
                mode={drawerState.mode}
                initialValues={drawerState.initialValues}
            />
            <Modal
                open={!!qrClient}
                onCancel={() => setQrClient(null)}
                footer={null}
                title={dict.xuiClients.qr.title}
                centered
            >
                {qrClient?.subscription_url && (
                    <Flex vertical align="center" gap="middle">
                        <Tooltip title={dict.xuiClients.qr.copyTooltip}>
                            <button
                                type="button"
                                aria-label={dict.xuiClients.qr.copyTooltip}
                                className="border-0 bg-transparent p-0 cursor-pointer leading-none"
                                onClick={() => copySubscriptionUrl(qrClient.subscription_url)}
                            >
                                <QRCode value={qrClient.subscription_url} size={220} />
                            </button>
                        </Tooltip>
                        <Text className="text-textMuted text-xs text-center break-all" dir="ltr">
                            {qrClient.subscription_url}
                        </Text>
                    </Flex>
                )}
            </Modal>
        </div>
    );
};

export default XuiClientsClient;
