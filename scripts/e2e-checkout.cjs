/**
 * Teste ponta a ponta do checkout no navegador (Playwright), contra os servidores locais:
 *   1) deno run --allow-net --allow-env scripts/dev-backend/server.ts
 *   2) npm run dev
 *   3) node scripts/e2e-checkout.cjs
 * Percorre: landing → plano → formulário → pagamento simulado → tela de sucesso com acesso → e-mail na caixa de saída → login pré-preenchido.
 */
const { chromium } = require("playwright");

const SITE = process.env.SITE_URL || "http://127.0.0.1:8080";
const BACKEND = process.env.DEV_BACKEND_URL || "http://localhost:54321";
const stamp = Date.now().toString().slice(-6);
const email = `e2e-${stamp}@teste.nahorafrota.tech`;

/** CNPJ válido aleatório (dígitos verificadores calculados). */
function randomCnpj() {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const calc = (digits, weights) => digits.reduce((s, d, i) => s + d * weights[i], 0);
  const d1 = ((r) => (r < 2 ? 0 : 11 - r))(calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
  const d2 = ((r) => (r < 2 ? 0 : 11 - r))(calc([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
  return [...base, d1, d2].join("");
}
const CNPJ = randomCnpj();

function assert(cond, msg) {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`ok  ${msg}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${SITE}/`, { waitUntil: "networkidle" });
  assert((await page.title()).includes("Na Hora Frota"), "landing abre");
  assert((await page.locator("section[id]").count()) >= 7, "landing tem pelo menos 7 seções");

  await page.getByRole("link", { name: /Assinar Controle:/ }).click();
  await page.waitForURL(/\/comprar\/control/);
  assert(true, "clique em Assinar Controle leva ao checkout");

  await page.fill("#company_name", "Transportes E2E LTDA");
  await page.fill("#cnpj", CNPJ);
  await page.fill("#contact_name", "Ana E2E");
  await page.fill("#email", email);
  await page.fill("#whatsapp", "11999998888");
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForURL(/\/checkout\/sandbox\//, { timeout: 15000 });
  assert(true, "formulário válido abre o pagamento (sandbox)");

  // CNPJ repetido deve ser recusado em um segundo pedido (testado via API direto)
  const dup = await (await fetch(`${BACKEND}/functions/v1/create-checkout`, { method: "POST", headers: { "Content-Type": "application/json", Origin: SITE }, body: JSON.stringify({ plan: "basic", company_name: "Outra", cnpj: CNPJ, contact_name: "X Y", email: `outro-${stamp}@t.com`, whatsapp: "11999990000" }) })).json();
  // o CNPJ só fica "ocupado" depois do provisionamento; antes disso, o segundo pedido pode ser criado
  assert(dup.order_id || dup.code === "cnpj_exists", "segundo pedido com mesmo CNPJ é tratado");

  await page.getByRole("button", { name: /Simular pagamento aprovado/ }).click();
  await page.waitForURL(/\/comprar\/sucesso/, { timeout: 15000 });
  await page.getByText("Seu acesso de administrador").waitFor({ timeout: 20000 });
  assert(true, "pagamento aprovado leva à tela de sucesso com acesso");

  await page.getByRole("button", { name: "Mostrar senha" }).click();
  const shown = await page.locator("code").nth(1).textContent();
  assert(/^[A-Za-z0-9]{10}!\d$/.test(shown.trim()), "senha temporária exibida no formato esperado");
  assert(await page.getByText(/Enviamos também para/).isVisible(), "tela informa que o e-mail foi enviado");

  const outbox = await (await fetch(`${BACKEND}/dev/outbox.json`)).json();
  const mail = outbox.find((m) => m.to === email);
  assert(!!mail, "e-mail de acesso chegou na caixa de saída");
  assert(mail.html.includes(shown.trim()) && mail.html.includes(email), "e-mail contém login e a mesma senha temporária");

  const state = await (await fetch(`${BACKEND}/dev/state`)).json();
  const tenant = state.tenants.find((t) => t.cnpj === CNPJ);
  const user = state.users.find((u) => u.email === email);
  assert(tenant && tenant.status === "active" && tenant.plan === "control", "empresa criada ativa no plano Controle");
  assert(user && user.user_metadata.must_change_password === true, "usuário admin criado com troca de senha obrigatória");
  assert(state.user_roles.some((r) => r.user_id === user.id && r.role === "admin" && r.tenant_id === tenant.id), "papel admin vinculado à empresa");

  // CNPJ agora ocupado
  const dup2 = await (await fetch(`${BACKEND}/functions/v1/create-checkout`, { method: "POST", headers: { "Content-Type": "application/json", Origin: SITE }, body: JSON.stringify({ plan: "basic", company_name: "Outra", cnpj: CNPJ, contact_name: "X Y", email: `outro2-${stamp}@t.com`, whatsapp: "11999990000" }) })).json();
  assert(dup2.code === "cnpj_exists", "CNPJ já cadastrado é recusado no checkout");

  await page.getByRole("button", { name: /Entrar agora/ }).click();
  await page.waitForURL(/\/login/);
  assert((await page.inputValue("#login-email")) === email, "login abre com o e-mail pré-preenchido");
  assert(await page.getByText("Conta criada.").isVisible(), "login mostra o aviso de conta criada");

  assert(errors.length === 0, `sem erros de JavaScript (${errors.length})`);
  await browser.close();
  console.log("\nE2E do checkout: tudo certo.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
