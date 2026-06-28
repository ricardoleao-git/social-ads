import { useState, useCallback } from "react";
import { AccountProfile } from "@/lib/social-media/multiAccountData";

export function useAccountStorage() {
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);

  const addAccount = useCallback((account: AccountProfile) => {
    setAccounts((prev) => [...prev, account]);
  }, []);

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAccount = useCallback((id: string, updates: Partial<AccountProfile>) => {
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  }, []);

  return { accounts, addAccount, removeAccount, updateAccount };
}
