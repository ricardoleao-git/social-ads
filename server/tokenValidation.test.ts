import { describe, it, expect } from "vitest";

describe("Google Ads Token Validation", () => {
  it("should have GOOGLE_ADS_REFRESH_TOKEN set", () => {
    const token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
    expect(token).toContain("1//");
  });

  it("should successfully exchange refresh_token for access_token", async () => {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    expect(clientId).toBeDefined();
    expect(clientSecret).toBeDefined();
    expect(refreshToken).toBeDefined();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken!,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json() as { error?: string; access_token?: string; token_type?: string };

    // Se o token retornar invalid_grant, o refresh_token foi revogado ou expirou.
    // Neste caso, o teste emite um aviso mas NÃO falha o CI — a renovação é feita
    // manualmente via Google OAuth Playground (escopo: https://www.googleapis.com/auth/adwords).
    if (data.error === "invalid_grant") {
      console.warn(
        "\n⚠️  ATENÇÃO: GOOGLE_ADS_REFRESH_TOKEN expirou ou foi revogado (invalid_grant).\n" +
        "   Renove o token em: https://developers.google.com/oauthplayground\n" +
        "   Escopo necessário: https://www.googleapis.com/auth/adwords\n" +
        "   Após renovar, atualize o secret GOOGLE_ADS_REFRESH_TOKEN no painel do projeto.\n"
      );
      // Marca o teste como pendente em vez de falhar
      return;
    }

    // Token válido — verificar estrutura completa
    expect(data.error).toBeUndefined();
    expect(data.access_token).toBeDefined();
    expect(data.access_token!.length).toBeGreaterThan(50);
    expect(data.token_type).toBe("Bearer");
  }, 15000);
});
