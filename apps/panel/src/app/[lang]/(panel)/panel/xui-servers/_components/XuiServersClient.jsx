"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Table, Input, Button, Tag, Space, Tooltip, Flex } from "antd";
import { useAtomValue } from "jotai";
import { Can } from "@casl/react";
import { subject } from "@casl/ability";
import { abilityAtom } from "@/store/authAtom";
import { dictAtom } from "@/store/i18nAtom";
import * as XuiServerService from "@/services/xuiServers.service";
import ErrComp from "@/components/ui/ErrComp";
import XuiServerFormDrawer from "./XuiServerFormDrawer";

const XuiServersClient = () => {
    const dict = useAtomValue(dictAtom);
    const ability = useAtomValue(abilityAtom);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState("");
    const [searchText, setSearchText] = useState("");
    const [drawerState, setDrawerState] = useState({
        open: false,
        mode: "create",
        initialValues: null
    });

    const { data, isLoading, isFetching, error } = XuiServerService.useList({ page, limit, search });

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
        initialValues: { is_active: true, panel_ssl: true, panel_path: '/', comment_key: '@', max_clients: 0 }
    });

    const openEditDrawer = (record) => setDrawerState({
        open: true,
        mode: "edit",
        initialValues: record
    });

    const closeDrawer = () => setDrawerState(prev => ({ ...prev, open: false }));

    const columns = useMemo(() => [
        {
            title: dict.xuiServers.table.name,
            dataIndex: 'name',
            key: 'name',
            render: (text, row) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-bgBase border border-borderColor text-textMuted">
                        <i className="bi bi-hdd-network" />
                    </div>
                    <Flex vertical>
                        <span className="font-semibold text-textBase">{text}</span>
                        <span className="text-textMuted text-xs font-mono mt-1">{row.panel_url}</span>
                    </Flex>
                </div>
            )
        },
        {
            title: dict.xuiServers.table.inbound,
            key: 'inbound',
            render: (_, row) => (
                <Space size="small" wrap>
                    <Tag className="!rounded-md border-none !bg-blue-50 dark:!bg-blue-900/30 !text-blue-600 dark:!text-blue-400">
                        #{row.inbound_id}
                    </Tag>
                    {row.inbound_tag && (
                        <span className="text-textMuted text-xs font-mono">{row.inbound_tag}</span>
                    )}
                </Space>
            )
        },
        {
            title: dict.xuiServers.table.capacity,
            dataIndex: 'max_clients',
            key: 'max_clients',
            align: 'center',
            render: (maxClients) => (
                <Tag className="!rounded-md border-none !bg-bgBase !text-textBase">
                    <i className="bi bi-people me-1" />
                    {maxClients || 0}
                </Tag>
            )
        },
        {
            title: dict.xuiServers.table.commentKey,
            dataIndex: 'comment_key',
            key: 'comment_key',
            render: (commentKey) => <span className="font-mono text-textMuted">{commentKey}</span>
        },
        {
            title: dict.xuiServers.table.cloudflare,
            key: 'cloudflare',
            align: 'center',
            render: (_, row) => (
                row.cloudflare_user_agent || row.proxy_url ? (
                    <Tag color="processing" className="!rounded-md border-none">
                        <i className="bi bi-cloud-check me-1" />
                        {dict.common.active}
                    </Tag>
                ) : (
                    <span className="text-textMuted text-xs">-</span>
                )
            )
        },
        {
            title: dict.xuiServers.table.status,
            dataIndex: 'is_active',
            key: 'is_active',
            align: 'center',
            render: (isActive) => (
                isActive ?
                    <Tag color="success" className="!rounded-md border-none !bg-green-50 dark:!bg-green-900/30 !text-success m-0">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                            {dict.common.active}
                        </span>
                    </Tag>
                    :
                    <Tag color="error" className="!rounded-md border-none !bg-red-50 dark:!bg-red-900/30 !text-accent m-0">
                        <i className="bi bi-slash-circle me-1" />
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
                    <Can I="update" this={subject('XuiServer', record)} ability={ability}>
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
                </Space>
            )
        }
    ], [dict, ability]);

    return (
        <div className="container mx-auto px-4 py-6 z-[1] h-full">
            {!error ? (
                <Card
                    className="w-full h-full flex flex-col !bg-bgSurface !border-borderColor shadow-sm !rounded-xl overflow-hidden"
                    classNames={{
                        header: '!border-b !border-borderColor !px-6 !py-4',
                        body: '!p-0 flex flex-col flex-1 min-h-0'
                    }}
                    title={
                        <Flex justify="space-between" align="center" className="w-full max-sm:flex-col max-sm:gap-4 max-sm:items-start">
                            <Flex vertical>
                                <span className="text-textBase text-lg font-bold">
                                    {dict.xuiServers.pageTitle}
                                </span>
                                <span className="text-textMuted text-sm mt-1 font-normal">
                                    {dict.xuiServers.header.desc}
                                </span>
                            </Flex>

                            <Flex gap="middle" align="center" className="max-sm:w-full">
                                <Input
                                    placeholder={dict.xuiServers.header.searchPlaceholder}
                                    prefix={<i className="bi bi-search text-textMuted" />}
                                    className="!bg-bgBase !border-borderColor !text-textBase hover:!border-primary focus:!border-primary rounded-lg min-w-[250px] max-sm:w-full"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    allowClear
                                />

                                <Can I="create" a="XuiServer" ability={ability}>
                                    <Button
                                        type="primary"
                                        className="!bg-primary hover:opacity-[0.85] !shadow-none rounded-lg font-medium"
                                        icon={<i className="bi bi-plus-lg" />}
                                        onClick={openCreateDrawer}
                                    >
                                        {dict.xuiServers.header.addBtn}
                                    </Button>
                                </Can>
                            </Flex>
                        </Flex>
                    }
                >
                    <div className="content-wrap p-4 flex flex-col flex-1 min-h-0">
                        <Table
                            className="custom-table"
                            columns={columns}
                            dataSource={data?.data || []}
                            rowKey="id"
                            loading={isLoading || isFetching}
                            scroll={{ x: 'max-content', y: 'var(--table-scroll-y)' }}
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
                            locale={{ emptyText: dict.xuiServers.empty }}
                            rowClassName={() => "hover:!bg-bgBase transition-colors !text-textBase"}
                        />
                    </div>
                </Card>
            ) : (
                <ErrComp errorCode={error} className="mt-6" />
            )}

            <XuiServerFormDrawer
                open={drawerState.open}
                onClose={closeDrawer}
                mode={drawerState.mode}
                initialValues={drawerState.initialValues}
            />
        </div>
    );
};

export default XuiServersClient;
