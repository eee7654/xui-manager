import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/lib/api-service';

export const CLOUDFLARE_BAN_KEYS = {
    all: ['cloudflare-bans'],
    lists: () => [...CLOUDFLARE_BAN_KEYS.all, 'list'],
    list: (filters) => [...CLOUDFLARE_BAN_KEYS.lists(), filters],
};

export const useList = (filters) => {
    return useQuery({
        queryKey: CLOUDFLARE_BAN_KEYS.list(filters),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/cloudflare-bans',
            params: filters
        }),
        placeholderData: (prev) => prev,
        staleTime: 30 * 1000,
    });
};

export const useSync = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => fetcher({
            method: 'POST',
            url: '/api/v1/panel/cloudflare-bans/sync'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CLOUDFLARE_BAN_KEYS.lists() });
        }
    });
};

export const useClear = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => fetcher({
            method: 'POST',
            url: '/api/v1/panel/cloudflare-bans/clear'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CLOUDFLARE_BAN_KEYS.lists() });
        }
    });
};
