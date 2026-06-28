/**
 * Script para executar a reorganização de palavras negativas via API do Google Ads.
 * Chama o endpoint tRPC diretamente com dryRun: false.
 */

const BASE_URL = "http://localhost:3000";

async function callTrpc(procedure, input) {
  const url = `${BASE_URL}/api/trpc/${procedure}`;
  const body = JSON.stringify({ json: input });
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  
  const data = await res.json();
  
  // tRPC response format
  if (data.result?.data?.json) {
    return data.result.data.json;
  }
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data;
}

async function main() {
  const dryRun = process.argv[2] !== "--live";
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`REORGANIZAÇÃO DE PALAVRAS NEGATIVAS — ${dryRun ? "DRY-RUN (simulação)" : "LIVE (ao vivo)"}`);
  console.log(`${"=".repeat(60)}\n`);
  
  if (!dryRun) {
    console.log("⚠️  MODO AO VIVO: As alterações serão aplicadas na conta Google Ads!\n");
  }
  
  try {
    console.log("Chamando endpoint reorganizeNegativeKeywords...\n");
    
    const result = await callTrpc("googleAds.reorganizeNegativeKeywords", { dryRun });
    
    console.log(`📊 RESUMO: ${result.summary}\n`);
    
    if (result.added && result.added.length > 0) {
      console.log(`\n✅ ${dryRun ? "SERIAM ADICIONADOS" : "ADICIONADOS"} (${result.added.length}):`);
      result.added.forEach(item => console.log(`  ${item}`));
    }
    
    if (result.skipped && result.skipped.length > 0) {
      console.log(`\n⏭️  JÁ EXISTIAM / PULADOS (${result.skipped.length}):`);
      result.skipped.forEach(item => console.log(`  ${item}`));
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ ERROS (${result.errors.length}):`);
      result.errors.forEach(item => console.log(`  ${item}`));
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log("Concluído!");
    
  } catch (err) {
    console.error("Erro ao chamar endpoint:", err.message);
    process.exit(1);
  }
}

main();
