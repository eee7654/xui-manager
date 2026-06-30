"use client";

import { useEffect } from "react";
import { Drawer, Form, Input, InputNumber, Button, Switch, Space, App, Divider, Segmented } from "antd";
import { useAtomValue } from "jotai";
import { dictAtom, dirAtom } from "@/store/i18nAtom";
import * as XuiServerService from "@/services/xuiServers.service";

const XuiServerFormDrawer = ({ open, onClose, initialValues, mode = "create" }) => {
    const dict = useAtomValue(dictAtom);
    const dir = useAtomValue(dirAtom);
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const apiMode = Form.useWatch('api_mode', form);
    const { mutate: createServer, isPending: isCreating } = XuiServerService.useCreate();
    const { mutate: updateServer, isPending: isUpdating } = XuiServerService.useUpdate();

    useEffect(() => {
        if (open) {
            form.setFieldsValue({
                panel_ssl: true,
                api_mode: mode === 'create' ? 'token_v3' : 'legacy_session',
                panel_path: '/',
                max_clients: 0,
                is_active: true,
                comment_key: '@',
                connect_timeout_ms: 15000,
                ...initialValues,
                password: '',
                api_token: '',
                cloudflare_clearance: ''
            });
        } else {
            form.resetFields();
        }
    }, [open, initialValues, form, mode]);

    const onFinish = (values) => {
        const payload = {
            ...values,
            panel_port: values.panel_port || null,
            subscription_port: values.subscription_port || null,
            max_clients: Number(values.max_clients || 0),
            inbound_id: Number(values.inbound_id),
            connect_timeout_ms: Number(values.connect_timeout_ms || 15000)
        };
        if (mode === "edit") {
            updateServer({ id: initialValues.id, ...payload }, {
                onSuccess: () => {
                    message.success(dict.xuiServers.actions.successEdit);
                    onClose();
                }
            });
        } else {
            createServer(payload, {
                onSuccess: () => {
                    message.success(dict.xuiServers.actions.successCreate);
                    onClose();
                }
            });
        }
    };

    return (
        <Drawer
            title={mode === "edit" ? dict.xuiServers.form.titleEdit : dict.xuiServers.form.titleCreate}
            size={560}
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
                        className="!hover:opacity-[0.85]"
                        loading={isCreating || isUpdating}
                    >
                        {dict.xuiServers.form.submit}
                    </Button>
                </Space>
            }
        >
            <Form layout="vertical" form={form} onFinish={onFinish}>
                <Form.Item
                    name="name"
                    label={dict.xuiServers.form.name}
                    rules={[{ required: true, message: dict.validation.required }]}
                >
                    <Input className="!bg-bgBase" placeholder="Germany 01" />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item
                        name="panel_domain"
                        label={dict.xuiServers.form.panelDomain}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <Input className="!bg-bgBase" placeholder="panel.example.com" />
                    </Form.Item>

                    <Form.Item name="panel_port" label={dict.xuiServers.form.panelPort}>
                        <InputNumber className="!w-full !bg-bgBase" min={1} max={65535} placeholder="443" />
                    </Form.Item>

                    <Form.Item name="subscription_port" label={dict.xuiServers.form.subscriptionPort}>
                        <InputNumber className="!w-full !bg-bgBase" min={1} max={65535} placeholder="2096" />
                    </Form.Item>

                    <Form.Item
                        name="panel_path"
                        label={dict.xuiServers.form.panelPath}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <Input className="!bg-bgBase" placeholder="/xui/" />
                    </Form.Item>

                    <Form.Item name="panel_ssl" label={dict.xuiServers.form.panelSsl} valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </div>

                <Divider className="!border-borderColor" />

                <Form.Item name="api_mode" label={dict.xuiServers.form.apiMode}>
                    <Segmented
                        block
                        options={[
                            { label: dict.xuiServers.form.apiModeToken, value: 'token_v3' },
                            { label: dict.xuiServers.form.apiModeLegacy, value: 'legacy_session' }
                        ]}
                    />
                </Form.Item>

                {apiMode === 'token_v3' ? (
                    <Form.Item
                        name="api_token"
                        label={dict.xuiServers.form.apiToken}
                        rules={mode === 'create' || !initialValues?.has_api_token
                            ? [{ required: true, message: dict.validation.required }]
                            : []}
                    >
                        <Input.Password
                            className="!bg-bgBase"
                            placeholder={mode === 'edit' ? dict.xuiServers.form.keepApiToken : undefined}
                        />
                    </Form.Item>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <Form.Item
                            name="username"
                            label={dict.xuiServers.form.username}
                            rules={[{ required: true, message: dict.validation.required }]}
                        >
                            <Input className="!bg-bgBase" />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label={dict.xuiServers.form.password}
                            rules={mode === 'create' || !initialValues?.has_password
                                ? [{ required: true, message: dict.validation.required }]
                                : []}
                        >
                            <Input.Password className="!bg-bgBase" placeholder={mode === 'edit' ? dict.xuiServers.form.keepPassword : undefined} />
                        </Form.Item>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item
                        name="inbound_id"
                        label={dict.xuiServers.form.inboundId}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <InputNumber className="!w-full !bg-bgBase" min={1} />
                    </Form.Item>

                    <Form.Item name="inbound_tag" label={dict.xuiServers.form.inboundTag}>
                        <Input className="!bg-bgBase" placeholder="vmess-tcp" />
                    </Form.Item>

                    <Form.Item
                        name="max_clients"
                        label={dict.xuiServers.form.maxClients}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <InputNumber className="!w-full !bg-bgBase" min={0} />
                    </Form.Item>

                    <Form.Item
                        name="comment_key"
                        label={dict.xuiServers.form.commentKey}
                        rules={[{ required: true, message: dict.validation.required }]}
                    >
                        <Input className="!bg-bgBase" placeholder="@" />
                    </Form.Item>
                </div>

                <Divider className="!border-borderColor" />

                <Form.Item name="cloudflare_clearance" label={dict.xuiServers.form.cloudflareClearance}>
                    <Input.TextArea className="!bg-bgBase" rows={3} placeholder="cf_clearance=..." />
                </Form.Item>

                <Form.Item name="cloudflare_user_agent" label={dict.xuiServers.form.cloudflareUserAgent}>
                    <Input className="!bg-bgBase" placeholder="Mozilla/5.0 ..." />
                </Form.Item>

                <Form.Item name="proxy_url" label={dict.xuiServers.form.proxyUrl}>
                    <Input className="!bg-bgBase" placeholder="http://user:pass@host:port" />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item name="connect_timeout_ms" label={dict.xuiServers.form.timeoutMs}>
                        <InputNumber className="!w-full !bg-bgBase" min={1000} step={1000} />
                    </Form.Item>

                    <Form.Item name="is_active" label={dict.xuiServers.form.isActive} valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </div>
            </Form>
        </Drawer>
    );
};

export default XuiServerFormDrawer;
