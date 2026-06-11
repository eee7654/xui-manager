"use client";

import { useEffect } from "react";
import { Drawer, Form, Input, InputNumber, Button, Switch, Space, Select, App, Segmented } from "antd";
import { useAtomValue } from "jotai";
import { abilityAtom } from "@/store/authAtom";
import { dictAtom, dirAtom, langAtom } from "@/store/i18nAtom";
import { themeAtom } from "@/store/themeAtom";
import * as XuiClientService from "@/services/xuiClients.service";
import * as XuiServerService from "@/services/xuiServers.service";
import { Datepicker } from "@ijavad805/react-datepicker";
import moment from "jalali-moment";
import { convertEmojiShortcodes } from "@/lib/emoji";

const bytesToGb = (value) => Math.round(Number(value || 0) / 1024 / 1024 / 1024);
const dayMs = 24 * 60 * 60 * 1000;

const getExpiryInitialValues = (expiryTime) => {
    const value = Number(expiryTime || 0);
    if (value < 0) {
        return {
            expiry_mode: 'first_use',
            first_use_days: Math.ceil(Math.abs(value) / dayMs),
            expiry_time: 0
        };
    }
    if (value > 0) {
        return {
            expiry_mode: 'date',
            first_use_days: 0,
            expiry_time: value
        };
    }
    return {
        expiry_mode: 'unlimited',
        first_use_days: 0,
        expiry_time: 0
    };
};

// emoji helpers available via @/lib/emoji

const ExpiryDatePicker = ({ value, onChange, lang, themeMode, placeholder }) => {
    const dateValue = value ? moment(Number(value)).locale(lang) : undefined;
    return (
        <Datepicker
            lang={lang === 'fa' ? 'fa' : 'en'}
            theme="blue"
            modeTheme={themeMode === 'dark' ? 'dark' : 'light'}
            adjustPosition="modal"
            closeWhenSelectADay
            allowClear
            format="YYYY/MM/DD"
            value={dateValue}
            input={<Input className="!bg-bgBase" placeholder={placeholder} readOnly />}
            onChange={(selectedDate) => {
                onChange?.(selectedDate ? selectedDate.endOf('day').valueOf() : 0);
            }}
            onClear={() => onChange?.(0)}
        />
    );
};

const XuiClientFormDrawer = ({ open, onClose, initialValues, mode = "create" }) => {
    const dict = useAtomValue(dictAtom);
    const dir = useAtomValue(dirAtom);
    const lang = useAtomValue(langAtom);
    const themeMode = useAtomValue(themeAtom);
    const ability = useAtomValue(abilityAtom);
    const [form] = Form.useForm();
    const expiryMode = Form.useWatch('expiry_mode', form);
    const { message } = App.useApp();
    const canReadServers = ability.can('list', 'XuiServer');
    const canManageClients = ability.can('manage', 'XuiClient');
    const canCreateClients = ability.can('create', 'XuiClient');
    // allow seller users (who can create clients) to pick a server too
    const showServerSelect = mode === "create" && (canReadServers || canManageClients || canCreateClients);
    const { data: serversData } = XuiServerService.useLookup(null, { enabled: canReadServers || canManageClients || canCreateClients });
    const { mutate: createClient, isPending: isCreating } = XuiClientService.useCreate();
    const { mutate: updateClient, isPending: isUpdating } = XuiClientService.useUpdate();

    useEffect(() => {
        if (open) {
            const expiryValues = getExpiryInitialValues(initialValues?.expiryTime);
            form.setFieldsValue({
                enable: true,
                quota_gb: 0,
                limit_ip: 0,
                subId: '',
                ...expiryValues,
                ...initialValues,
                ...(initialValues && { quota_gb: bytesToGb(initialValues.totalGB) }),
                limit_ip: initialValues?.limitIp || 0,
                ...expiryValues
            });
        } else {
            form.resetFields();
        }
    }, [open, initialValues, form]);

    const onFinish = (values) => {
        const expiryMode = values.expiry_mode || 'unlimited';
        const expiryPayload = expiryMode === 'first_use'
            ? { first_use_days: Number(values.first_use_days || 0) }
            : { expiry_time: expiryMode === 'date' ? Number(values.expiry_time || 0) : 0 };
        const payload = {
            ...values,
            quota_gb: Number(values.quota_gb || 0),
            limit_ip: Number(values.limit_ip || 0),
            ...expiryPayload
        };
        delete payload.expiry_mode;
        if (expiryMode !== 'first_use') delete payload.first_use_days;
        if (mode === "edit") {
            updateClient({ server_id: initialValues.server_id, id: initialValues.id, ...payload }, {
                onSuccess: () => {
                    message.success(dict.xuiClients.actions.successEdit);
                    onClose();
                }
            });
        } else {
            createClient(payload, {
                onSuccess: () => {
                    message.success(dict.xuiClients.actions.successCreate);
                    onClose();
                }
            });
        }
    };

    return (
        <Drawer
            title={mode === "edit" ? dict.xuiClients.form.titleEdit : dict.xuiClients.form.titleCreate}
            size={520}
            placement={dir === 'rtl' ? 'left' : 'right'}
            onClose={onClose}
            open={open}
            classNames={{
                header: '!border-b !border-borderColor !bg-bgSurface',
                body: '!bg-bgSurface !p-6',
            }}
            extra={
                <Space>
                    <Button
                        onClick={() => form.submit()}
                        type="primary"
                        loading={isCreating || isUpdating}
                    >
                        {dict.xuiClients.form.submit}
                    </Button>
                </Space>
            }
        >
            <Form layout="vertical" form={form} onFinish={onFinish}>
                {showServerSelect && (
                    <Form.Item name="server_id" label={dict.xuiClients.form.server}>
                        <Select
                            allowClear
                            className="!bg-bgBase"
                            placeholder={dict.xuiClients.form.autoServer}
                            options={(serversData?.data || []).map(server => ({
                                value: server.id,
                                label: (
                                    <div className="flex items-center">
                                        <span className="me-2">{convertEmojiShortcodes(server.name)}</span>
                                        <span className="text-textMuted">{` - #${server.inbound_id}`}</span>
                                    </div>
                                )
                            }))}
                        />
                    </Form.Item>
                )}

                <Form.Item
                    name="email"
                    label={dict.xuiClients.form.email}
                    rules={[{ required: true, message: dict.validation.required }]}
                >
                    <Input className="!bg-bgBase" placeholder="client-name" disabled={mode === "edit"} />
                </Form.Item>

                <Form.Item name="subId" label={dict.xuiClients.form.subId}>
                    <Input className="!bg-bgBase" placeholder={dict.xuiClients.form.autoSubId} />
                </Form.Item>

                {mode === "create" && canManageClients && (
                    <Form.Item name="owner_username" label={dict.xuiClients.form.ownerUsername}>
                        <Input className="!bg-bgBase" placeholder="seller username" />
                    </Form.Item>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item name="quota_gb" label={dict.xuiClients.form.quotaGb}>
                        <InputNumber className="!w-full !bg-bgBase" min={0} />
                    </Form.Item>

                    <Form.Item name="limit_ip" label={dict.xuiClients.form.limitIp}>
                        <InputNumber className="!w-full !bg-bgBase" min={0} />
                    </Form.Item>
                </div>

                <Form.Item name="expiry_mode" label={dict.xuiClients.form.expiryMode}>
                    <Segmented
                        className="!bg-bgBase"
                        options={[
                            { label: dict.xuiClients.form.expiryUnlimited, value: 'unlimited' },
                            { label: dict.xuiClients.form.expiryDate, value: 'date' },
                            { label: dict.xuiClients.form.expiryFirstUse, value: 'first_use' }
                        ]}
                    />
                </Form.Item>

                {expiryMode === 'date' && (
                    <Form.Item name="expiry_time" label={dict.xuiClients.form.expiryTime}>
                        <ExpiryDatePicker
                            lang={lang}
                            themeMode={themeMode}
                            placeholder={dict.xuiClients.form.expiryDatePlaceholder}
                        />
                    </Form.Item>
                )}

                {expiryMode === 'first_use' && (
                    <Form.Item
                        name="first_use_days"
                        label={dict.xuiClients.form.firstUseDays}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <InputNumber className="!w-full !bg-bgBase" min={1} />
                    </Form.Item>
                )}

                <Form.Item name="flow" label={dict.xuiClients.form.flow}>
                    <Input className="!bg-bgBase" placeholder="xtls-rprx-vision" />
                </Form.Item>

                <Form.Item name="tgId" label={dict.xuiClients.form.telegramId}>
                    <Input className="!bg-bgBase" />
                </Form.Item>

                <Form.Item name="enable" label={dict.xuiClients.form.enable} valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Drawer>
    );
};

export default XuiClientFormDrawer;
