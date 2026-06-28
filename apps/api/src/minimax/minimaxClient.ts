import { env } from '../config/env.js'

export class MiniMaxClient {
  private readonly baseUrl = 'https://api.minimax.io/v1'

  static isAvailable(): boolean {
    return !!(env.MINIMAX_API_KEY && env.MINIMAX_GROUP_ID)
  }

  static unavailableReason(): string | undefined {
    if (!env.MINIMAX_API_KEY) return 'MINIMAX_API_KEY not set'
    if (!env.MINIMAX_GROUP_ID) return 'MINIMAX_GROUP_ID not set'
    return undefined
  }

  async textToSpeech(text: string): Promise<{ audioUrl: string | null; durationSec: number }> {
    if (!MiniMaxClient.isAvailable()) {
      throw new Error('MiniMax not configured: ' + MiniMaxClient.unavailableReason())
    }

    const res = await fetch(`${this.baseUrl}/t2a_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-02-hd',
        text: text.slice(0, 4000),
        stream: false,
        voice_setting: { voice_id: 'male-qn-qingse', speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MiniMax TTS error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as Record<string, unknown>
    const data = json['data'] as Record<string, unknown> | undefined
    const audioUrl = (data?.['audio_file'] as string | undefined) ?? null

    return {
      audioUrl,
      durationSec: Math.round(text.split(' ').length / 2.5),
    }
  }
}
