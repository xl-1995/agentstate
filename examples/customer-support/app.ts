import { Engine, SqliteStorage } from "../../src/index";
import { customerSupportActions } from "./actions";
import { buildSeed } from "./seed";

export interface App {
  engine: Engine;
  storage: SqliteStorage;
}

/**
 * Wire the customer-support domain onto the engine: register the governed
 * actions and seed a small world through the ledger.
 *
 * @param dbFile path to a SQLite file, or ":memory:" (default) for an
 *               ephemeral world that rebuilds on every run.
 */
export function buildApp(dbFile = ":memory:"): App {
  const storage = new SqliteStorage(dbFile);
  storage.reset();
  const engine = new Engine(storage).registerAll(customerSupportActions);
  engine.seed(buildSeed());
  return { engine, storage };
}
