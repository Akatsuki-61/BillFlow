// Run with an absolute packaged BillFlow executable. Uses a separate disposable test profile.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const binary = process.argv[2];
if (!binary || !path.isAbsolute(binary)) throw new Error("Pass an absolute packaged BillFlow executable path.");
const evidence = path.resolve("release/verification");
fs.mkdirSync(evidence, { recursive: true });
const profile = fs.mkdtempSync(path.join(evidence, "profile-"));
const server = net.createServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let processHandle;
let socket;
let log = "";
let nextId = 0;
const callbacks = new Map();
const checks = [];
async function until(action, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const result = await action(); if (result) return result; } catch { /* renderer starting/navigation */ }
    await sleep(150);
  }
  throw new Error("Timed out waiting for desktop renderer.");
}
async function start() {
  processHandle = spawn(binary, [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"], { env: { ...process.env, BILLFLOW_USER_DATA: profile, BILLFLOW_VERIFY_HIDDEN: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  processHandle.stdout.on("data", chunk => { log += chunk.toString(); });
  processHandle.stderr.on("data", chunk => { log += chunk.toString(); });
  const target = await until(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return targets.find(t => t.type === "page" && t.url.startsWith("app://billflow"));
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    if (result.id) {
      const callback = callbacks.get(result.id); callbacks.delete(result.id);
      if (callback) { if (result.error) callback.reject(new Error(result.error.message)); else callback.resolve(result.result); }
    }
  };
  try { await until(() => evaluate("Boolean(window.billflow?.isElectron && document.querySelector('main'))")); }
  catch (error) { console.error(await evaluate("({url:location.href,bridge:!!window.billflow,body:document.body?.innerText})")); await screenshot("startup-failure.png"); throw error; }
}
function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { callbacks.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function navigate(route) {
  const destination = new URL(route, "app://billflow/");
  await evaluate(`location.href = ${JSON.stringify(destination.href)}`);
  await until(() => evaluate(`location.pathname === ${JSON.stringify(destination.pathname)} && document.querySelector('main') && Boolean(window.billflow)`));
  await sleep(500);
}
async function screenshot(name) {
  await sleep(500);
  const response = await command("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(evidence, name), Buffer.from(response.data, "base64"));
}
async function stop() {
  socket?.close();
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = new Promise(resolve => processHandle.once("exit", resolve));
  processHandle.kill("SIGTERM");
  await exited;
}
async function fill(selector,value) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();document.querySelector(${JSON.stringify(selector)}).select()`);
  await command("Input.insertText",{text:value});
}
async function clickText(text) {
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`);
}
try {
  await start();await evaluate("window.billflow.theme.setPreference('light')");await navigate("catalog/");
  assert.equal((await evaluate("window.billflow.catalog.list()")).length,0);
  await clickText("New Item");
  await fill('input[placeholder="e.g. Senior Full-Stack Development"]',"Business website development");
  await fill('input[placeholder="e.g. DEV-001"]',"DEMO-WEB");
  await fill('input[placeholder="45000.00"]',"80000.25");
  await fill('textarea[placeholder="Describe the scope, deliverables, or specifications of this item..."]',"Website build, including review and staging.");
  await clickText("Create Item");
  await until(()=>evaluate("window.billflow.catalog.list().then(rows=>rows.length===1)"));
  const catalog=(await evaluate("window.billflow.catalog.list()"))[0];assert.equal(catalog.priceCents,8000025);
  checks.push("Actual Catalog creation form stores integer minor units");
  await screenshot("catalog-light.png");

  await navigate("invoices/");await clickText("New Invoice");
  await until(()=>evaluate("Boolean(document.querySelector('[aria-label=\"New client name\"]'))"));
  await fill('[aria-label="New client name"]',"Demo business client");
  await fill('[aria-label="New client email"]',"demo@example.com");
  await evaluate(`const selector=document.querySelector('[aria-label="Catalog service"]');selector.value=${JSON.stringify(catalog.id)};selector.dispatchEvent(new Event('change',{bubbles:true}))`);
  await until(()=>evaluate("document.querySelector('input[placeholder=\"12500.00\"]').value==='80000.25'"));
  await fill('input[placeholder="12500.00"]',"75000.00");
  await clickText("Create Invoice");
  await until(()=>evaluate("window.billflow.invoices.list().then(rows=>rows.length===1)"));
  const invoice=(await evaluate("window.billflow.invoices.list()"))[0];assert.equal(invoice.catalogItemId,catalog.id);assert.equal(invoice.amountCents,7500000);
  assert.equal((await evaluate("window.billflow.clients.list()")).length,1);
  assert.equal((await evaluate("window.billflow.catalog.list()"))[0].priceCents,8000025);
  checks.push("Actual invoice form selects Catalog, customizes price, and atomically saves its new client");
  await screenshot("invoice-created.png");

  await navigate("catalog/");await clickText("Bulk Import");
  const csvPath=path.join(profile,"catalog.csv");fs.writeFileSync(csvPath,'title,category,sku,price,currency,unit,description\n"AI consulting, session",Consulting,DEMO-AI,20000.50,LKR,/ Session,"Includes recommendations, and review"');
  const doc=await command("DOM.getDocument");const node=await command("DOM.querySelector",{nodeId:doc.root.nodeId,selector:'input[type="file"]'});
  await command("DOM.setFileInputFiles",{nodeId:node.nodeId,files:[csvPath]});
  await until(()=>evaluate("window.billflow.catalog.list().then(rows=>rows.length===2)"));
  assert.equal((await evaluate("window.billflow.catalog.list()")).find(row=>row.sku==='DEMO-AI').description,"Includes recommendations, and review");
  checks.push("Actual CSV upload handles quoted commas and persists imported services");

  await evaluate("window.billflow.theme.setPreference('dark')");await navigate("catalog/");
  await until(()=>evaluate("document.documentElement.dataset.theme==='dark'"));await screenshot("catalog-dark.png");
  const backup=await evaluate("window.billflow.settings.export()");assert.equal(backup.catalogItems.length,2);
  await stop();await start();
  assert.equal((await evaluate("window.billflow.catalog.list()")).length,2);assert.equal((await evaluate("window.billflow.invoices.list()"))[0].amountCents,7500000);
  assert.equal((await evaluate("window.billflow.clients.list()")).length,1);
  checks.push("Full packaged-app restart preserves Catalog, issued invoice prices and client links; both themes render");
  await evaluate(`window.billflow.settings.import(${JSON.stringify(backup)})`);assert.equal((await evaluate("window.billflow.catalog.list()")).length,2);
  checks.push("Backup contains Catalog records and repeated restore does not duplicate them");
  fs.writeFileSync(path.join(evidence,'catalog-results.json'),JSON.stringify({profile,checks},null,2));console.log(JSON.stringify({profile,checks},null,2));
} catch(error) {
  console.error(error);if(socket?.readyState===WebSocket.OPEN){console.error(await evaluate("document.body.innerText").catch(()=>null));await screenshot("catalog-failure.png").catch(()=>{});}process.exitCode=1;
} finally {fs.writeFileSync(path.join(evidence,'catalog.log'),log);await stop();}
