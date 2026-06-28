interface AdvancedFiltersProps {
  onFilterChange?: (filters: Record<string, unknown>) => void;
  onReset?: () => void;
}
export default function AdvancedFilters({ onFilterChange, onReset }: AdvancedFiltersProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-muted-foreground">Filtros avançados em desenvolvimento</p>
    </div>
  );
}
