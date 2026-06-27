export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface GetPostsParams {
  limit?: number;
}

export type CreatePostBody = Pick<Post, 'title' | 'body' | 'userId'>;
