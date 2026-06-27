import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * API-слайс для MOEX ISS (https://iss.moex.com/iss).
 *
 * Это отдельный хост от основного `baseApi`, поэтому вынесен в собственный слайс.
 * Эндпоинты подключаются через `moexApi.injectEndpoints(...)` в фичах (`src/features/*`).
 */
export const moexApi = createApi({
  reducerPath: 'moexApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://iss.moex.com/iss/',
  }),
  endpoints: () => ({}),
});
