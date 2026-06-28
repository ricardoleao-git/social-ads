import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (account: {
    username: string;
    displayName: string;
    followers: number;
    category: string;
  }) => void;
}

export default function AddAccountModal({
  isOpen,
  onClose,
  onAdd,
}: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    followers: 0,
    category: "Negócios",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.username && formData.displayName) {
      onAdd(formData);
      setFormData({
        username: "",
        displayName: "",
        followers: 0,
        category: "Negócios",
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Adicionar Perfil</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Nome de Usuário
            </label>
            <Input
              type="text"
              placeholder="@seu_usuario"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Nome de Exibição
            </label>
            <Input
              type="text"
              placeholder="Seu Nome"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Seguidores
            </label>
            <Input
              type="number"
              placeholder="0"
              value={formData.followers}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  followers: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Categoria
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Negócios</option>
              <option>Tecnologia</option>
              <option>Agência</option>
              <option>E-commerce</option>
              <option>Pessoal</option>
              <option>Outro</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Adicionar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
