import { TrendingUp, Heart, MessageCircle, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Post {
  id: string;
  title: string;
  content: string;
  image: string;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  date: string;
}

export function TopMoments({ posts }: { posts: Post[] }) {
  // Ordenar posts por engajamento
  const topPosts = [...posts]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Melhores Momentos</h2>
      </div>

      {topPosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum post disponível</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {topPosts.map((post, index) => (
            <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="flex gap-4">
                  {/* Imagem */}
                  <div className="w-40 h-40 flex-shrink-0 relative">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge de Ranking */}
                    <div className="absolute top-2 left-2 bg-blue-600 text-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                        {post.content}
                      </p>

                      {/* Métricas */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Curtidas</p>
                            <p className="font-semibold">{post.likes.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Comentários</p>
                            <p className="font-semibold">{post.comments.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-green-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Compartilhamentos</p>
                            <p className="font-semibold">{post.shares.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Taxa de Engajamento */}
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Taxa de Engajamento
                          </span>
                          <span className="text-lg font-bold text-blue-600">
                            {post.engagementRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(post.engagementRate * 5, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rodapé */}
                    <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                      Publicado em {new Date(post.date).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo de Engajamento */}
      {topPosts.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Média de Engajamento</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(
                    topPosts.reduce((sum, p) => sum + p.engagementRate, 0) /
                    topPosts.length
                  ).toFixed(1)}
                  %
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Total de Interações</p>
                <p className="text-2xl font-bold text-purple-600">
                  {topPosts
                    .reduce((sum, p) => sum + p.likes + p.comments + p.shares, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
