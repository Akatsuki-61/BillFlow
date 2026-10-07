import Database from "better-sqlite3";
import path from "path";
import os from "os";

const dbPath = path.join(os.homedir(), "Library/Application Support/billflow/billflow.db");
console.log("Seeding database at:", dbPath);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.transaction(() => {
  // 1. Clear existing rows in correct foreign key order
  db.prepare("DELETE FROM invoice_pdf_exports").run();
  db.prepare("DELETE FROM attachments").run();
  db.prepare("DELETE FROM vendor_payouts").run();
  db.prepare("DELETE FROM work_orders").run();
  db.prepare("DELETE FROM expenses").run();
  db.prepare("DELETE FROM task_history").run();
  db.prepare("DELETE FROM subtasks").run();
  db.prepare("DELETE FROM tasks").run();
  db.prepare("DELETE FROM invoice_payments").run();
  db.prepare("DELETE FROM invoice_items").run();
  db.prepare("DELETE FROM invoices").run();
  db.prepare("DELETE FROM catalog_services").run();
  db.prepare("DELETE FROM catalog_items").run();
  db.prepare("DELETE FROM vendors").run();
  db.prepare("DELETE FROM clients").run();

  // 2. Settings
  db.prepare(`
    INSERT INTO settings (id, business_name, professional_title, email, phone, website, tax_id, address, payment_details, default_currency, invoice_prefix, next_invoice_seq, default_due_days, default_tax_rate, default_notes, date_format, currency_display, updated_at)
    VALUES ('default', 'Chethaka', 'Full-Stack Software Engineer & AI Consultant', 'chethaka@billflow.dev', '+94 77 000 0000', 'https://chethaka.dev', 'TAX-LK-89210', 'Colombo, Sri Lanka', 'Commercial Bank of Ceylon\nAccount: 8001234567\nBranch: Colombo Fort\nSWIFT: CCEYLKLX', 'USD', 'INV-', 4, 14, 0, 'Payment due within 14 days of issue. 50% deposit required on project commencement.', 'YYYY-MM-DD', 'symbol', CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      business_name = excluded.business_name,
      professional_title = excluded.professional_title,
      email = excluded.email,
      phone = excluded.phone,
      payment_details = excluded.payment_details,
      default_currency = excluded.default_currency,
      next_invoice_seq = 4
  `).run();

  // 3. Clients
  const insertClient = db.prepare(`
    INSERT INTO clients (id, name, category, contact_person, contact_role, email, phone, currency, drive_url, has_quick_bill, created_at, updated_at)
    VALUES (@id, @name, @category, @contactPerson, @contactRole, @email, @phone, @currency, @driveUrl, @hasQuickBill, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  insertClient.run({
    id: "cli-technova",
    name: "TechNova Solutions",
    category: "Enterprise",
    contactPerson: "Amara Silva",
    contactRole: "Head of Engineering",
    email: "amara@technova.io",
    phone: "+94 77 123 4567",
    currency: "USD",
    driveUrl: "https://github.com/Chethaka/technova-portal",
    hasQuickBill: 1,
  });

  insertClient.run({
    id: "cli-apex",
    name: "Apex Retail Group",
    category: "Retail",
    contactPerson: "Kasun Perera",
    contactRole: "Operations Director",
    email: "billing@apexretail.lk",
    phone: "+94 11 234 5678",
    currency: "USD",
    driveUrl: "https://drive.google.com/drive/folders/apex-retail-deliverables",
    hasQuickBill: 1,
  });

  insertClient.run({
    id: "cli-greenleaf",
    name: "GreenLeaf Health",
    category: "Healthcare",
    contactPerson: "Dr. Priyantha Fernando",
    contactRole: "Medical Director",
    email: "priyantha@greenleafhealth.com",
    phone: "+94 71 987 6543",
    currency: "USD",
    driveUrl: "https://staging.greenleafhealth.app",
    hasQuickBill: 1,
  });

  // 4. Catalog Items
  const insertCatalogItem = db.prepare(`
    INSERT INTO catalog_items (id, title, category, sku, description, price_cents, currency, unit, icon_type, created_at, updated_at)
    VALUES (@id, @title, @category, @sku, @description, @priceCents, @currency, @unit, @iconType, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  insertCatalogItem.run({
    id: "cat-web",
    title: "Business Website Development",
    category: "Development",
    sku: "WEB-DEV-01",
    description: "Full-stack Next.js web application with responsive UI, CMS integration, and SEO optimization",
    priceCents: 800000,
    currency: "USD",
    unit: "/ Project",
    iconType: "code",
  });

  insertCatalogItem.run({
    id: "cat-ai",
    title: "AI Consulting & Automation Strategy",
    category: "Consulting",
    sku: "AI-CNS-01",
    description: "Architecture review, agentic workflow design, and customer-support automation blueprint",
    priceCents: 200000,
    currency: "USD",
    unit: "/ Session",
    iconType: "consulting",
  });

  insertCatalogItem.run({
    id: "cat-custom",
    title: "Custom Software Development",
    category: "Development",
    sku: "SFT-CST-01",
    description: "Bespoke API development, database architecture, and cloud backend microservices",
    priceCents: 450000,
    currency: "USD",
    unit: "/ Milestone",
    iconType: "code",
  });

  insertCatalogItem.run({
    id: "cat-cloud",
    title: "Cloud Infrastructure & DevOps",
    category: "Development",
    sku: "OPS-CICD-01",
    description: "Automated deployment pipeline, Docker containerization, and monitoring setup",
    priceCents: 150000,
    currency: "USD",
    unit: "/ Setup",
    iconType: "cloud",
  });

  // Also sync to catalog_services
  const insertCatalogService = db.prepare(`
    INSERT INTO catalog_services (id, name, description, unit_price_cents, currency, category)
    VALUES (@id, @name, @description, @unitPriceCents, @currency, @category)
  `);
  insertCatalogService.run({ id: "cat-web", name: "Business Website Development", description: "Full-stack Next.js portal", unitPriceCents: 800000, currency: "USD", category: "Development" });
  insertCatalogService.run({ id: "cat-ai", name: "AI Consulting & Automation Strategy", description: "Architecture review and LLM blueprint", unitPriceCents: 200000, currency: "USD", category: "Consulting" });
  insertCatalogService.run({ id: "cat-custom", name: "Custom Software Development", description: "API and backend services", unitPriceCents: 450000, currency: "USD", category: "Development" });

  // 5. Invoices
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, code, client_id, catalog_item_id, title, delivery_url, notes, discount_cents, tax_cents, advance_cents, amount_cents, paid_cents, currency, issue_date, due_date, status, created_at, updated_at)
    VALUES (@id, @code, @clientId, @catalogItemId, @title, @deliveryUrl, @notes, @discountCents, @taxCents, @advanceCents, @amountCents, @paidCents, @currency, @issueDate, @dueDate, @status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  insertInvoice.run({
    id: "inv-technova",
    code: "INV-001",
    clientId: "cli-technova",
    catalogItemId: "cat-web",
    title: "TechNova Client Portal & AI Automation",
    deliveryUrl: "https://github.com/Chethaka/technova-portal",
    notes: "50% advance received. Work in progress. Delivery repository linked.",
    discountCents: 100000,
    taxCents: 0,
    advanceCents: 450000,
    amountCents: 900000,
    paidCents: 450000,
    currency: "USD",
    issueDate: "2026-10-01",
    dueDate: "2026-10-25",
    status: "ADVANCE_PAID",
  });

  insertInvoice.run({
    id: "inv-apex",
    code: "INV-002",
    clientId: "cli-apex",
    catalogItemId: "cat-custom",
    title: "Retail Checkout & Inventory System",
    deliveryUrl: "https://drive.google.com/drive/folders/apex-retail-deliverables",
    notes: "Fully delivered and approved. Remaining balance settled.",
    discountCents: 0,
    taxCents: 0,
    advanceCents: 240000,
    amountCents: 480000,
    paidCents: 480000,
    currency: "USD",
    issueDate: "2026-09-15",
    dueDate: "2026-10-01",
    status: "PAID",
  });

  insertInvoice.run({
    id: "inv-greenleaf",
    code: "INV-003",
    clientId: "cli-greenleaf",
    catalogItemId: "cat-custom",
    title: "Patient Intake Digital Workflow",
    deliveryUrl: "https://staging.greenleafhealth.app",
    notes: "50% advance received. Staging prototype under client review.",
    discountCents: 0,
    taxCents: 0,
    advanceCents: 175000,
    amountCents: 350000,
    paidCents: 175000,
    currency: "USD",
    issueDate: "2026-10-04",
    dueDate: "2026-10-28",
    status: "ADVANCE_PAID",
  });

  // 6. Invoice Line Items
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, catalog_id, description, quantity, unit_price_cents, position)
    VALUES (@id, @invoiceId, @catalogId, @description, @quantity, @unitPriceCents, @position)
  `);

  insertItem.run({
    id: "ii-1",
    invoiceId: "inv-technova",
    catalogId: "cat-web",
    description: "Business Website Development - Next.js portal & dashboard",
    quantity: 1,
    unitPriceCents: 800000,
    position: 0,
  });

  insertItem.run({
    id: "ii-2",
    invoiceId: "inv-technova",
    catalogId: "cat-ai",
    description: "AI Consulting Session - Customer support automation blueprint",
    quantity: 1,
    unitPriceCents: 200000,
    position: 1,
  });

  insertItem.run({
    id: "ii-3",
    invoiceId: "inv-apex",
    catalogId: "cat-custom",
    description: "Custom Software Development - E-commerce checkout flow",
    quantity: 1,
    unitPriceCents: 480000,
    position: 0,
  });

  insertItem.run({
    id: "ii-4",
    invoiceId: "inv-greenleaf",
    catalogId: "cat-custom",
    description: "Patient Intake Workflow Automation & Webhooks",
    quantity: 1,
    unitPriceCents: 350000,
    position: 0,
  });

  // 7. Invoice Payments
  const insertPayment = db.prepare(`
    INSERT INTO invoice_payments (id, invoice_id, amount_cents, currency, received_at, reference, request_id)
    VALUES (@id, @invoiceId, @amountCents, @currency, @receivedAt, @reference, @requestId)
  `);

  insertPayment.run({
    id: "pay-1",
    invoiceId: "inv-technova",
    amountCents: 450000,
    currency: "USD",
    receivedAt: "2026-10-02 11:30:00",
    reference: "BANK-WIRE-882190",
    requestId: "req-pay-1",
  });

  insertPayment.run({
    id: "pay-2",
    invoiceId: "inv-apex",
    amountCents: 240000,
    currency: "USD",
    receivedAt: "2026-09-16 14:00:00",
    reference: "ADV-APEX-771",
    requestId: "req-pay-2",
  });

  insertPayment.run({
    id: "pay-3",
    invoiceId: "inv-apex",
    amountCents: 240000,
    currency: "USD",
    receivedAt: "2026-10-01 16:45:00",
    reference: "FINAL-APEX-992",
    requestId: "req-pay-3",
  });

  insertPayment.run({
    id: "pay-4",
    invoiceId: "inv-greenleaf",
    amountCents: 175000,
    currency: "USD",
    receivedAt: "2026-10-05 10:15:00",
    reference: "STRIPE-TXN-4190",
    requestId: "req-pay-4",
  });

  // 8. Tasks (linked to invoice items and clients)
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, invoice_item_id, invoice_id, client_id, title, description, status, priority, category, assignee, due_date, client_name, delivery_url, is_outsourced, outsourced_vendor, outsource_budget, currency, created_at, updated_at, started_at, completed_at, active_milliseconds)
    VALUES (@id, @invoiceItemId, @invoiceId, @clientId, @title, @description, @status, @priority, @category, @assignee, @dueDate, @clientName, @deliveryUrl, @isOutsourced, @outsourcedVendor, @outsourceBudgetCents, @currency, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @startedAt, @completedAt, @activeMilliseconds)
  `);

  insertTask.run({
    id: "tsk-web",
    invoiceItemId: "ii-1",
    invoiceId: "inv-technova",
    clientId: "cli-technova",
    title: "Business Website Development",
    description: "Responsive Next.js web application with Tailwind styling and client portal staging",
    status: "in-progress",
    priority: "high",
    category: "Development",
    assignee: JSON.stringify({ name: "Chethaka" }),
    dueDate: "2026-10-18",
    clientName: "TechNova Solutions",
    deliveryUrl: "https://github.com/Chethaka/technova-portal",
    isOutsourced: 1,
    outsourcedVendor: "Niroshan UI Studio",
    outsourceBudgetCents: 150000,
    currency: "USD",
    startedAt: "2026-10-03 09:00:00",
    completedAt: null,
    activeMilliseconds: 14400000, // 4 hours
  });

  insertTask.run({
    id: "tsk-ai",
    invoiceItemId: "ii-2",
    invoiceId: "inv-technova",
    clientId: "cli-technova",
    title: "AI Consulting Session & Automation Blueprint",
    description: "Customer support automation architecture review and LLM multi-agent plan",
    status: "todo",
    priority: "medium",
    category: "Consulting",
    assignee: JSON.stringify({ name: "Chethaka" }),
    dueDate: "2026-10-22",
    clientName: "TechNova Solutions",
    deliveryUrl: "https://github.com/Chethaka/technova-portal",
    isOutsourced: 0,
    outsourcedVendor: null,
    outsourceBudgetCents: null,
    currency: "USD",
    startedAt: null,
    completedAt: null,
    activeMilliseconds: 7200000, // 2 hours
  });

  insertTask.run({
    id: "tsk-apex",
    invoiceItemId: "ii-3",
    invoiceId: "inv-apex",
    clientId: "cli-apex",
    title: "Retail Checkout & Payment Flow",
    description: "E-commerce payment gateway integration and inventory sync hooks",
    status: "done",
    priority: "medium",
    category: "Development",
    assignee: JSON.stringify({ name: "Chethaka" }),
    dueDate: "2026-09-30",
    clientName: "Apex Retail Group",
    deliveryUrl: "https://drive.google.com/drive/folders/apex-retail-deliverables",
    isOutsourced: 0,
    outsourcedVendor: null,
    outsourceBudgetCents: null,
    currency: "USD",
    startedAt: "2026-09-16 15:00:00",
    completedAt: "2026-10-01 16:00:00",
    activeMilliseconds: 28800000, // 8 hours
  });

  insertTask.run({
    id: "tsk-greenleaf",
    invoiceItemId: "ii-4",
    invoiceId: "inv-greenleaf",
    clientId: "cli-greenleaf",
    title: "Patient Intake Workflow Automation",
    description: "Digital intake forms, webhook routing, and SMS confirmation triggers",
    status: "review",
    priority: "high",
    category: "Development",
    assignee: JSON.stringify({ name: "Chethaka" }),
    dueDate: "2026-10-20",
    clientName: "GreenLeaf Health",
    deliveryUrl: "https://staging.greenleafhealth.app",
    isOutsourced: 0,
    outsourcedVendor: null,
    outsourceBudgetCents: null,
    currency: "USD",
    startedAt: "2026-10-05 11:00:00",
    completedAt: null,
    activeMilliseconds: 18000000, // 5 hours
  });

  // Subtasks
  const insertSubtask = db.prepare(`
    INSERT INTO subtasks (id, task_id, title, completed)
    VALUES (@id, @taskId, @title, @completed)
  `);
  insertSubtask.run({ id: "st-1", taskId: "tsk-web", title: "Setup responsive layout and Tailwind color system", completed: 1 });
  insertSubtask.run({ id: "st-2", taskId: "tsk-web", title: "Integrate client portal auth & dashboard widgets", completed: 1 });
  insertSubtask.run({ id: "st-3", taskId: "tsk-web", title: "Deploy to staging URL for client milestone review", completed: 0 });
  insertSubtask.run({ id: "st-4", taskId: "tsk-ai", title: "Audit existing customer-support ticket logs", completed: 0 });
  insertSubtask.run({ id: "st-5", taskId: "tsk-ai", title: "Formulate prompt chains and automated routing specs", completed: 0 });
  insertSubtask.run({ id: "st-6", taskId: "tsk-apex", title: "Stripe and bank payment integration", completed: 1 });
  insertSubtask.run({ id: "st-7", taskId: "tsk-apex", title: "Inventory sync webhook handlers", completed: 1 });
  insertSubtask.run({ id: "st-8", taskId: "tsk-apex", title: "Production rollout and client verification", completed: 1 });
  insertSubtask.run({ id: "st-9", taskId: "tsk-greenleaf", title: "Build secure patient intake forms", completed: 1 });
  insertSubtask.run({ id: "st-10", taskId: "tsk-greenleaf", title: "Connect SMS webhook triggers", completed: 1 });
  insertSubtask.run({ id: "st-11", taskId: "tsk-greenleaf", title: "Client compliance review", completed: 0 });

  // 9. Vendors (Subcontractors)
  const insertVendor = db.prepare(`
    INSERT INTO vendors (id, name, service, balance_cents, status, icon_type, email, phone, linked_client_id, linked_client_name, payout_due_date, notes, created_at, updated_at)
    VALUES (@id, @name, @service, @balanceCents, @status, @iconType, @email, @phone, @linkedClientId, @linkedClientName, @payoutDueDate, @notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  insertVendor.run({
    id: "vnd-niroshan",
    name: "Niroshan UI Studio",
    service: "Frontend & Component Styling",
    balanceCents: 150000, // $1,500.00
    status: "PENDING",
    iconType: "design",
    email: "niroshan@uistudio.dev",
    phone: "+94 76 543 2109",
    linkedClientId: "cli-technova",
    linkedClientName: "TechNova Solutions",
    payoutDueDate: "2026-10-20",
    notes: "Contractor responsible for responsive Tailwind frontend components",
  });

  // 10. Work Orders
  const insertWorkOrder = db.prepare(`
    INSERT INTO work_orders (id, vendor_id, task_id, invoice_id, scope, fee_cents, currency, due_date, status, delivery_url, notes)
    VALUES (@id, @vendorId, @taskId, @invoiceId, @scope, @feeCents, @currency, @dueDate, @status, @deliveryUrl, @notes)
  `);

  insertWorkOrder.run({
    id: "wo-technova-ui",
    vendorId: "vnd-niroshan",
    taskId: "tsk-web",
    invoiceId: "inv-technova",
    scope: "Frontend responsive Tailwind components for client portal",
    feeCents: 150000,
    currency: "USD",
    dueDate: "2026-10-18",
    status: "in-progress",
    deliveryUrl: "https://github.com/Chethaka/technova-portal",
    notes: "Deliverable branch will be reviewed by Chethaka before staging merge",
  });

  // 11. Expenses
  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, invoice_id, merchant, description, category, amount_cents, currency, incurred_at, deductible, created_at)
    VALUES (@id, @invoiceId, @merchant, @description, @category, @amountCents, @currency, @incurredAt, @deductible, CURRENT_TIMESTAMP)
  `);

  insertExpense.run({
    id: "exp-vercel",
    invoiceId: null,
    merchant: "Vercel Inc.",
    description: "Vercel Pro Subscription (Hosting & Deployments)",
    category: "software",
    amountCents: 2000, // $20.00
    currency: "USD",
    incurredAt: "2026-10-01",
    deductible: 1,
  });

  insertExpense.run({
    id: "exp-github",
    invoiceId: null,
    merchant: "GitHub / Microsoft",
    description: "GitHub Copilot & Teams Subscription",
    category: "software",
    amountCents: 3900, // $39.00
    currency: "USD",
    incurredAt: "2026-10-02",
    deductible: 1,
  });

  insertExpense.run({
    id: "exp-openai",
    invoiceId: null,
    merchant: "OpenAI / Anthropic",
    description: "AI API Usage & Prototyping Credits",
    category: "software",
    amountCents: 8500, // $85.00
    currency: "USD",
    incurredAt: "2026-10-03",
    deductible: 1,
  });

  insertExpense.run({
    id: "exp-cloudflare",
    invoiceId: null,
    merchant: "Cloudflare",
    description: "Domain & SSL Certificate Management",
    category: "hosting",
    amountCents: 2500, // $25.00
    currency: "USD",
    incurredAt: "2026-10-04",
    deductible: 1,
  });
})();

console.log("Database seeded successfully!");
