/**
 * Teste ponta a ponta do checkout no navegador (Playwright), contra os servidores locais:
 *   1) deno run --allow-net --allow-env scripts/dev-backend/server.ts
 *   2) npm run dev
 *   3) node scripts/e2e-checkout.cjs
 * Percorre: landing → plano → formulário → pagamento simulado → tela de sucesso com acesso → e-mail na caixa de saída → login pré-preenchido,
 * e depois a conversão de uma empresa em teste grátis (mesmo CNPJ) em assinatura.
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
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 300)}`); });

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

  // ---- Conversão do teste grátis: empresa já cadastrada em /register compra um plano ----
  const trialCnpj = randomCnpj();
  const trialEmail = `trial-${stamp}@teste.nahorafrota.tech`;
  const seed = await (await fetch(`${BACKEND}/dev/seed-trial`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnpj: trialCnpj, email: trialEmail, name: "Bia Trial", company: "Trial E2E LTDA" }) })).json();
  assert(seed.ok, "empresa em teste grátis criada no backend de desenvolvimento");

  const call = (name, body) => fetch(`${BACKEND}/functions/v1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: SITE }, body: JSON.stringify(body) }).then((r) => r.json());
  const conv = await call("create-checkout", { plan: "total", company_name: "Trial E2E LTDA", cnpj: trialCnpj, contact_name: "Bia Trial", email: trialEmail, whatsapp: "11988887777" });
  assert(conv.kind === "conversion" && conv.order_id, "mesmo CNPJ + mesmo e-mail do teste grátis abre pedido de conversão");
  const confirmed = await call("confirm-sandbox-payment", { order_id: conv.order_id, access_token: conv.access_token, outcome: "approved" });
  assert(confirmed.status === "provisioned", "pagamento da conversão provisiona");
  const convOrder = await call("get-order", { order_id: conv.order_id, access_token: conv.access_token });
  assert(convOrder.existing_user === true && convOrder.temp_password === null, "conversão com login existente não gera senha temporária");
  const state2 = await (await fetch(`${BACKEND}/dev/state`)).json();
  const trialTenant = state2.tenants.find((t) => t.cnpj === trialCnpj);
  assert(trialTenant && trialTenant.status === "active" && trialTenant.plan === "total" && trialTenant.converted_at, "empresa do teste grátis virou assinatura ativa no plano comprado");
  assert(state2.users.filter((u) => u.email === trialEmail).length === 1, "nenhum usuário duplicado na conversão");
  const outbox2 = await (await fetch(`${BACKEND}/dev/outbox.json`)).json();
  const convMail = outbox2.find((m) => m.to === trialEmail);
  assert(convMail && /assinatura/i.test(convMail.subject) && !convMail.html.includes("Senha temporária"), "e-mail de assinatura ativa sem senha temporária");

  await page.goto(`${SITE}/comprar/sucesso?order=${conv.order_id}&t=${conv.access_token}`, { waitUntil: "networkidle" });
  await page.getByText("Sua assinatura está ativa", { exact: false }).first().waitFor({ timeout: 20000 });
  assert(await page.getByText("A mesma que você já usa.").isVisible(), "tela de sucesso da conversão diz para usar a senha atual");
  await page.getByRole("button", { name: /Entrar agora/ }).click();
  await page.waitForURL(/\/login/);
  assert((await page.inputValue("#login-email")) === trialEmail, "login da conversão abre com o e-mail certo");
  assert(await page.getByText("Assinatura ativa.").isVisible(), "login mostra o aviso de assinatura ativa");

  // Mesmo CNPJ em teste, e-mail novo → segundo administrador com senha temporária
  const trialCnpj2 = randomCnpj();
  await fetch(`${BACKEND}/dev/seed-trial`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnpj: trialCnpj2, email: `dona-${stamp}@teste.nahorafrota.tech`, company: "Trial 2 LTDA" }) });
  const conv2 = await call("create-checkout", { plan: "basic", company_name: "Trial 2 LTDA", cnpj: trialCnpj2, contact_name: "Caio Novo", email: `caio-${stamp}@teste.nahorafrota.tech`, whatsapp: "11977776666" });
  await call("confirm-sandbox-payment", { order_id: conv2.order_id, access_token: conv2.access_token, outcome: "approved" });
  const conv2Order = await call("get-order", { order_id: conv2.order_id, access_token: conv2.access_token });
  assert(conv2Order.kind === "conversion" && conv2Order.existing_user === false && /^[A-Za-z0-9]{10}!\d$/.test(conv2Order.temp_password || ""), "conversão com e-mail novo cria administrador com senha temporária");

  if (errors.length) console.log(errors.map((e) => `    ${e}`).join("\n"));
  assert(errors.length === 0, `sem erros de JavaScript (${errors.length})`);
  await browser.close();
  console.log("\nE2E do checkout: tudo certo.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
