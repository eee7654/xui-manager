"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Card, Flex, Input, Popconfirm, Table, Tag, Tooltip } from "antd";
import { useAtomValue } from "jotai";
import { Can } from "@casl/react";
import { abilityAtom } from "@/store/authAtom";
import { dictAtom, langAtom } from "@/store/i18nAtom";
import * as CloudflareBansService from "@/services/cloudflareBans.service";
import ErrComp from "@/components/ui/ErrComp";
import moment from "jalali-moment";

const parseUtcDate = (value) => {
    if (!value) return null;
    const date = moment.utc(value);
    return date.isValid() ? date : null;
};

const formatDate = (value, lang) => {
    const date = parseUtcDate(value);
    return date ? date.local().locale(lang).format('YYYY/MM/DD HH:mm') : '-';
};

const CloudflareBansClient = () => {
    const dict = useAtomValue(dictAtom);
    const lang = useAtomValue(langAtom);
    const ability = useAtomValue(abilityAtom);
    const { message } = App.useApp();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState("");
    const [searchText, setSearchText] = useState("");

    const { data, isLoading, isFetching, error } = CloudflareBansService.useList({ page, limit, search, active: '' });
    const { mutate: syncList, isPending: isSyncing } = CloudflareBansService.useSync();
    const { mutate: clearList, isPending: isClearing } = CloudflareBansService.useClear();

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearch(searchText);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchText]);

    const columns = useMemo(() => [
        {
            title: dict.cloudflareBans.table.ip,
            dataIndex: 'ip',
            key: 'ip',
            render: (ip, row) => (
                <Flex vertical>
                    <span className="font-semibold text-textBase font-mono">{ip}</span>
                    <span className="text-textMuted text-xs">{row.reason || '-'}</span>
                </Flex>
            )
        },
        {
            title: dict.cloudflareBans.table.source,
            dataIndex: 'source_server',
            key: 'source_server',
            render: (value) => <span className="text-textMuted">{value || '-'}</span>
        },
        {
            title: dict.cloudflareBans.table.client,
            dataIndex: 'client_email',
            key: 'client_email',
            render: (value) => <span className="text-textMuted font-mono">{value || '-'}</span>
        },
        {
            title: dict.cloudflareBans.table.bannedAt,
            dataIndex: 'banned_at',
            key: 'banned_at',
            render: (value) => <span className="text-textMuted text-sm">{formatDate(value, lang)}</span>
        },
        {
            title: dict.cloudflareBans.table.expiresAt,
            dataIndex: 'expires_at',
            key: 'expires_at',
            render: (value) => <span className="text-textMuted text-sm">{formatDate(value, lang)}</span>
        },
        {
            title: dict.cloudflareBans.table.status,
            dataIndex: 'is_active',
            key: 'is_active',
            align: 'center',
            render: (value, row) => {
                const expiresAt = parseUtcDate(row.expires_at);
                const active = value && expiresAt && expiresAt.valueOf() > Date.now();
                return active ? (
                    <Tag color="error" className="!rounded-md border-none !bg-red-50 dark:!bg-red-900/30 !text-accent m-0">
                        {dict.cloudflareBans.status.active}
                    </Tag>
                ) : (
                    <Tag className="!rounded-md border-none !bg-bgBase !text-textMuted m-0">
                        {dict.cloudflareBans.status.expired}
                    </Tag>
                );
            }
        }
    ], [dict, lang]);

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
                                <span className="text-textBase text-lg font-bold">{dict.cloudflareBans.pageTitle}</span>
                                <span className="text-textMuted text-sm mt-1 font-normal">
                                    {dict.cloudflareBans.header.desc} · {dict.cloudflareBans.header.activeCount}: {data?._meta?.active_count || 0}
                                </span>
                            </Flex>
                            <Flex gap="middle" align="center" className="max-sm:w-full">
                                <Input
                                    placeholder={dict.cloudflareBans.header.searchPlaceholder}
                                    prefix={<i className="bi bi-search text-textMuted" />}
                                    className="!bg-bgBase !border-borderColor !text-textBase hover:!border-primary focus:!border-primary rounded-lg min-w-[250px] max-sm:w-full"
                                    value={searchText}
                                    onChange={(event) => setSearchText(event.target.value)}
                                    allowClear
                                />
                                <Can I="sync" a="CloudflareBan" ability={ability}>
                                    <Tooltip title={dict.cloudflareBans.actions.sync}>
                                        <Button
                                            icon={<i className="bi bi-arrow-repeat" />}
                                            loading={isSyncing}
                                            onClick={() => syncList(undefined, {
                                                onSuccess: () => message.success(dict.cloudflareBans.actions.successSync)
                                            })}
                                        >
                                            {dict.cloudflareBans.actions.sync}
                                        </Button>
                                    </Tooltip>
                                </Can>
                                <Can I="delete" a="CloudflareBan" ability={ability}>
                                    <Popconfirm
                                        title={dict.cloudflareBans.actions.clear}
                                        description={dict.cloudflareBans.actions.clearConfirm}
                                        okText={dict.common.yes}
                                        cancelText={dict.common.no}
                                        okButtonProps={{ danger: true, loading: isClearing }}
                                        onConfirm={() => clearList(undefined, {
                                            onSuccess: () => message.success(dict.cloudflareBans.actions.successClear)
                                        })}
                                    >
                                        <Button danger icon={<i className="bi bi-slash-circle" />}>
                                            {dict.cloudflareBans.actions.clear}
                                        </Button>
                                    </Popconfirm>
                                </Can>
                            </Flex>
                        </Flex>
                    }
                >
                    <div className="content-wrap p-4">
                        <Table
                            className="custom-table"
                            columns={columns}
                            dataSource={data?.data || []}
                            rowKey="id"
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
                            locale={{ emptyText: dict.cloudflareBans.empty }}
                        />
                    </div>
                </Card>
            ) : (
                <ErrComp errorCode={error} className="mt-6" />
            )}
        </div>
    );
};

export default CloudflareBansClient;
