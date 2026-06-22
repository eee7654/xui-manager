import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/lib/api-service';

export const XUI_CLIENT_KEYS = {
    all: ['xui-clients'],
    lists: () => [...XUI_CLIENT_KEYS.all, 'list'],
    list: (filters) => [...XUI_CLIENT_KEYS.lists(), filters],
    stats: (filters) => [...XUI_CLIENT_KEYS.all, 'stats', filters],
    details: () => [...XUI_CLIENT_KEYS.all, 'detail'],
    detail: (serverId, clientId) => [...XUI_CLIENT_KEYS.details(), serverId, clientId],
};

export const useList = (filters) => {
    return useQuery({
        queryKey: XUI_CLIENT_KEYS.list(filters),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/xui-clients',
            params: filters
        }),
        placeholderData: (prev) => prev,
        staleTime: 60 * 1000,
    });
};

export const useStats = (filters) => {
    return useQuery({
        queryKey: XUI_CLIENT_KEYS.stats(filters),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/xui-clients/stats',
            params: filters
        }),
        staleTime: 60 * 1000,
    });
};

export const useRunAccounting = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => fetcher({
            method: 'POST',
            url: '/api/v1/panel/xui-clients/usage/run'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...XUI_CLIENT_KEYS.all, 'stats'] });
        }
    });
};
export const useCreate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (clientData) => fetcher({
            method: 'POST',
            url: '/api/v1/panel/xui-clients',
            data: clientData
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: XUI_CLIENT_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: [...XUI_CLIENT_KEYS.all, 'stats'] });
        }
    });
};

export const useUpdate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ server_id, id, ...clientData }) => fetcher({
            method: 'PATCH',
            url: `/api/v1/panel/xui-clients/${server_id}/${id}`,
            data: clientData
        }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: XUI_CLIENT_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: [...XUI_CLIENT_KEYS.all, 'stats'] });
            queryClient.invalidateQueries({ queryKey: XUI_CLIENT_KEYS.detail(variables.server_id, variables.id) });
        }
    });
};

export const useDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ server_id, id }) => fetcher({
            method: 'DELETE',
            url: `/api/v1/panel/xui-clients/${server_id}/${id}`
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: XUI_CLIENT_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: [...XUI_CLIENT_KEYS.all, 'stats'] });
        }
    });
};

export const useResetTraffic = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ server_id, id }) => fetcher({
            method: 'POST',
            url: `/api/v1/panel/xui-clients/${server_id}/${id}/reset-traffic`
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: XUI_CLIENT_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: [...XUI_CLIENT_KEYS.all, 'stats'] });
        }
    });
};
