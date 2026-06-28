import { GoogleGenerativeAI, type GenerateContentRequest, type Tool } from '@google/generative-ai'
import { env } from '../config/env.js'

export class GeminiClient {
  private readonly genai: GoogleGenerativeAI

  constructor() {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }

  static isAvailable(): boolean {
    return !!env.GEMINI_API_KEY
  }

  /** Fast model — prompt parsing, planning, quick drafts. */
  fastModel(tools?: Tool[]) {
    return this.genai.getGenerativeModel({
      model: env.GEMINI_FAST_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
      ...(tools ? { tools } : {}),
    })
  }

  /** Report verification model — only if GEMINI_REPORT_MODEL is configured. */
  reportModel(tools?: Tool[]) {
    const modelName = env.GEMINI_REPORT_MODEL || env.GEMINI_FAST_MODEL
    return this.genai.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
      ...(tools ? { tools } : {}),
    })
  }

  get fastModelName(): string {
    return env.GEMINI_FAST_MODEL
  }

  get reportModelName(): string {
    return env.GEMINI_REPORT_MODEL || env.GEMINI_FAST_MODEL
  }
}

export const gemini = GeminiClient.isAvailable() ? new GeminiClient() : null
