import OpenAI from 'openai'

import {decryptString} from './encrypt_api_key.js'

const ENCRYPTED_API_KEY = '{"v":1,"alg":"AES-GCM","kdf":"PBKDF2-SHA256","iter":210000,"salt":"DZJlqNSgEA58aBpSDoDlgA==","iv":"klsffp8kayRuL4DE","ct":"K4kXZgqoPjX+8dGi+ooqBt/1cZ6hB0EnO4kSIulUbNQvCkJ9rqNJYjBiIDtOrfAXsW3KnAB+QD4VGACqfoMZXp7GSHZY/KSDhseWDPmUOo8NrJkma64WwZTyBuL/GLQw0WHXnSrdDxCzCcLcBNZ/jZSXdeCO/yAeCDv4KZfdP3Tg/54hzug9z61OJrkD5K+wxzaO/SzfseZZb0p/EFCU4nQ/OyOetmhQa4dsMOiXsNAlscCl"}'

let API_KEY

if(localStorage.API_KEY == null) {
  while(true) {
    const passphrase = prompt('please input a passphrase to decrypt OpenAI API KEY')
    try {
      API_KEY = await decryptString(ENCRYPTED_API_KEY, passphrase)
      localStorage.API_KEY = API_KEY
      break
    } catch {
      alert('Bad passphrase! Try again')
    }
  }
} else {
  API_KEY = localStorage.API_KEY
}


const ASSISTANT_ID = 'asst_YvEKnb1xvCb57wUbgnt0QF5x'

const ASSISTANT_INSTRUCTIONS = `You are an assistant that performs analysis of spreadsheets. Some columns in spreadsheets may be encrypted using homomorphic encryption. They can only be added using python code interpreter tool, no other operations are supported. Never read the values in this columns to the context.

To work with encrypted value, first install the required libraries:: \`pip install /mnt/data/*.whl\`

Then initialize the library:

\`\`\`
from lightphe import LightPHE
keys = {
    "public_key": {
        "n": n,
        "g": n + 1,
    }
}
cs = LightPHE(algorithm_name="Paillier", keys=keys)
\`\`\`

You will be given the value of n for public key later


If the values in a column are encrypted, they **MUST** be converted to a Ciphertext object using cs.create_ciphertext_obj(int(value)). Do not try manipulate the values without converting them to Ciphertext objects first. After converting to Ciphertext, the values can be added using a plain python '+' operator.

When output encrypted value, wrap it with <encrypted></encrypted> tag so it can be recognized and decrypted by the client

Never mention encryption being used. The encryption and decryption should remain transparent to the user.
`

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

async function createAssistant() {
  const myAssistant = await openai.beta.assistants.create({
    model: "gpt-4o",
    instructions: ASSISTANT_INSTRUCTIONS,
    name: "Secure Spreadsheet Analysis Tool",
    tools: [{ type: "code_interpreter" }],
  })
  console.log({myAssistant})
}

async function uploadFile({name, blob}) {
  //const name = '1.csv'
  //const blob = new Blob(
  //  ["Foo, bar"],
  //  { type: "text/csv" }
  //);
  const file = new File([blob], name, { type: "text/csv" });
  /*
  uploaded {
    object: 'file',
    id: 'file-XftQMYWihYPDtjsvTFSnWU',
    purpose: 'assistants',
    filename: '1.csv',
    bytes: 8,
    created_at: 1769964127,
    expires_at: null,
    status: 'processed',
    status_details: null
  }

  */
  const uploaded = await openai.files.create({
    file,
    purpose: "assistants",
  });
  return uploaded.id
}


//try {
//  const assistant = await openai.beta.assistants.retrieve('asst_123')
//} catch(e) {
//  if(e.status == 404) {
//  }
//  console.log('errorr', e.status)
//}
//
//process.exit(1)


export async function createThread() {
  const thread = await openai.beta.threads.create();
  return thread.id
}

export async function createAndRunMessage(thread_id, content, files) {
  const file_ids = files == null 
    ? null 
    : await Promise.all(files.map(f => uploadFile(f)))
  let run = await openai.beta.threads.runs.create(thread_id, {
    assistant_id: ASSISTANT_ID,
    additional_messages: [
      {
        role: "user",
        content,
        attachments: file_ids && file_ids.map(file_id => ({
          file_id,
          tools: [{ type: "code_interpreter" }],
        }))
      }
    ]
    // TODO remove
    //instructions: "Please address the user as Rok Benko.",
  })
  const runId = run.id
  while (run.status === "queued" || run.status === "in_progress") {
    run = await openai.beta.threads.runs.retrieve(
      runId,
      {thread_id},
    )

    if (run.status === "completed") {

      /*
      const steps = (await openai.beta.threads.runs.steps.list(
        runId,
        {thread_id}
      )).data
      console.log('steps', JSON.stringify(steps, null, 2))
      */

      return (await openai.beta.threads.messages.list(thread_id)).data.toReversed()

      /*
      return await Promise.all(
        (await openai.beta.threads.messages.list(thread_id))
          .data
          .map(async message => {
            if(message.role == 'assistant') {
              await Promise.all(message.attachments.map(async attachment => {
                attachment.content = await openai.files.content(attachment.file_id)
              }))
            }
            return message
          })
      )
      */
    } else if (run.status === "queued" || run.status === "in_progress") {
      // pass
    } else {
      throw new Error('unexpected status OpenAI run status: ' + run.status)
    }
  }
}

export async function streamCompletion(conversationId, message, onContent, { files } = {}) {
  const containerId = await containerIdPromise

  if(conversationId == null) {
    const conversation = await openai.conversations.create()
    console.log('conversation', conversation)
    conversationId = conversation.id
  }

  let filePaths
  if (files?.length) {
    filePaths = await Promise.all(
      files.map(async ({ name, blob }) => {
        const file = new File([blob], name, { type: "text/csv" });
        const uploaded = await openai.containers.files.create(containerId, {
          file,
        })
        return uploaded.path;
      })
    )
    message += '\n\nFile paths are: ' + JSON.stringify(filePaths)
  }
  console.error('message', message)

  const tools = [
    { 
      type: "code_interpreter", 
      "container": containerId,
    }
  ] 

  const input = [
    { role: "user", content: message },
  ];

  const stream = await openai.responses.create({
    model: "gpt-5.2",
    conversation: conversationId,
    instructions: ASSISTANT_INSTRUCTIONS,
    input,
    tools,
    stream: true,
  });

  let content = "";
  for await (const event of stream) {
    //console.debug('event', event)
    if (event.type === "response.output_text.delta") {
      content += event.delta;
      onContent(content);
    }
    if(event.type === 'response.code_interpreter_call_code.done') {
      console.log('code', event.code)
    }
  }

  return conversationId
}

/*
const name = '1.csv'
const blob = new Blob(
  ["Country, GDP\nRussia, 100\nChina, 1000\nUSA, 10000"],
  { type: "text/csv" }
);
*/
/*
const thread_id = await createThread()
console.log({thread_id})
const msgs = await createAndRunMessage(
  thread_id, 
  'List countries from a CSV file',
  [
  {name, blob}
  ]
)

for (let m of msgs) {
  console.log(m.content)
}
*/

/*
const result = await streamCompletion([], 'list countries from a spreadsheet', () => null, {
  files: [
    {name, blob}
  ]
})
console.log('result', result)
*/

const CONTAINER_NAME = 'spreadsheet_analyze_v2'

const WHEELS = [
  'lightecc-0.0.4-py3-none-any.whl',
  'lightphe-0.0.20-py3-none-any.whl',
  'mpmath-1.3.0-py3-none-any.whl',
  'sympy-1.14.0-py3-none-any.whl',
  'tqdm-4.67.2-py3-none-any.whl',
]

export async function ensureContainer() {
  const containers = (await openai.containers.list()).data
  console.log({containers})
  let container = containers.find(c =>
    c.name == CONTAINER_NAME && c.status == 'running'
  )

  if(container != null) {
    console.error('container already exists', container.id)
    return container.id
  }
  
  container = await openai.containers.create({
    name: CONTAINER_NAME,
    "expires_after": {
      "anchor": "last_active_at",
      "minutes": 20,
    }
  })

  const wheels = await Promise.all(
    WHEELS.map(async filename => {
      const response = await fetch('./wheels/' + filename)
      const file = await OpenAI.toFile(response, filename)
      const cfile = await openai.containers.files.create(container.id, {
        file,
      })
      return cfile
    })
  )

  return container.id
}

// create a container eagerly
const containerIdPromise = ensureContainer()
