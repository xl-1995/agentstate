/**
 * Customer-support state layer as an MCP server (stdio).
 *
 *   npm run mcp
 *
 * Point an MCP client (e.g. Claude Desktop) at this command. The model gets
 * four tools — get_object, list_available_actions, request_action,
 * get_audit_trail — and cannot change anything except by proposing an action
 * that the engine approves.
 *
 * Set AGENTSTATE_DB to persist the world to a file (default is in-memory).
 */
import { createMcpServer, serveStdio } from "../../src/mcp/server";
import { buildApp } from "./app";

const dbFile = process.env.AGENTSTATE_DB ?? ":memory:";
const { engine } = buildApp(dbFile);
const server = createMcpServer(engine, { name: "agentstate-customer-support" });

serveStdio(server).catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
