/** MIT-licensed host integration. SDK use is governed by the accompanying noncommercial license. */
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { Client, DeliveryResult } from "@phronesis-io/eigenflux-sdk";
/** Replace this inbox with the host Agent's durable queue. */
export class ReferenceInbox {
    database;
    tainted = false;
    constructor(path) {
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
            if (process.platform !== "win32")
                chmodSync(path, 0o600);
        }
        catch {
            this.database.close();
            throw new Error("durable_inbox_initialization_failed");
        }
    }
    accept(delivery) {
        if (this.tainted)
            return DeliveryResult.unknown();
        if (delivery.cancelled)
            return DeliveryResult.busy(5);
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
            const receipt = `reference-agent:${delivery.batchId}`;
            this.database.prepare("INSERT INTO batches VALUES(?,?,?,?)").run(delivery.batchId, String(delivery.sequence), receipt, JSON.stringify(delivery.feed));
            const insert = this.database.prepare("INSERT OR IGNORE INTO items VALUES(?,?,?)");
            for (const item of delivery.items) {
                if (typeof item.item_id !== "string")
                    throw new Error("invalid_item_identifier");
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
        }
        catch {
            if (transaction) {
                try {
                    this.database.exec("ROLLBACK");
                }
                catch {
                    this.tainted = true;
                }
            }
            // A database error is not authoritative proof that commit did not happen.
            return DeliveryResult.unknown();
        }
    }
    status(batchId) {
        // A failed rollback may leave uncommitted rows visible on this connection.
        if (this.tainted)
            return DeliveryResult.unknown();
        try {
            const row = this.database.prepare("SELECT receipt FROM batches WHERE batch_id=?").get(batchId);
            return row && typeof row.receipt === "string"
                ? DeliveryResult.accepted(row.receipt)
                : DeliveryResult.notAccepted();
        }
        catch {
            return DeliveryResult.unknown();
        }
    }
    close() { this.database.close(); }
}
/** Host-owned storage identity. Never guess a different file after an upgrade. */
export function openReceiptStore(stateDir, inboxFile, stateExisted) {
    const binding = resolve(stateDir, "host-receipt-store.json");
    if (stateExisted && !existsSync(inboxFile))
        throw new Error("existing_receipt_store_required");
    const path = existsSync(inboxFile) ? realpathSync(inboxFile) : resolve(inboxFile);
    if (existsSync(binding)) {
        const saved = JSON.parse(readFileSync(binding, "utf8"));
        if (saved.schema !== 1 || saved.path !== path)
            throw new Error("receipt_store_binding_mismatch");
    }
    const store = new ReferenceInbox(inboxFile);
    try {
        if (!existsSync(binding)) {
            writeFileSync(binding, JSON.stringify({ schema: 1, path: realpathSync(inboxFile) }), { mode: 0o600, flag: "wx" });
        }
        return store;
    }
    catch (error) {
        store.close();
        throw error;
    }
}
export async function main() {
    const required = (name) => {
        const value = process.env[name]?.trim();
        if (!value)
            throw new Error("explicit_agent_configuration_required");
        return value;
    };
    const baseUrl = required("EIGENFLUX_BASE_URL");
    const appCredential = required("EIGENFLUX_APP_CREDENTIAL");
    const contextFile = resolve(required("EXAMPLE_AGENT_CONTEXT_FILE"));
    const stateDir = resolve(required("EXAMPLE_AGENT_STATE_DIR"));
    const inboxFile = resolve(required("EXAMPLE_AGENT_INBOX_FILE"));
    const externalAgentId = required("EXAMPLE_AGENT_ID");
    const runtimeName = required("EXAMPLE_AGENT_PRODUCT_NAME");
    const runtimeVersion = required("EXAMPLE_AGENT_PRODUCT_VERSION");
    const stateExisted = existsSync(resolve(stateDir, "state.json"));
    if (stateExisted && !existsSync(inboxFile))
        throw new Error("existing_receipt_store_required");
    let inbox;
    let finish;
    const stopped = new Promise((done) => { finish = done; });
    let shuttingDown = false;
    const shutdown = () => { shuttingDown = true; finish(); };
    const client = new Client({
        baseUrl,
        appCredential,
        externalAgentId,
        runtimeName,
        runtimeVersion,
        stateDir,
        feedPollIntervalSeconds: Number(process.env.EXAMPLE_AGENT_POLL_SECONDS ?? "3600"),
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
        if (shuttingDown)
            return;
        // Go has now protected this directory with POSIX modes / a Windows DACL.
        inbox = openReceiptStore(stateDir, inboxFile, stateExisted);
        await Promise.race([client.waitUntilRegistered(60_000), stopped]);
        if (!shuttingDown)
            console.info("Example Agent is connected; accepted Feed is in the durable inbox.");
        await Promise.race([stopped, client.waitUntilStopped()]);
        if (!shuttingDown)
            throw new Error("sdk_process_stopped");
    }
    finally {
        process.removeListener("SIGINT", shutdown);
        process.removeListener("SIGTERM", shutdown);
        await client.stop();
        inbox?.close();
    }
}
function isEntrypoint() {
    if (!process.argv[1])
        return false;
    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    }
    catch {
        return false;
    }
}
if (isEntrypoint()) {
    main().catch(() => {
        console.error("Example Agent SDK stopped; inspect private configuration and local state.");
        process.exitCode = 1;
    });
}
