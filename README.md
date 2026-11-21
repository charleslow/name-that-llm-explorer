# Name That LLM — Response Explorer

A static site for reading every response in the Kaggle competition
[Name That LLM](https://www.kaggle.com/competitions/name-that-llm) train set:
2,699 responses from 18 models across 150 prompts.

**Live: https://charleslow.github.io/name-that-llm-explorer/**

## What it does

- **Model-first browsing** — pick a model, then step through its 150 responses
  prompt by prompt (or hit "Scroll all" for continuous reading). Arrow keys
  navigate.
- **Cross-model comparison** — pick a prompt and read all 18 models' answers
  side by side, with per-model filtering.
- **Search** — filter prompts by topic/domain, or full-text search within a
  model's responses.

## Data

| File | Contents |
| --- | --- |
| `data/raw/train.csv` | Official competition train set (`id, prompt_id, text, model`) |
| `data/raw/test.csv` | Official competition test set (unlabeled) |
| `data/raw/train_prompts_reconstructed.csv` | Community-reconstructed prompt texts, keyed by the official `prompt_id` |
| `data/index.json` | Model/prompt index for the app |
| `data/model/*.json` | One model's responses, in prompt order |
| `data/prompt/*.json` | One prompt's responses across all models |

The competition only publishes `prompt_id` on each row — the prompt texts
themselves are not official and are reconstructed by the community
([source](https://huggingface.co/datasets/halley1812/name-that-llm-artifacts)).
They match the official `prompt_id`s exactly and are labeled as reconstructions
in the UI.

Because Kaggle downloads require an account-bound session, the raw files were
pulled from public participant repositories and verified byte-identical
(md5 `61f581c1bdd4664d588a7c23c413ba0a`) across two independent sources.

## Rebuilding the data

```sh
node tools/build-data.mjs   # reads data/raw/*.csv → writes data/*.json
```

## Running locally

Any static server works:

```sh
python3 -m http.server   # or: npx serve
```

## Deployment

GitHub Pages serves the repo root on the `gh-pages` branch.
