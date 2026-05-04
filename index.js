import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Инициализация сервера
const server = new Server(
  {
    name: "my-custom-server",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  },
);

// 1. Определение списка доступных инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "calculate_sum",
      description: "Складывает два числа",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
  ],
}));

// 2. Обработка вызова инструмента
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "calculate_sum") {
    const { a, b } = request.params.arguments;
    return {
      content: [{ type: "text", text: String(a + b) }],
    };
  }
  throw new Error("Tool not found");
});

// Запуск через стандартные потоки ввода-вывода (STDIO)
const transport = new StdioServerTransport();
await server.connect(transport);
