const API_KEY = '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'

import OpenAI from "@openai";

const client = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function streamCompletion(history, message, onContent, { files } = {}) {
  let fileIds;
  if (files?.length) {
    fileIds = await Promise.all(
      files.map(async ({ name, blob }) => {
        const file = new File([blob], name);
        const uploaded = await client.files.create({
          file,
          purpose: "assistants",
        });
        return uploaded.id;
      })
    );
  }

  const tools = fileIds?.length ? [{ type: "code_interpreter" }] : undefined;

  const input = [
    ...history,
    fileIds?.length
      ? {
          role: "user",
          content: [
            { type: "input_text", text: message },
            ...fileIds.map(id => ({
              type: "input_file",
              file_id: id,
            })),
          ],
        }
      : { role: "user", content: message },
  ];

  const stream = await client.responses.create({
    model: "gpt-4.1",
    input,
    tools,
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
