// src/lib/api-server.js
import axios from 'axios';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const IS_MULTI_ORG = process.env.NEXT_PUBLIC_IS_MULTI_ORG === 'true';

export const apiServer = async () => {
    const cookieStore = await cookies();
    const api = axios.create({
        baseURL: API_URL,
    });
    const sessionCookie = 
        cookieStore.get('better-auth.session_token') || 
        cookieStore.get('__Secure-better-auth.session_token');
    if (sessionCookie) {
        api.defaults.headers.common['Cookie'] = `${sessionCookie.name}=${sessionCookie.value}`;
    }
    const activeOrgId = cookieStore.get('active_org_id');
    if (IS_MULTI_ORG && activeOrgId) {
        api.defaults.headers.common['x-org-id'] = activeOrgId.value;
    }
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            const backendError = error.response?.data;
            error.customCode = backendError?.errorCode || 'UNKNOWN_ERROR';
            error.customMessage = backendError?.message || error.message;
            if (error.response?.status === 401) {
                console.warn('⚠️ Server-API: Unauthorized access detected (401).');
            }
            return Promise.reject(error);
        }
    );
    return api;
};
