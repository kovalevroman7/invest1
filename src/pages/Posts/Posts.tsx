import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetPostsQuery } from '@/features/posts';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'];

export const Posts = () => {
  const { data: posts, isLoading, isError, isFetching, refetch } = useGetPostsQuery({ limit: 6 });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Посты</h1>
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Обновить
        </Button>
      </div>

      {isError && <p className="text-destructive">Не удалось загрузить посты.</p>}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {SKELETON_KEYS.map((key) => (
            <Skeleton
              key={key}
              className="h-28 w-full"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts?.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle className="line-clamp-1 capitalize">{post.title}</CardTitle>
                <CardDescription>Пост #{post.id}</CardDescription>
              </CardHeader>
              <CardContent className="line-clamp-3 text-sm text-muted-foreground">{post.body}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
