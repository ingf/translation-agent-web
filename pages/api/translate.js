import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'edge'

let allModel = {}

export default async function GET(request) {
  const url = new URL(request.url)

  if (url.pathname === '/favicon.ico') {
    return new Response(null, { status: 204 })
  }

  const queryParams = url.searchParams
  const query = {}
  queryParams.forEach((value, key) => {
    query[key] = value
  })
  console.log('query:', query)

  const {
    llm = 'gemini',
    model,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    text,
    source,
    target,
    country,
  } = query

  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  })

  const genAI = new GoogleGenerativeAI(
    GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  )
  const gemini = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-flash',
  })

  allModel = {
    llm,
    openai,
    gemini,
  }

  const readable = new ReadableStream({
    async start(controller) {
      if (url.pathname === '/api/translate') {
        if (!text) {
          controller.enqueue(new TextEncoder().encode('Missing text parameter'))
          controller.close()
          return
        }
        await handleTranslate(controller, { source, target, text, country })
      } else {
        await handleDefault(controller)
      }
      controller.close()
    },
  })

  const reader = readable.getReader()
  const { value } = await reader.read()
  return new Response(new TextDecoder().decode(value), {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

async function handleDefault(controller) {
  await getCompletion(
    controller,
    'Tell me a story.',
    'You are a helpful assistant.',
  )
}

async function handleTranslate(controller, query) {
  try {
    const { source, target, text, country } = query
    const initialResult = await initialTranslation(
      controller,
      source,
      target,
      text,
    )
    const reflectionResult = await reflectTranslation(
      controller,
      source,
      target,
      text,
      initialResult,
      country,
    )
    await improveTranslation(
      controller,
      source,
      target,
      text,
      initialResult,
      reflectionResult,
    )
  } catch (error) {
    console.error('handleTranslate error:', error)
    controller.enqueue(new TextEncoder().encode('Error processing translation'))
  }
}

async function getCompletion(controller, prompt, systemMessage) {
  const { llm, openai, gemini } = allModel

  if (llm === 'openai') {
    const stream = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      stream: true,
    })
    return handleStream(controller, stream, llm)
  } else if (llm === 'gemini') {
    const chat = gemini.startChat({
      history: [
        { role: 'user', parts: [{ text: systemMessage }] },
        {
          role: 'model',
          parts: [{ text: 'Great to meet you. What would you like to know?' }],
        },
      ],
      generationConfig: { maxOutputTokens: 1000 },
    })
    const result = await chat.sendMessageStream(prompt)
    return handleStream(controller, result.stream, llm)
  }
}

async function handleStream(controller, stream, llm) {
  let chunkText = ''
  const textEncoder = new TextEncoder()

  if (llm === 'openai') {
    for await (const part of stream) {
      const text = part.choices[0]?.delta?.content
      if (text) {
        controller.enqueue(textEncoder.encode(text))
        chunkText += text
      }
    }
  } else if (llm === 'gemini') {
    for await (const chunk of stream) {
      const text = await chunk.text()
      controller.enqueue(textEncoder.encode(text))
      chunkText += text
    }
  }
  return chunkText
}

async function initialTranslation(controller, source, target, text) {
  const systemMessage = `You are an expert linguist, specializing in translation from ${source} to ${target}.`
  const translationPrompt = `This is an ${source} to ${target} translation, please provide the ${target} translation for this text. 
						Do not provide any explanations or text apart from the translation.
						${source}: ${text}
						
						${target}:`
  return getCompletion(controller, translationPrompt, systemMessage)
}

async function reflectTranslation(
  controller,
  source,
  target,
  text,
  initialResult,
  country,
) {
  const systemMessage = `You are an expert linguist specializing in translation from ${source} to ${target}. 
						You will be provided with a source text and its translation and your goal is to improve the translation.`

  const reflectionPrompt = `Your task is to carefully read a source text and a translation from ${source} to ${target}, and then give constructive criticism and helpful suggestions to improve the translation.
						${
              country
                ? `The final style and tone of the translation should match the style of ${target} colloquially spoken in ${country}.`
                : ''
            }

						The source text and initial translation, delimited by XML tags <SOURCE_TEXT></SOURCE_TEXT> and <TRANSLATION></TRANSLATION>, are as follows:

						<SOURCE_TEXT>
						${text}
						</SOURCE_TEXT>

						<TRANSLATION>
						${initialResult}
						</TRANSLATION>

						When writing suggestions, pay attention to whether there are ways to improve the translation's
						(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),
						(ii) fluency (by applying ${target} grammar, spelling and punctuation rules, and ensuring there are no unnecessary repetitions),
						(iii) style (by ensuring the translations reflect the style of the source text and takes into account any cultural context),
						(iv) terminology (by ensuring terminology use is consistent and reflects the source text domain; and by only ensuring you use equivalent idioms ${target}).

						Write a list of specific, helpful and constructive suggestions for improving the translation.
						Each suggestion should address one specific part of the translation.
						Output only the suggestions and nothing else.`

  return getCompletion(controller, reflectionPrompt, systemMessage)
}

async function improveTranslation(
  controller,
  source,
  target,
  text,
  initialResult,
  reflection,
) {
  const systemMessage = `You are an expert linguist, specializing in translation editing from ${source} to ${target}.`

  const prompt = `Your task is to carefully read, then edit, a translation from ${source} to ${target}, taking into account a list of expert suggestions and constructive criticisms.

						The source text, the initial translation, and the expert linguist suggestions are delimited by XML tags <SOURCE_TEXT></SOURCE_TEXT>, <TRANSLATION></TRANSLATION> and <EXPERT_SUGGESTIONS></EXPERT_SUGGESTIONS> as follows:

						<SOURCE_TEXT>
						${text}
						</SOURCE_TEXT>

						<TRANSLATION>
						${initialResult}
						</TRANSLATION>

						<EXPERT_SUGGESTIONS>
						${reflection}
						</EXPERT_SUGGESTIONS>

						Please take into account the expert suggestions when editing the translation. Edit the translation by ensuring:

						(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),
						(ii) fluency (by applying ${target} grammar, spelling and punctuation rules and ensuring there are no unnecessary repetitions),
						(iii) style (by ensuring the translations reflect the style of the source text),
						(iv) terminology (inappropriate for context, inconsistent use), or
						(v) other errors.

						Output only the new translation and nothing else.`

  return getCompletion(controller, prompt, systemMessage)
}
