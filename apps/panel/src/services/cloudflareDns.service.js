import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/lib/api-service';

export const CLOUDFLARE_DNS_KEYS = {
    all: ['cloudflare-dns'],
    list: () => [...CLOUDFLARE_DNS_KEYS.all, 'list'],
};

export const useList = () => {
    return useQuery({
        queryKey: CLOUDFLARE_DNS_KEYS.list(),
        queryFn: () => fetcher({
            method: 'GET',
            url: '/api/v1/panel/cloudflare-dns'
        }),
        staleTime: 30 * 1000,
    });
};

export const useReplace = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ hostname, ips }) => fetcher({
            method: 'PUT',
            url: '/api/v1/panel/cloudflare-dns',
            data: { hostname, ips }
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CLOUDFLARE_DNS_KEYS.list() });
        }
    });
};
