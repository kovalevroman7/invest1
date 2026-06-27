import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Базовый API-слайс RTK Query.
 *
 * Эндпоинты подключаются к нему через `baseApi.injectEndpoints(...)` в фичах
 * (см. `src/features/*`). Сюда же добавляются `tagTypes` для инвалидации кэша.
 */
export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'https://jsonplaceholder.typicode.com',
  }),
  tagTypes: ['Posts'],
  endpoints: () => ({}),
});
