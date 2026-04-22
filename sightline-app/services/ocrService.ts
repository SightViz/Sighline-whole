import Constants from "expo-constants";
import { File } from "expo-file-system";

export interface OCRResult {
  text: string;
  summary: string;
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Read GPT_API_KEY baked in by app.config.js → expo-constants. */
const getApiKey = (): string => {
  const key =
    (Constants.expoConfig?.extra as Record<string, string> | undefined)
      ?.GPT_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "GPT_API_KEY is not configured. Add it to your .env and restart the dev server."
    );
  }
  return key;
};

/**
 * Call the OpenAI chat completions API directly via fetch.
 * Avoids AI SDK compatibility issues in React Native.
 */
async function openAIChat(
  apiKey: string,
  messages: object[],
  maxTokens = 3000
): Promise<string> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => response.status.toString());
    console.error("[OCR] OpenAI HTTP error", response.status, body.slice(0, 300));
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  console.log("[OCR] OpenAI response status:", response.status);

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Capture a document image, extract all text, and generate a spoken summary
 * using GPT-4o vision — called directly from the app via the OpenAI REST API.
 */
export const performOCR = async (imageUri: string): Promise<OCRResult> => {
  console.log("[OCR] performOCR called with uri:", imageUri);
  const apiKey = getApiKey();
  console.log("[OCR] API key present:", !!apiKey);

  console.log("[OCR] Reading file as base64...");
  const fileRef = new File(imageUri);
  const base64 = await fileRef.base64();
  console.log("[OCR] base64 length:", base64.length);

  const raw = await openAIChat(
    apiKey,
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You are an OCR assistant for a visually impaired user.\n" +
              "1. Extract ALL visible text from this document image exactly as it appears.\n" +
              "2. Write a concise spoken summary (2-4 sentences) describing what kind of document this is " +
              "and its key information, as if reading it aloud to someone who cannot see it.\n" +
              "Respond with JSON only — no markdown fences:\n" +
              '{"text": "full extracted text", "summary": "spoken summary"}',
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    3000
  );

  console.log("[OCR] Raw response from OpenAI:", raw.slice(0, 200));

  let parsed: { text?: string; summary?: string } = {};
  try {
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(clean);
    console.log("[OCR] Parsed successfully. text length:", parsed.text?.length, "summary:", parsed.summary?.slice(0, 80));
  } catch (e) {
    console.warn("[OCR] JSON parse failed, using raw text:", e);
    parsed = {
      text: raw,
      summary: "Document scanned. Please read the extracted text.",
    };
  }

  return {
    text: (parsed.text ?? "").trim(),
    summary: (parsed.summary ?? "No summary available.").trim(),
  };
};

/**
 * Answer a question about a previously scanned document using GPT-4o.
 * The full extracted text is passed as context.
 */
export const chatWithDocument = async (
  context: string,
  question: string
): Promise<string> => {
  const apiKey = getApiKey();

  return openAIChat(
    apiKey,
    [
      {
        role: "system",
        content:
          "You are a helpful assistant for a visually impaired user who has just scanned a document. " +
          "Here is the full extracted text from that document:\n\n" +
          "---\n" +
          context +
          "\n---\n\n" +
          "Answer the user's question clearly and concisely in 1-3 sentences. " +
          "Keep your response suitable for text-to-speech — no bullet points, no markdown.",
      },
      {
        role: "user",
        content: question,
      },
    ],
    300
  );
};
