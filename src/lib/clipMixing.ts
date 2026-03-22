import type { HolodexVideo } from "@/lib/holodex";

interface LangClipBatch {
  lang: string;
  videos: HolodexVideo[];
}

function sortByAvailableAtDesc(videos: HolodexVideo[]) {
  return [...videos].sort((a, b) => {
    const timeA = a.available_at ? new Date(a.available_at).getTime() : 0;
    const timeB = b.available_at ? new Date(b.available_at).getTime() : 0;
    return timeB - timeA;
  });
}

// Mix clips by language in a round-robin way to avoid one language dominating the list.
export function mixClipsByLanguage(batches: LangClipBatch[]) {
  const queues = batches.map((batch) => ({
    lang: batch.lang,
    videos: sortByAvailableAtDesc(batch.videos),
    index: 0,
  }));

  const usedIds = new Set<string>();
  const mixed: HolodexVideo[] = [];

  while (queues.some((queue) => queue.index < queue.videos.length)) {
    for (const queue of queues) {
      while (queue.index < queue.videos.length) {
        const candidate = queue.videos[queue.index];
        queue.index += 1;
        if (usedIds.has(candidate.id)) continue;
        usedIds.add(candidate.id);
        mixed.push(candidate);
        break;
      }
    }
  }

  return mixed;
}
