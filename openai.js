const API_KEY = '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'

import OpenAI from "@openai";

const client = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function streamCompletion(history, message, onContent) {
  const stream = await client.responses.create({
    model: "gpt-4.1",
    input: [
      ...history,
      { role: "user", content: message },
    ],
    stream: true,
  });

  let content = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      content += event.delta;
      onContent(content);
    }
  }
  return content;
}
