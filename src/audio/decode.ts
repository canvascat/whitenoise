import { audioUrl } from "../data/paths";
import { audioDebug } from "../lib/audioDebug";

export async function fetchAndDecode(
  ctx: BaseAudioContext,
  name: string,
  cache: Map<string, AudioBuffer>,
  fetchBuffer?: (url: string) => Promise<ArrayBuffer>,
): Promise<AudioBuffer> {
  const hit = cache.get(name);
  if (hit) return hit;
  const url = audioUrl(name);
  try {
    const buf = fetchBuffer ? await fetchBuffer(url) : await (await fetch(url)).arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    cache.set(name, audio);
    return audio;
  } catch (err) {
    audioDebug.error("decode failed", { name, url, err: String(err) });
    throw err;
  }
}
