import OpenAI, { toFile } from "openai";

/**
 * Transcribes audio buffer to text using OpenAI Whisper API.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename = "voice.oga",
  language = "ru"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "placeholder-openai-key" || apiKey.startsWith("sk-proj-placeholder")) {
    throw new Error("OpenAI API ключ не настроен для расшифровки голоса.");
  }

  const openai = new OpenAI({ apiKey });

  try {
    const file = await toFile(audioBuffer, filename);

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
    });

    return transcription.text.trim();
  } catch (error: any) {
    console.error("Whisper transcription error:", error);
    throw new Error(error.message || "Не удалось расшифровать аудио");
  }
}
