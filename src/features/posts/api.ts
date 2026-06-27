import { baseApi } from '@/shared/api/baseApi';

import type { CreatePostBody, GetPostsParams, Post } from './types';

const postsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Получить список постов.
     */
    getPosts: builder.query<Post[], GetPostsParams | void>({
      query: (params) => ({
        url: 'posts',
        method: 'GET',
        params: { _limit: params?.limit ?? 10 },
      }),
      providesTags: ['Posts'],
    }),
    /**
     * Получить пост по идентификатору.
     */
    getPost: builder.query<Post, number>({
      query: (id) => ({
        url: `posts/${id}`,
        method: 'GET',
      }),
      providesTags: ['Posts'],
    }),
    /**
     * Создать новый пост.
     */
    addPost: builder.mutation<Post, CreatePostBody>({
      query: (body) => ({
        url: 'posts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Posts'],
    }),
    /**
     * Удалить пост по идентификатору.
     */
    deletePost: builder.mutation<void, number>({
      query: (id) => ({
        url: `posts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Posts'],
    }),
  }),
});

export const { useGetPostsQuery, useGetPostQuery, useAddPostMutation, useDeletePostMutation } = postsApi;
