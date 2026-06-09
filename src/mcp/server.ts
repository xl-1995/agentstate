import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Engine } from "../core/engine";

/**
 * Exposes an Engine to any MCP client (Claude Desktop, etc.) through exactly
 * four tools. The model can read state and *propose* actions — it can never
 * mutate state directly. Every change goes through request_action and is
 * adjudicated by the engine.
 */
export function createMcpServer(engine: Engine, opts: { name?: string; version?: string } = {}): McpServer {
  const server = new McpServer({
    name: opts.name ?? "agentstate",
    version: opts.version ?? "0.0.1",
  });

  const json = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  server.tool(
    "get_object",
    "Read the current state of a single object (the situation right now), e.g. an Order or Ticket.",
    { type: z.string(), id: z.string() },
    ({ type, id }) => {
      const obj = engine.getObject(type, id);
      return json(obj ?? { error: "not_found", type, id });
    },
  );

  server.tool(
    "list_available_actions",
    "List every governed action, its description, and its input schema. These are the ONLY ways the world can change.",
    {},
    () =>
      json(
        engine.list().map((a) => ({
          name: a.name,
          description: a.description,
          input: zodToJsonSchema(a.input, { $refStrategy: "none" }),
        })),
      ),
  );

  server.tool(
    "request_action",
    "Propose an action. The engine adjudicates and returns applied | denied | needs_approval. " +
      "On needs_approval, re-submit with approvedBy set to an authorised Agent id.",
    {
      name: z.string().describe("Action name from list_available_actions"),
      input: z.record(z.any()).describe("Action input arguments"),
      actor: z.string().describe("Agent id performing the action"),
      approvedBy: z.string().optional().describe("Approver Agent id, when re-submitting after needs_approval"),
    },
    ({ name, input, actor, approvedBy }) => json(engine.requestAction(name, input, actor, { approvedBy })),
  );

  server.tool(
    "get_audit_trail",
    "Read the append-only event ledger: who did what, on what state, why it was allowed, and the result.",
    {
      objectType: z.string().optional(),
      objectId: z.string().optional(),
      actor: z.string().optional(),
      type: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    (filter) => json(engine.auditTrail(filter)),
  );

  return server;
}

/** Convenience: run the server over stdio. */
export async function serveStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
