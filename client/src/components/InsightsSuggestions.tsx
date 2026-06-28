interface InsightsSuggestionsProps {
  insights?: Array<{ id: string; title: string; description: string; type: string }>;
}
export default function InsightsSuggestions({ insights = [] }: InsightsSuggestionsProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Sugestões de IA</h3>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma sugestão disponível</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((i) => (
            <li key={i.id} className="text-sm text-gray-700">{i.title}: {i.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
