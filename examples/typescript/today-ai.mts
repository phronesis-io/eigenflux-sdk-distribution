/** MIT-licensed host integration. SDK implementation and binaries are proprietary. */
import { chmodSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { Client, DeliveryResult, type FeedDelivery } from "@phronesis-io/eigenflux-sdk";

/** Replace this inbox with Today AI's durable queue when integrating its Agent. */
export class TodayAIInbox {
  private readonly database: DatabaseSync;
  private tainted = false;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    try {
      this.database.exec(`
      PRAGMA journal_mode=DELETE;
      PRAGMA synchronous=FULL;
      PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS batches (
        batch_id TEXT PRIMARY KEY,
        sequence TEXT NOT NULL,
        receipt TEXT NOT NULL,
        feed TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        item_id TEXT PRIMARY KEY,
        first_batch_id TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      `);
      if (process.platform !== "win32") chmodSync(path, 0o600);
    } catch {
      this.database.close();
      throw new Error("durable_inbox_initialization_failed");
    }
  }

  accept(delivery: FeedDelivery): DeliveryResult {
    if (this.tainted) return DeliveryResult.unknown();
    if (delivery.cancelled) return DeliveryResult.busy(5);
    let transaction = false;
    try {
      this.database.exec("BEGIN IMMEDIATE");
      transaction = true;
      const previous = this.database.prepare("SELECT receipt FROM batches WHERE batch_id=?").get(delivery.batchId);
      if (previous && typeof previous.receipt === "string") {
        this.database.exec("ROLLBACK");
        transaction = false;
        return DeliveryResult.accepted(previous.receipt);
      }
      if (delivery.cancelled) {
        this.database.exec("ROLLBACK");
        transaction = false;
        return DeliveryResult.busy(5);
      }
      const receipt = `today-ai:${delivery.batchId}`;
      this.database.prepare("INSERT INTO batches VALUES(?,?,?,?)").run(
        delivery.batchId, String(delivery.sequence), receipt, JSON.stringify(delivery.feed),
      );
      const insert = this.database.prepare("INSERT OR IGNORE INTO items VALUES(?,?,?)");
      for (const item of delivery.items) {
        if (typeof item.item_id !== "string") throw new Error("invalid_item_identifier");
        insert.run(item.item_id, delivery.batchId, JSON.stringify(item));
      }
      if (delivery.cancelled) {
        this.database.exec("ROLLBACK");
        transaction = false;
        return DeliveryResult.busy(5);
      }
      this.database.exec("COMMIT");
      transaction = false;
      return DeliveryResult.accepted(receipt);
    } catch {
      if (transaction) {
        try { this.database.exec("ROLLBACK"); } catch { this.tainted = true; }
      }
      // A database error is not authoritative proof that commit did not happen.
      return DeliveryResult.unknown();
    }
  }

  status(batchId: string): DeliveryResult {
    // A failed rollback may leave uncommitted rows visible on this connection.
    if (this.tainted) return DeliveryResult.unknown();
    try {
      const row = this.database.prepare("SELECT receipt FROM batches WHERE batch_id=?").get(batchId);
      return row && typeof row.receipt === "string"
        ? DeliveryResult.accepted(row.receipt)
        : DeliveryResult.notAccepted();
    } catch {
      return DeliveryResult.unknown();
    }
  }

  close(): void { this.database.close(); }
}

export async function main(): Promise<void> {
  const baseUrl = process.env.EIGENFLUX_BASE_URL;
  const appCredential = process.env.EIGENFLUX_APP_CREDENTIAL;
  if (!baseUrl || !appCredential) throw new Error("private_application_configuration_required");

  const contextFile = process.env.TODAY_AI_CONTEXT_FILE
    ?? resolve(dirname(fileURLToPath(import.meta.url)), "context.json");
  const stateDir = resolve(process.env.TODAY_AI_STATE_DIR ?? "data/today-ai-sdk");
  let inbox: TodayAIInbox | undefined;
  let finish!: () => void;
  const stopped = new Promise<void>((done) => { finish = done; });
  let shuttingDown = false;
  const shutdown = (): void => { shuttingDown = true; finish(); };
  const client = new Client({
    baseUrl,
    appCredential,
    externalAgentId: process.env.TODAY_AI_AGENT_ID ?? "today-ai-agent-001",
    runtimeName: "today-ai",
    runtimeVersion: process.env.TODAY_AI_PRODUCT_VERSION ?? "unknown",
    stateDir,
    feedPollIntervalSeconds: Number(process.env.TODAY_AI_POLL_SECONDS ?? "3600"),
    autoUpdate: true,
    contextProvider: () => JSON.parse(readFileSync(contextFile, "utf8")),
    pushToAgent: (delivery) => inbox?.accept(delivery) ?? DeliveryResult.busy(5),
    deliveryStatus: (delivery) => inbox?.status(delivery.batchId) ?? DeliveryResult.unknown(),
    onStatus: (state) => {
      // Only coarse state names are displayed, never credentials, context or Feed.
      console.info(`EigenFlux: ${state}`);
    },
  });
  try {
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    client.start();
    await Promise.race([client.waitUntilReady(30_000), stopped]);
    if (shuttingDown) return;
    // Go has now protected this directory with POSIX modes / a Windows DACL.
    inbox = new TodayAIInbox(resolve(stateDir, "today-ai-inbox.sqlite"));
    await Promise.race([client.waitUntilRegistered(60_000), stopped]);
    if (!shuttingDown) console.info("Today AI is connected; accepted Feed is in the durable inbox.");
    await Promise.race([stopped, client.waitUntilStopped()]);
    if (!shuttingDown) throw new Error("sdk_process_stopped");
  } finally {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
    await client.stop();
    inbox?.close();
  }
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main().catch(() => {
    console.error("Today AI SDK stopped; inspect private configuration and local state.");
    process.exitCode = 1;
  });
}
