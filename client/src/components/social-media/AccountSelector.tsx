import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown } from "lucide-react";
import { AccountProfile, accountProfiles } from "@/lib/social-media/multiAccountData";

interface AccountSelectorProps {
  selectedAccount: AccountProfile;
  onAccountChange: (account: AccountProfile) => void;
  onAddAccount?: () => void;
}

export default function AccountSelector({
  selectedAccount,
  onAccountChange,
  onAddAccount,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 transition-colors"
      >
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900">
            {selectedAccount.displayName}
          </p>
          <p className="text-xs text-gray-600">{selectedAccount.username}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 p-2 shadow-lg">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {accountProfiles.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  onAccountChange(account);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedAccount.id === account.id
                    ? "bg-blue-50 border-l-4 border-blue-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {account.displayName}
                </p>
                <p className="text-xs text-gray-600">{account.username}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{account.followers.toLocaleString("pt-BR")} seguidores</span>
                  <span>{account.engagement}% engajamento</span>
                </div>
              </button>
            ))}

            {onAddAccount && (
              <>
                <div className="border-t border-gray-200 my-2" />
                <button
                  onClick={() => {
                    onAddAccount();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-semibold">Adicionar Perfil</span>
                </button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
