# Local ML question generation (offline, no rate limit)

A data-science track to make StudySync's **offline** study-material generation
smarter without depending on the Gemini API. We fine-tune a small model to
generate questions, run it **in the browser** via `@xenova/transformers`, and
slot it between Gemini and the rule-based engine.

```
app → aiService → Gemini API ──► local ML model (this) ──► manual-ai (rules)
                  (best,            (good, offline,         (always works)
                   rate-limited)     no limit)
```

## Honest expectations
- **Better than rules, not as good as Gemini.** T5-small phrases natural
  questions but has no real reasoning.
- **~30–60 MB** model download on first use; cached afterward.
- **~1–3 s per question** on CPU/WASM. Generate a deck once, not on every load.
- Best used for **flashcard/quiz question phrasing**, with the rule-based
  keyword extractor choosing what to ask about.

## 1. Train (Jupyter / Colab)
Open [`question-gen.ipynb`](./question-gen.ipynb) on a GPU runtime
(Colab free T4 is enough) and run all cells. It:
1. loads **SQuAD**,
2. reformats it to answer-highlighted question generation,
3. fine-tunes **T5-small** (~30–45 min on a subset),
4. exports to **ONNX** for transformers.js.

Want better quality? Train on the full dataset (remove the `.select(...)`),
more epochs, or start from `t5-base`.

## 2. Deploy the model
- **HF Hub:** push `t5-small-qg-onnx/` to `YOUR_USERNAME/t5-small-qg` (cells in
  the notebook), then set `MODEL_ID` in `src/ml-ai/questionGen.js`.
- **Self-host:** copy the export into `public/models/t5-small-qg/`, set
  `MODEL_ID = '/models/t5-small-qg'` and `env.allowRemoteModels = false`.

## 3. Turn it on in the app
```bash
npm i @xenova/transformers
```
Then add a middle tier in `src/services/aiService.js` — try Gemini, then the
local model, then the rule-based engine:

```js
import { generateFlashcardsML } from '../ml-ai/questionGen.js'

const useLocalMl = import.meta.env.VITE_ML_AI_ENABLED === 'true'

export async function generateFlashcards(content, { max = 12 } = {}) {
  if (isAiConfigured) {
    try {
      const { flashcards } = await callAi('flashcards', { text: content, max })
      if (flashcards?.length) return flashcards.map((c) => ({ ...c, pattern: 'ai' }))
    } catch (e) { console.warn('[ai] flashcards → next tier:', e.message) }
  }
  if (useLocalMl) {
    try {
      const cards = await generateFlashcardsML(content, { max })
      if (cards.length) return cards
    } catch (e) { console.warn('[ai] local ML → manual fallback:', e.message) }
  }
  return manualAI.generateFlashcards(content, { max })
}
```

Set `VITE_ML_AI_ENABLED=true` to enable it. Because `questionGen.js` is only
imported when this tier is wired in, the heavy transformers.js dependency stays
out of the bundle until you opt in.

## Notes / next steps
- transformers.js caches the model in the browser (IndexedDB) after first load.
- Consider a **quiz** variant (generate distractors) and a **difficulty
  classifier** (DistilBERT) as further notebooks.
- Quantize the ONNX model (`*_quantized.onnx`) for a smaller, faster download.
