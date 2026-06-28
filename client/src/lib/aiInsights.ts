export interface AIInsight {
  id: string;
  type: 'tip' | 'warning' | 'opportunity';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}
export const generateInsights = async (_data: unknown): Promise<AIInsight[]> => {
  return [
    { id: '1', type: 'opportunity', title: 'Melhor horário para posts', description: 'Poste entre 18h-20h para maior engajamento.', impact: 'high' },
    { id: '2', type: 'tip', title: 'Use mais hashtags', description: 'Posts com 5-10 hashtags têm 30% mais alcance.', impact: 'medium' },
  ];
};
export const AIInsightsService = {
  generateAccountInsights: (_data: unknown): AIInsight[] => [
    { id: '1', type: 'opportunity' as const, title: 'Melhor horário para posts', description: 'Poste entre 18h-20h para maior engajamento.', impact: 'high' as const },
    { id: '2', type: 'tip' as const, title: 'Use mais hashtags', description: 'Posts com 5-10 hashtags têm 30% mais alcance.', impact: 'medium' as const },
  ],
  generateInsights,
};

export default { generateInsights, AIInsightsService };
