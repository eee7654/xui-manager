"use client";

import { useCallback, useMemo, useState } from "react";
import { App, Button, Card, Flex, Input, Space, Table, Tag, Tooltip, Typography } from "antd";
import { useAtomValue } from "jotai";
import { Can } from "@casl/react";
import { abilityAtom } from "@/store/authAtom";
import { dictAtom } from "@/store/i18nAtom";
import * as CloudflareDnsService from "@/services/cloudflareDns.service";
import ErrComp from "@/components/ui/ErrComp";

const { TextArea } = Input;
const { Text } = Typography;

const splitIps = (value) => String(value || '')
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);

const CloudflareDnsClient = () => {
    const dict = useAtomValue(dictAtom);
    const ability = useAtomValue(abilityAtom);
    const { message } = App.useApp();
    const [drafts, setDrafts] = useState({});

    const { data, isLoading, isFetching, error, refetch } = CloudflareDnsService.useList();
    const { mutate: replaceRecords, isPending } = CloudflareDnsService.useReplace();

    const getDraftValue = useCallback((row) => {
        return drafts[row.hostname] ?? (row.ips || []).join('\n');
    }, [drafts]);

    const handleReplace = useCallback((row) => {
        replaceRecords({
            hostname: row.hostname,
            ips: splitIps(getDraftValue(row))
        }, {
            onSuccess: () => message.success(dict.cloudflareDns.actions.successUpdate)
        });
    }, [replaceRecords, getDraftValue, dict, message]);

    const columns = useMemo(() => [
        {
            title: dict.cloudflareDns.table.hostname,
            dataIndex: 'hostname',
            key: 'hostname',
            render: (hostname) => (
                <Flex vertical>
                    <span className="font-semibold text-textBase">{hostname}</span>
                    <span className="text-textMuted text-xs font-mono">A records</span>
                </Flex>
            )
        },
        {
            title: dict.cloudflareDns.table.currentIps,
            dataIndex: 'ips',
            key: 'ips',
            width: 260,
            render: (ips = []) => (
                <Space size={[4, 4]} wrap className="max-w-[260px] whitespace-normal">
                    {ips.length ? ips.map(ip => (
                        <Tag key={ip} className="!rounded-md border-none !bg-bgBase !text-textBase font-mono !me-0">
                            {ip}
                        </Tag>
                    )) : <Text className="text-textMuted">-</Text>}
                </Space>
            )
        },
        {
            title: dict.cloudflareDns.table.newIps,
            key: 'newIps',
            render: (_, row) => (
                <TextArea
                    value={getDraftValue(row)}
                    onChange={(event) => setDrafts(prev => ({ ...prev, [row.hostname]: event.target.value }))}
                    placeholder={dict.cloudflareDns.form.ipsPlaceholder}
                    autoSize={{ minRows: 3, maxRows: 7 }}
                    className="!bg-bgBase !border-borderColor !text-textBase"
                />
            )
        },
        {
            title: dict.common.actions,
            key: 'actions',
            align: 'center',
            render: (_, row) => (
                <Can I="update" a="CloudflareDns" ability={ability}>
                    <Tooltip title={dict.cloudflareDns.actions.replace}>
                        <Button
                            type="primary"
                            loading={isPending}
                            icon={<i className="bi bi-cloud-upload" />}
                            onClick={() => handleReplace(row)}
                        >
                            {dict.cloudflareDns.actions.replace}
                        </Button>
                    </Tooltip>
                </Can>
            )
        }
    ], [dict, ability, isPending, getDraftValue, handleReplace]);

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
                                <span className="text-textBase text-lg font-bold">{dict.cloudflareDns.pageTitle}</span>
                                <span className="text-textMuted text-sm mt-1 font-normal">{dict.cloudflareDns.header.desc}</span>
                            </Flex>
                            <Button
                                icon={<i className="bi bi-arrow-clockwise" />}
                                onClick={() => refetch()}
                                loading={isFetching}
                            >
                                {dict.common.refresh}
                            </Button>
                        </Flex>
                    }
                >
                    <div className="content-wrap p-4">
                        <Table
                            className="custom-table"
                            columns={columns}
                            dataSource={data?.data || []}
                            rowKey="hostname"
                            loading={isLoading || isFetching}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                            locale={{ emptyText: dict.cloudflareDns.empty }}
                        />
                    </div>
                </Card>
            ) : (
                <ErrComp errorCode={error} className="mt-6" />
            )}
        </div>
    );
};

export default CloudflareDnsClient;
