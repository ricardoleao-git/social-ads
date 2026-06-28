import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Comment {
  id: string;
  text: string;
  author: string;
  sentiment: "positive" | "neutral" | "negative";
  likes: number;
  date: string;
}

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

const COLORS = {
  positive: "#10b981",
  neutral: "#6b7280",
  negative: "#ef4444",
};

export function SentimentAnalysis({ comments }: { comments: Comment[] }) {
  const sentimentData = calculateSentiment(comments);
  const sentimentTrend = calculateSentimentTrend(comments);

  return (
    <div className="space-y-6">
      {/* Resumo de Sentimento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Positivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {sentimentData.positive}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((sentimentData.positive / 100) * comments.length)} comentários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Neutros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">
              {sentimentData.neutral}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((sentimentData.neutral / 100) * comments.length)} comentários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Negativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {sentimentData.negative}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((sentimentData.negative / 100) * comments.length)} comentários
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Distribuição */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Sentimento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: "Positivo", value: sentimentData.positive },
                  { name: "Neutro", value: sentimentData.neutral },
                  { name: "Negativo", value: sentimentData.negative },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill={COLORS.positive} />
                <Cell fill={COLORS.neutral} />
                <Cell fill={COLORS.negative} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tendência de Sentimento */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Sentimento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sentimentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="positive" fill={COLORS.positive} name="Positivo" />
              <Bar dataKey="neutral" fill={COLORS.neutral} name="Neutro" />
              <Bar dataKey="negative" fill={COLORS.negative} name="Negativo" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comentários Destacados */}
      <Card>
        <CardHeader>
          <CardTitle>Comentários Destacados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comments.slice(0, 5).map((comment) => (
              <div
                key={comment.id}
                className={`p-4 rounded-lg border-l-4 ${
                  comment.sentiment === "positive"
                    ? "border-green-500 bg-green-50"
                    : comment.sentiment === "neutral"
                      ? "border-gray-500 bg-gray-50"
                      : "border-red-500 bg-red-50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm">{comment.author}</p>
                    <p className="text-xs text-muted-foreground">{comment.date}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      comment.sentiment === "positive"
                        ? "bg-green-200 text-green-800"
                        : comment.sentiment === "neutral"
                          ? "bg-gray-200 text-gray-800"
                          : "bg-red-200 text-red-800"
                    }`}
                  >
                    {comment.sentiment === "positive"
                      ? "Positivo"
                      : comment.sentiment === "neutral"
                        ? "Neutro"
                        : "Negativo"}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.text}</p>
                <p className="text-xs text-muted-foreground mt-2">❤️ {comment.likes} curtidas</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function calculateSentiment(comments: Comment[]): SentimentData {
  const total = comments.length;
  const positive = comments.filter((c) => c.sentiment === "positive").length;
  const negative = comments.filter((c) => c.sentiment === "negative").length;
  const neutral = total - positive - negative;

  return {
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100),
  };
}

function calculateSentimentTrend(comments: Comment[]) {
  const uniqueDates = new Set(comments.map((c) => c.date));
  const dates = Array.from(uniqueDates).sort();

  return dates.map((date) => {
    const dayComments = comments.filter((c) => c.date === date);
    const positive = dayComments.filter((c) => c.sentiment === "positive").length;
    const negative = dayComments.filter((c) => c.sentiment === "negative").length;
    const neutral = dayComments.length - positive - negative;

    return {
      date,
      positive,
      neutral,
      negative,
    };
  });
}
