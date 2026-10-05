// Run after packaging: node scripts/verify-desktop-workflow.mjs /absolute/path/to/BillFlow.app/Contents/MacOS/BillFlow
// All records are test fixtures in a separate profile. This does not certify invoice/payment UI readiness.
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
  processHandle = spawn(binary, [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"], { env: { ...process.env, BILLFLOW_USER_DATA: profile }, stdio: ["ignore", "pipe", "pipe"] });
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
try {
  await start();
  await evaluate("window.billflow.theme.setPreference('light')");
  await navigate("tasks/");
  await until(() => evaluate("document.documentElement.dataset.theme === 'light'"));
  // Exercise the actual task form and detail controls, then remove this temporary UI task.
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('New Task')).click()");
  await until(() => evaluate("Boolean(document.querySelector('input[placeholder=\"e.g. Production Database Migration\"]'))"));
  await evaluate("document.querySelector('input[placeholder=\"e.g. Production Database Migration\"]').focus()");
  await command("Input.insertText", {text:"Task form verification"});
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Create Deliverable')).click()");
  await until(() => evaluate("window.billflow.tasks.list().then(rows => rows.some(t => t.title === 'Task form verification'))"));
  await until(() => evaluate("!document.querySelector('input[placeholder=\"e.g. Production Database Migration\"]')"));
  await until(() => evaluate("[...document.querySelectorAll('[draggable]')].some(b => b.textContent.includes('Task form verification'))"));
  await evaluate("[...document.querySelectorAll('[draggable]')].find(b => b.textContent.includes('Task form verification')).click()");
  await until(() => evaluate("Boolean(document.querySelector('input[aria-label=\"New subtask\"]'))"));
  await evaluate("document.querySelector('input[aria-label=\"New subtask\"]').focus()");
  await command("Input.insertText", {text:"Subtask from UI"});
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent==='Add').click()");
  await until(() => evaluate("window.billflow.tasks.list().then(rows => rows[0]?.subtasks.length === 1)"));
  await until(() => evaluate("[...document.querySelectorAll('select')].filter(s => s.querySelector('option[value=\"in-progress\"]')).at(-1)?.disabled === false"));
  await evaluate("const statusSelect=[...document.querySelectorAll('select')].filter(s => s.querySelector('option[value=\"in-progress\"]')).at(-1); statusSelect.value='review'; statusSelect.dispatchEvent(new Event('change',{bubbles:true}))");
  await until(() => evaluate("window.billflow.tasks.list().then(rows => rows[0]?.status === 'review')"));
  await until(() => evaluate("[...document.querySelectorAll('select')].filter(s => s.querySelector('option[value=\"in-progress\"]')).at(-1)?.disabled === false"));
  await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Delete Task')).click()");
  await until(() => evaluate("window.billflow.tasks.list().then(rows => rows.length === 0)"));
  checks.push("Actual task form, subtask form, status selector and delete controls persist through IPC");
  const task = {
    id: "desktop-manual", title: "Desktop restart verification", description: "Verify the SQLite task board", status: "todo", priority: "medium", category: "Development",
    assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" }, dueDate: "2026-10-09",
    subtasks: [{ id: "desktop-subtask", title: "Restart the app", completed: false }], deliveryUrl: "https://example.com/delivery", currency: "LKR",
  };
  await evaluate(`window.billflow.tasks.create(${JSON.stringify(task)})`);
  await navigate("tasks/");
  await until(() => evaluate("document.querySelector('main').textContent.includes('Desktop restart verification')"));
  await evaluate("[...document.querySelectorAll('[draggable]')].find(b => b.textContent.includes('Desktop restart verification'))?.click()");
  await evaluate("window.billflow.tasks.update('desktop-manual', {status:'in-progress',subtasks:[{id:'desktop-subtask',title:'Restart the app',completed:true}]})");
  const pdfFolder = path.join(profile, "pdfs"); fs.mkdirSync(pdfFolder);
  await evaluate(`window.billflow.settings.update({businessName:'Chethaka test profile', pdfExportDirectory:${JSON.stringify(pdfFolder)}})`);
  await screenshot("tasks-light.png");
  checks.push("Packaged IPC and task board read/write");
  await stop(); await start();
  const rows = await evaluate("window.billflow.tasks.list()");
  assert.equal(rows.length, 1); assert.equal(rows[0].status, "in-progress"); assert.equal(rows[0].subtasks[0].completed, true); assert.ok(rows[0].startedAt);
  assert.equal((await evaluate("window.billflow.settings.get()")).pdfExportDirectory, pdfFolder);
  checks.push("Full process restart retains tasks, subtasks, timing and settings");
  const invalidImport = await evaluate("window.billflow.settings.import({version:'0.1'}).then(() => ({accepted:true}), error => ({message:error.message}))");
  assert.equal(invalidImport.accepted, undefined);
  assert.match(invalidImport.message, /backup|version|previous/i);
  assert.equal((await evaluate("window.billflow.tasks.list()")).length, 1);
  checks.push("Invalid backup reports an actionable IPC error without changing records");
  await navigate("settings/?tab=invoices");
  await until(() => evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(pdfFolder)})`));
  await screenshot("settings-pdf-folder.png");
  await navigate("support/");
  assert.ok(await evaluate("Boolean(document.querySelector('a[href=\"https://github.com/Akatsuki-61/BillFlow/issues\"]'))"));
  await screenshot("support-light.png");
  await evaluate("window.billflow.theme.setPreference('dark')");
  await navigate("tasks/");
  await until(() => evaluate("document.documentElement.dataset.theme === 'dark'"));
  await screenshot("tasks-dark.png");
  checks.push("Settings folder and Support routes render; tasks render in both themes");

  // Restore a domain integration fixture through the actual validated backup IPC.
  // This exercises tracking behavior without pretending invoice-item/payment-entry UI exists.
  await evaluate("window.billflow.clients.create({name:'Tracking fixture client', email:'fixture@example.com', currency:'LKR',driveUrl:'https://example.com/job'})");
  const client = (await evaluate("window.billflow.clients.list()"))[0];
  await evaluate(`window.billflow.invoices.create({clientId:${JSON.stringify(client.id)},amountCents:9000000,currency:'LKR',issueDate:'2026-10-06',status:'UNPAID'})`);
  const backup = await evaluate("window.billflow.settings.export()");
  const invoice = backup.records.invoices[0]; invoice.advance_cents = 4500000;
  backup.records.invoice_items = [
    {id:'fixture-website',invoice_id:invoice.id,catalog_id:null,description:'Fixture website development',quantity:1,unit_price_cents:8000000,position:0},
    {id:'fixture-consulting',invoice_id:invoice.id,catalog_id:null,description:'Fixture AI consulting',quantity:1,unit_price_cents:2000000,position:1},
  ];
  backup.records.invoice_payments = [{id:'fixture-advance',invoice_id:invoice.id,amount_cents:4500000,currency:'LKR',received_at:new Date().toISOString(),reference:'Integration fixture',request_id:'fixture-advance'}];
  await navigate("invoices/");
  await evaluate(`window.billflow.settings.import(${JSON.stringify(backup)})`);
  await until(() => evaluate("Boolean(document.querySelector('[aria-labelledby=\"tracking-heading\"]'))"));
  const countdown = await evaluate("document.querySelector('[aria-labelledby=\"tracking-heading\"]').textContent");
  assert.match(countdown, /[1-5] seconds/);
  await screenshot("tracking-countdown.png");
  await evaluate("[...document.querySelector('[aria-labelledby=\"tracking-heading\"]').querySelectorAll('button')].find(b=>b.textContent==='No').click()");
  await sleep(5500);
  assert.equal(await evaluate("location.pathname"), "/invoices/");
  assert.equal((await evaluate("window.billflow.tasks.list()")).length, 1);
  assert.equal((await evaluate("window.billflow.tracking.pending()")).length, 0);
  checks.push("Visible five-second tracking countdown; No cancels timer and preserves invoice navigation");

  // A separate fixture validates timeout, not a retry of the persisted No decision.
  const timeoutBackup = await evaluate("window.billflow.settings.export()");
  const original = timeoutBackup.records.invoices[0];
  timeoutBackup.records.invoices.push({...original,id:'timeout-invoice',code:'INV-TIMEOUT',tracking_choice:null,tracking_eligible_at:null,tracking_decided_at:null});
  timeoutBackup.invoices.push({});
  timeoutBackup.records.invoice_items.push(...backup.records.invoice_items.map(item=>({...item,id:`timeout-${item.id}`,invoice_id:'timeout-invoice'})));
  timeoutBackup.records.invoice_payments.push({...backup.records.invoice_payments[0],id:'timeout-advance',invoice_id:'timeout-invoice',request_id:'timeout-advance'});
  await evaluate(`window.billflow.settings.import(${JSON.stringify(timeoutBackup)})`);
  await until(() => evaluate("Boolean(document.querySelector('[aria-labelledby=\"tracking-heading\"]'))"));
  await until(() => evaluate("location.pathname === '/tasks' || location.pathname === '/tasks/'"), 10000);
  assert.equal((await evaluate("window.billflow.tasks.list()")).length, 3);
  await stop(); await start();
  assert.equal((await evaluate("window.billflow.tasks.list()")).length, 3);
  assert.equal((await evaluate("window.billflow.tracking.pending()")).length, 0);
  checks.push("Timeout creates exactly two linked tasks, navigates to /tasks and survives restart without duplicates");
  const report = {profile,checks,blocked:[
    'Invoice-item entry and payment-ledger entry IPC/UI are absent; the full direct-work demo remains blocked.',
    'PDF generation/re-export UI is absent; folder selection and main-process output storage are ready.',
    'Receipt select/open/storage APIs are ready; payment and expense receipt controls need persisted owner records from their domain implementations.',
    'Settings team-preference behavior is undefined; no collaboration system was invented.'
  ]};
  fs.writeFileSync(path.join(evidence,'desktop-results.json'),JSON.stringify(report,null,2));
  fs.rmSync(path.join(evidence,'desktop-failure.txt'), {force:true});
  console.log(JSON.stringify(report,null,2));
} catch (error) {
  console.error(error);
  if (socket?.readyState === WebSocket.OPEN) { console.error(await evaluate("({url:location.href, tasks:window.billflow?.tasks.list(), body:document.body.innerText})").catch(() => null)); await screenshot("desktop-failure.png").catch(() => {}); }
  fs.writeFileSync(path.join(evidence,'desktop-failure.txt'),String(error));
  process.exitCode=1;
} finally {
  fs.writeFileSync(path.join(evidence,'desktop.log'),log);
  await stop();
}
