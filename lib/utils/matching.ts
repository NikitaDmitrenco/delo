import { Task, TaskIntent } from "@/types";

const STOP_WORDS = new Set([
  "на", "в", "во", "по", "за", "к", "ко", "до", "из", "с", "со", "у", "о", "об",
  "от", "для", "при", "про", "без", "над", "под", "перед", "через", "после",
  "и", "а", "но", "да", "или", "ли", "не", "ни", "что", "как", "где", "то",
  "задачу", "задача", "задачи", "задаче", "дело", "дела", "нужно", "надо",
  "пожалуйста", "напомни", "плиз"
]);

/**
 * Simple Russian & English stemmer to reduce words to their common grammatical base.
 */
export function stemWord(rawWord: string): string {
  const word = rawWord.toLowerCase().replace(/[^a-zа-яё0-9]/giu, "").trim();
  if (word.length <= 3) return word;

  // Russian inflection endings
  const ruEndings = [
    /вшись$|вши$|вшись$|в$|вши$/,
    /ивший$|ывший$|вший$|авший$|явший$/,
    /ившего$|ывшего$|вшего$|авшего$|явшего$/,
    /евший$|овавший$|евавший$/,
    /ому$|ему$|ыми$|ими$|ого$|его$|ых$|их$|ой$|ей$|ям$|ам$|ах$|ях$/,
    /ую$|юю$|ая$|яя$|ое$|ее$|ые$|ие$|ый$|ий$|ой$|ем$|ом$/,
    /ешь$|ишь$|ете$|ите$|ут$|ют$|ат$|ят$|ла$|ло$|ли$|ть$|ти$/,
    /ов$|ев$|ей$|ья$|ье$|ия$|ие$|а$|я$|у$|ю$|е$|ы$|и$|о$|ь$/
  ];

  let stemmed = word;
  for (const regex of ruEndings) {
    if (regex.test(stemmed) && stemmed.length > 3) {
      stemmed = stemmed.replace(regex, "");
      break;
    }
  }

  return stemmed;
}

/**
 * Tokenizes a string into an array of meaningful stemmed words, excluding stop words.
 */
export function extractStems(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/iu)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  return words.map(w => stemWord(w)).filter(w => w.length >= 3);
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[bn][an];
}

/**
 * Calculates similarity score (0.0 to 1.0) between query text and task title.
 */
export function calculateMatchScore(taskTitle: string, query: string): number {
  const normTitle = taskTitle.toLowerCase().trim();
  const normQuery = query.toLowerCase().trim();

  // Exact match
  if (normTitle === normQuery) return 1.0;

  // Direct full substring match
  if (normTitle.includes(normQuery) && normQuery.length >= 4) {
    return 0.85 + (normQuery.length / normTitle.length) * 0.15;
  }

  // Token stem overlap
  const queryStems = extractStems(normQuery);
  const titleStems = extractStems(normTitle);

  if (queryStems.length === 0 || titleStems.length === 0) return 0;

  let matchedStemsCount = 0;
  for (const qStem of queryStems) {
    const found = titleStems.some(
      (tStem) =>
        tStem === qStem ||
        (tStem.length >= 4 && qStem.length >= 4 && (tStem.startsWith(qStem) || qStem.startsWith(tStem))) ||
        (qStem.length >= 5 && levenshteinDistance(qStem, tStem) <= 1)
    );
    if (found) matchedStemsCount++;
  }

  const stemOverlapScore = matchedStemsCount / queryStems.length;
  return stemOverlapScore >= 0.5 ? stemOverlapScore * 0.85 : 0;
}

/**
 * Finds the single best matching task from a user's task list based on intent and search query.
 */
export function findBestMatchingTask(
  tasks: Task[],
  query: string | null | undefined,
  intent: TaskIntent = "complete_task"
): Task | null {
  if (!tasks || tasks.length === 0 || !query || !query.trim()) {
    return null;
  }

  const trimmedQuery = query.trim();
  let bestTask: Task | null = null;
  let highestScore = 0;

  for (const task of tasks) {
    const rawScore = calculateMatchScore(task.title, trimmedQuery);
    if (rawScore <= 0.35) continue;

    // Status weighting:
    // If intent is uncomplete, prefer already completed tasks (+0.1 bonus)
    // For all other actions (complete, delete, edit, deadline), prefer active/uncompleted tasks (+0.1 bonus)
    let score = rawScore;
    if (intent === "uncomplete_task") {
      if (task.completed) score += 0.1;
    } else {
      if (!task.completed) score += 0.1;
    }

    if (score > highestScore) {
      highestScore = score;
      bestTask = task;
    }
  }

  return highestScore >= 0.4 ? bestTask : null;
}
