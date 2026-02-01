const API_KEY =  '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'

import OpenAI from "@openai";
import './chat.js'

const client = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

//const response = await client.responses.create({
//  model: "gpt-5.2",
//  input: "Hello"
//});
//console.log('resp', response.output_text)
