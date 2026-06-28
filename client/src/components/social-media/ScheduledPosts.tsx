import { useState } from "react";
import { Calendar, Clock, Image, MessageSquare, Share2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ScheduledPost {
  id: string;
  title: string;
  content: string;
  image: string;
  scheduledDate: string;
  scheduledTime: string;
  status: "scheduled" | "published" | "failed";
  estimatedReach: number;
  estimatedEngagement: number;
}

const mockScheduledPosts: ScheduledPost[] = [
  {
    id: "1",
    title: "Novo Produto Lançamento",
    content: "Confira nosso novo produto revolucionário! #inovação #tecnologia",
    image: "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&h=500&fit=crop",
    scheduledDate: "2026-04-10",
    scheduledTime: "14:00",
    status: "scheduled",
    estimatedReach: 2500,
    estimatedEngagement: 180,
  },
  {
    id: "2",
    title: "Dica de Produtividade",
    content: "5 dicas para aumentar sua produtividade no trabalho #dicas #produtividade",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
    scheduledDate: "2026-04-12",
    scheduledTime: "10:00",
    status: "scheduled",
    estimatedReach: 1800,
    estimatedEngagement: 120,
  },
  {
    id: "3",
    title: "Webinar Gratuito",
    content: "Participe do nosso webinar sobre transformação digital! #webinar #digital",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
    scheduledDate: "2026-04-15",
    scheduledTime: "16:00",
    status: "scheduled",
    estimatedReach: 3200,
    estimatedEngagement: 250,
  },
];

export function ScheduledPosts() {
  const [posts, setPosts] = useState<ScheduledPost[]>(mockScheduledPosts);
  const [showForm, setShowForm] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    scheduledDate: "",
    scheduledTime: "",
  });

  const handleAddPost = () => {
    if (
      formData.title &&
      formData.content &&
      formData.scheduledDate &&
      formData.scheduledTime
    ) {
      const newPost: ScheduledPost = {
        id: Date.now().toString(),
        title: formData.title,
        content: formData.content,
        image: "https://images.unsplash.com/photo-1557821552-17105176677c?w=500&h=500&fit=crop",
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        status: "scheduled",
        estimatedReach: Math.floor(Math.random() * 3000) + 1000,
        estimatedEngagement: Math.floor(Math.random() * 300) + 50,
      };

      setPosts([...posts, newPost]);
      setFormData({
        title: "",
        content: "",
        scheduledDate: "",
        scheduledTime: "",
      });
      setShowForm(false);
    }
  };

  const handleDeletePost = (id: string) => {
    setPosts(posts.filter((post) => post.id !== id));
  };

  const getFilteredPosts = () => {
    let filtered = posts.filter((p) => p.status === "scheduled");
    const now = new Date();
    
    if (filterPeriod === 'week') {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => {
        const postDate = new Date(`${p.scheduledDate}T${p.scheduledTime}`);
        return postDate >= now && postDate <= weekFromNow;
      });
    } else if (filterPeriod === 'month') {
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => {
        const postDate = new Date(`${p.scheduledDate}T${p.scheduledTime}`);
        return postDate >= now && postDate <= monthFromNow;
      });
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime}`);
      const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime}`);
      return dateA.getTime() - dateB.getTime();
    });
  };
  
  const upcomingPosts = getFilteredPosts();

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Posts Agendados</h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agendar Novo Post
        </Button>
      </div>

      {/* Filtro de Período */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => setFilterPeriod('all')}
          variant={filterPeriod === 'all' ? 'default' : 'outline'}
          className={filterPeriod === 'all' ? 'bg-blue-600' : ''}
        >
          Todos
        </Button>
        <Button
          onClick={() => setFilterPeriod('week')}
          variant={filterPeriod === 'week' ? 'default' : 'outline'}
          className={filterPeriod === 'week' ? 'bg-blue-600' : ''}
        >
          Próxima Semana
        </Button>
        <Button
          onClick={() => setFilterPeriod('month')}
          variant={filterPeriod === 'month' ? 'default' : 'outline'}
          className={filterPeriod === 'month' ? 'bg-blue-600' : ''}
        >
          Próximo Mês
        </Button>
      </div>

      {/* Formulário de Novo Post */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Agendar Novo Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Título</label>
              <Input
                placeholder="Título do post"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Conteúdo</label>
              <textarea
                placeholder="Conteúdo do post"
                className="w-full p-2 border rounded-lg"
                rows={4}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data</label>
                <Input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Hora</label>
                <Input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledTime: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddPost}
                className="bg-green-600 hover:bg-green-700"
              >
                Agendar
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Posts Agendados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Posts Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingPosts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Próximos a serem publicados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Alcance Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {upcomingPosts
                .reduce((sum, p) => sum + p.estimatedReach, 0)
                .toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de todos os posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Engajamento Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {upcomingPosts
                .reduce((sum, p) => sum + p.estimatedEngagement, 0)
                .toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Curtidas + comentários</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Posts Agendados */}
      <div className="space-y-4">
        {upcomingPosts.map((post) => (
          <Card key={post.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex gap-4">
                {/* Imagem */}
                <div className="w-48 h-48 flex-shrink-0">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{post.content}</p>

                    {/* Métricas */}
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-muted-foreground" />
                        <span>Alcance: {post.estimatedReach.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span>Engajamento: {post.estimatedEngagement}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(post.scheduledDate).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.scheduledTime}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600"
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Deletar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {upcomingPosts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {filterPeriod === 'week'
                ? 'Nenhum post agendado para a próxima semana'
                : filterPeriod === 'month'
                  ? 'Nenhum post agendado para o próximo mês'
                  : 'Nenhum post agendado'}
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Agendar Primeiro Post
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
