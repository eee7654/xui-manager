import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/lib/api-service';

export const XUI_SERVER_KEYS = {
    all: ['xui-servers'],
    lists: () => [...XUI_SERVER_KEYS.all, 'list'],
    list: (filters) => [...XUI_SERVER_KEYS.lists(), filters],
    lookup: () => [...XUI_SERVER_KEYS.all, 'lookup'],
    details: () => [...XUI_SERVER_KEYS.all, 'detail'],
    detail: (id) => [...XUI_SERVER_KEYS.details(), id],
};

export const useList = (filters) => {
    return useQuery({
        queryKey: XUI_SERVER_KEYS.list(filters),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/xui-servers',
            params: filters
        }),
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
    });
};

export const useLookup = (filters, options = {}) => {
    return useQuery({
        queryKey: XUI_SERVER_KEYS.lookup(),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/xui-servers/lookup',
            params: filters
        }),
        enabled: options.enabled ?? true,
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
    });
};

export const useCreate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (serverData) => fetcher({
            method: 'POST',
            url: '/api/v1/panel/xui-servers',
            data: serverData
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: XUI_SERVER_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: XUI_SERVER_KEYS.lookup() });
        }
    });
};

export const useUpdate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...serverData }) => fetcher({
            method: 'PATCH',
            url: `/api/v1/panel/xui-servers/${id}`,
            data: serverData
        }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: XUI_SERVER_KEYS.lists() });
            queryClient.invalidateQueries({ queryKey: XUI_SERVER_KEYS.lookup() });
            queryClient.invalidateQueries({ queryKey: XUI_SERVER_KEYS.detail(variables.id) });
        }
    });
};
