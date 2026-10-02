require("dotenv").config();

const API_BASE_URL = (process.env.SMOKE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const PRINT_AGENT_HEALTH_URL = process.env.SMOKE_PRINT_AGENT_HEALTH_URL || "http://localhost:3000/health";
const PASSWORD = process.env.SEED_MONO_PASSWORD || "ChangeMe123!";
const PRINT_NOW = process.env.SMOKE_PRINT_NOW === "true";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoPlusDays(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + offset);
  return toIsoDate(today);
}

async function findNextAvailablePickupDate(client, quantity = 1) {
  for (let offset = 0; offset < 21; offset += 1) {
    const candidateDate = toIsoPlusDays(offset);
    // eslint-disable-next-line no-await-in-loop
    const availability = await client.request(`/timeslots/availability?date=${candidateDate}&quantity=${quantity}`);
    const hasAvailableSlot = (availability.slots || []).some((entry) => {
      return (
        entry.availableForQuantity !== false &&
        entry.active !== false &&
        Number(entry.remainingCapacity ?? 1) >= quantity
      );
    });
    if (hasAvailableSlot) return candidateDate;
  }
  throw new Error("Unable to find an available pickup date in the next 21 days");
}

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function createSession() {
  const cookies = new Map();
  let csrfToken = "";

  function rememberCookies(headers) {
    for (const entry of readSetCookieHeaders(headers)) {
      const [cookiePair] = String(entry || "").split(";");
      const separatorIndex = cookiePair.indexOf("=");
      if (separatorIndex <= 0) continue;
      const name = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      if (name && value) cookies.set(name, value);
    }

    const nextCsrfToken = headers.get("x-csrf-token");
    if (nextCsrfToken) {
      csrfToken = nextCsrfToken;
    }
  }

  function cookieHeader() {
    return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async function sessionRequest(pathname, options = {}) {
    const method = options.method || "GET";
    const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
    const response = await fetch(`${API_BASE_URL}${pathname}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(cookies.size ? { Cookie: cookieHeader() } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(isMutating && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    rememberCookies(response.headers);

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = payload?.error || payload || `HTTP ${response.status}`;
      throw new Error(`${method} ${pathname} failed: ${message}`);
    }

    return payload;
  }

  return {
    request: sessionRequest,
  };
}

async function request(pathname, options = {}) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload || `HTTP ${response.status}`;
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${message}`);
  }

  return payload;
}

async function login(email) {
  const session = createSession();
  await session.request("/users/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  return session;
}

async function waitForPrintedJob(admin, jobId, orderId) {
  const deadline = Date.now() + 30_000;
  let lastStatus = "NOT_FOUND";

  while (Date.now() < deadline) {
    const tickets = await admin.request(`/print/admin/jobs?orderId=${encodeURIComponent(orderId)}&limit=120`);
    const printedJob = tickets.find((entry) => String(entry.id) === String(jobId));
    lastStatus = printedJob?.status || "NOT_FOUND";
    if (printedJob?.status === "PRINTED") {
      return printedJob;
    }

    const agentHealthResponse = await fetch(PRINT_AGENT_HEALTH_URL);
    if (agentHealthResponse.ok) {
      const agentHealth = await agentHealthResponse.json();
      const printerJobs = Array.isArray(agentHealth.printers)
        ? agentHealth.printers.map((printer) => printer.lastJobId)
        : [];
      const observedJobIds = [agentHealth.lastJobId, agentHealth.spool?.lastJobId, ...printerJobs]
        .filter(Boolean)
        .map(String);

      if (observedJobIds.includes(String(jobId)) && agentHealth.lastPrintAt) {
        return {
          id: jobId,
          status: "PRINTED",
          observedFrom: "print-agent-health",
          printedAt: agentHealth.lastPrintAt,
        };
      }
    }

    await sleep(1_000);
  }

  throw new Error(`Print job ${jobId} was not PRINTED before timeout; last status: ${lastStatus}`);
}

async function main() {
  const client = await login("client@mono-camion.local");
  const admin = await login("admin@mono-camion.local");
  const pickupDate = process.env.SMOKE_PICKUP_DATE || await findNextAvailablePickupDate(client, 1);

  const products = await request("/products");
  const product = products.find((entry) => entry.name === "Margherita") || products[0];
  if (!product) throw new Error("No product available for smoke test");

  const cart = await client.request("/orders/cart", {
    method: "POST",
    body: {
      productId: product.id,
      quantity: 1,
      customizations: {},
    },
  });

  const availability = await client.request(`/timeslots/availability?date=${pickupDate}&quantity=1`);
  const candidateSlots = (availability.slots || []).filter((entry) => {
    return (
      entry.availableForQuantity !== false &&
      entry.active !== false &&
      Number(entry.remainingCapacity ?? 1) >= 1
    );
  });
  if (candidateSlots.length === 0) throw new Error(`No pickup slot available on ${pickupDate}`);

  let slot = null;
  let order = null;
  const skippedSlots = [];
  for (const candidateSlot of candidateSlots) {
    try {
      // eslint-disable-next-line no-await-in-loop
      order = await client.request("/orders/finalize", {
        method: "POST",
        body: {
          pickupDate,
          pickupTime: candidateSlot.pickupTime,
          locationId: candidateSlot.locationId,
          customerNote: "Smoke test mono-camion",
        },
      });
      slot = candidateSlot;
      break;
    } catch (error) {
      const message = String(error?.message || "");
      const canTryNextSlot =
        message.includes("Selected pickup slot") ||
        message.includes("Time slot full") ||
        message.includes("Selected time slot is too soon");
      if (!canTryNextSlot) throw error;
      skippedSlots.push({
        pickupTime: candidateSlot.pickupTime,
        locationId: candidateSlot.locationId,
        reason: message,
      });
    }
  }

  if (!order || !slot) {
    throw new Error(`No candidate pickup slot could be finalized: ${JSON.stringify(skippedSlots)}`);
  }

  const adminOrders = await admin.request(`/orders?date=${pickupDate}&status=IN_PROGRESS&paginated=1&page=1&limit=20`);
  const adminOrder = adminOrders.items?.find((entry) => Number(entry.id) === Number(order.id));
  if (!adminOrder) {
    throw new Error(`Order ${order.id} not visible in admin IN_PROGRESS list`);
  }

  const tickets = await admin.request(`/print/admin/jobs?date=${pickupDate}&limit=80`);
  const ticket = tickets.find((entry) => Number(entry.orderId) === Number(order.id));
  if (!ticket) {
    throw new Error(`No print job found for order ${order.id}`);
  }

  let printedTicket = null;
  if (PRINT_NOW) {
    const reprint = await admin.request(`/print/admin/jobs/${encodeURIComponent(ticket.id)}/reprint`, {
      method: "POST",
      body: {
        copies: 1,
        reason: "mono-camion-smoke-print-now",
      },
    });

    const reprintJob = reprint.jobs?.[0];
    if (!reprintJob?.id) {
      throw new Error(`No reprint job created for ticket ${ticket.id}`);
    }

    printedTicket = await waitForPrintedJob(admin, reprintJob.id, order.id);
  }

  console.log("Mono-camion smoke ready");
  console.log({
    pickupDate,
    pickupTime: slot.pickupTime,
    product: product.name,
    cartId: cart.id,
    orderId: order.id,
    orderStatus: order.status,
    adminWorkflowStatus: adminOrder.workflowStatus,
    ticketId: ticket.id,
    ticketStatus: ticket.status,
    printedTicketId: printedTicket?.id || null,
    printedTicketStatus: printedTicket?.status || null,
    printerCode: ticket.printer?.code || null,
    skippedSlots,
  });
}

main().catch((error) => {
  console.error("Mono-camion smoke failed:", error);
  process.exitCode = 1;
});
