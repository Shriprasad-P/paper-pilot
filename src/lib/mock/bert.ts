import type { PaperRecord } from "@/lib/api/types";

/**
 * Partial demo index for Devlin et al., BERT, arXiv:1810.04805.
 * Text excerpts are stored. Equation parsing and chart generation are
 * intentionally failed so the partial-success state is visible.
 */
export const bertPaper: PaperRecord = {
  summary: {
    id: "arxiv-1810.04805",
    title:
      "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: [
      "Jacob Devlin",
      "Ming-Wei Chang",
      "Kenton Lee",
      "Kristina Toutanova",
    ],
    year: 2019,
    venue: "NAACL",
    sourceLabel: "arXiv:1810.04805",
    sourceUrl: "https://arxiv.org/abs/1810.04805",
    provider: "arxiv",
    status: "partial",
    statusDetail: "Text ready · equations failed · charts failed",
    updatedAt: "2018-10-11T00:00:00.000Z",
    equationCount: 0,
    chartCount: 0,
    warnings: [
      "Couldn't parse equations on page 4",
      "Couldn't build charts from the method section",
    ],
    badge: "Partial",
    statusHelp:
      "Walkthrough is ready. Equations were not parsed. Charts were not built.",
  },
  abstract:
    "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
  abstractEvidenceIds: ["b-abs"],
  demoNote: null,
  pageNote: "Page numbers follow the arXiv PDF for 1810.04805.",
  cards: [
    {
      id: "problem",
      title: "Problem",
      body: "Earlier language-representation models did not jointly condition on left and right context in every layer. BERT is the authors’ answer to that gap.",
      evidenceIds: ["b-abs"],
    },
    {
      id: "method",
      title: "Method",
      body: "BERT pre-trains a Transformer encoder with a masked language model: some tokens are hidden, and the model predicts them from both sides. A next-sentence task is trained at the same time.",
      evidenceIds: ["b-mlm", "b-nsp"],
    },
    {
      id: "result",
      title: "Result",
      body: "The paper says BERT is conceptually simple and empirically powerful, and that it obtains new state-of-the-art results on eleven NLP tasks. This index does not store the per-task tables.",
      evidenceIds: ["b-results"],
    },
  ],
  mainChartId: null,
  walkthrough: [
    {
      id: "bert-idea",
      heading: "Bidirectional pre-training",
      sectionLabel: "Abstract",
      page: 1,
      explanation:
        "BERT is a language-representation model. The name in the paper expands to Bidirectional Encoder Representations from Transformers. It pre-trains deep bidirectional representations from unlabeled text, conditioning on both left and right context in all layers.",
      whyItMatters:
        "The abstract contrasts this with recent models that did not use both directions in every layer. That contrast is the reason the masked language model exists.",
      deepNotes:
        "This workspace does not import the Transformer equations from Vaswani et al. Those live on the other sample paper. BERT’s stored notes only cover what these excerpts say.",
      analogy: null,
      evidenceIds: ["b-abs"],
    },
    {
      id: "bert-mlm",
      heading: "Masked language model",
      sectionLabel: "3.1 Task #1: Masked LM",
      page: 4,
      explanation:
        "The masked language model hides some input tokens and asks the network to predict the original token id from context. The paper states that 15% of WordPiece tokens in each sequence are masked at random.",
      whyItMatters:
        "Masking is how the model can use left and right context without seeing the answer token. The page-4 extractor did not recover a clean equation for the loss, so the formula is not shown.",
      deepNotes:
        "The extract warning on this paper is attached here: the parser could not read equations on page 4. The 15% figure is from the prose excerpt, not from a reconstructed formula.",
      analogy:
        "Cover a word in a sentence and guess it from the words on both sides. That is a picture of the task. The percentage and the bidirectional claim come only from the excerpts.",
      evidenceIds: ["b-mlm"],
    },
    {
      id: "bert-nsp",
      heading: "Next sentence prediction",
      sectionLabel: "3.1 Task #2: Next sentence prediction",
      page: 4,
      explanation:
        "Besides the masked tokens, the paper pre-trains a next-sentence task so the model learns text-pair representations. The excerpt says the two tasks are trained jointly.",
      whyItMatters:
        "Many of the later fine-tuning tasks are about pairs of sentences. The stored rationale for this task is that joint pre-training of pair representations.",
      deepNotes:
        "No equation for the next-sentence loss is stored. Asking for a formula should not invent one.",
      analogy: null,
      evidenceIds: ["b-nsp"],
    },
    {
      id: "bert-results",
      heading: "What the abstract claims was gained",
      sectionLabel: "Abstract",
      page: 1,
      explanation:
        "The paper describes BERT as conceptually simple and empirically powerful, and says it obtains new state-of-the-art results on eleven natural language processing tasks. Individual task scores are not in this index.",
      whyItMatters:
        "The eleven-task claim is the result card. It should not be expanded into numbers this demo did not retrieve.",
      deepNotes:
        "Charts were not generated. The method section did not yield a diagram spec the stub would stand behind.",
      analogy: null,
      evidenceIds: ["b-results"],
    },
  ],
  equations: [],
  equationWarnings: ["Couldn't parse equations on page 4"],
  charts: [],
  chartError:
    "Couldn't build charts from the method section. The text walkthrough is still available.",
  chunks: [
    {
      id: "b-abs",
      section: "Abstract",
      page: 1,
      text: "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
    },
    {
      id: "b-mlm",
      section: "3.1 Task #1: Masked LM",
      page: 4,
      text: "The masked language model randomly masks some of the tokens from the input, and the objective is to predict the original vocabulary id of the masked word based only on its context. We mask 15% of all WordPiece tokens in each sequence at random.",
    },
    {
      id: "b-nsp",
      section: "3.1 Task #2: Next Sentence Prediction",
      page: 4,
      text: "We also use a next sentence prediction task that jointly pre-trains text-pair representations.",
    },
    {
      id: "b-results",
      section: "Abstract",
      page: 1,
      text: "BERT is conceptually simple and empirically powerful. It obtains new state-of-the-art results on eleven natural language processing tasks.",
    },
  ],
  ask: {
    what: "BERT is a Transformer encoder pre-trained to build bidirectional representations. It conditions on left and right context in all layers, using unlabeled text.",
    why: "The abstract’s contrast is with models that were not bidirectional in every layer. Masking tokens is the stored mechanism that lets the model use both sides.",
    connect:
      "Two pre-training tasks are stored: predict masked WordPiece tokens (15% of tokens) and a next-sentence task for text pairs. Fine-tuning tables are not in this index.",
    newcomer:
      "The model reads a sentence with some words hidden and fills them in using words on both sides. It also practices telling whether one sentence follows another. The paper reports gains on eleven NLP tasks, without listing those scores here.",
    evidenceIds: ["b-abs", "b-mlm", "b-nsp", "b-results"],
  },
};

export function paywalledPaper(): PaperRecord {
  return {
    summary: {
      id: "ieee-paywall-example",
      title: "Example IEEE link",
      authors: [],
      year: null,
      venue: "IEEE Xplore",
      sourceLabel: "ieeexplore.ieee.org/document/example",
      sourceUrl: "https://ieeexplore.ieee.org/document/example",
      provider: "ieee",
      status: "paywalled",
      statusDetail: "Paywalled — upload PDF instead",
      updatedAt: "2026-09-25T16:00:00.000Z",
      equationCount: 0,
      chartCount: 0,
      warnings: ["Paywalled — upload PDF instead"],
      badge: "No full text",
      statusHelp:
        "No full text was retrieved. You can drop a PDF on this paper’s page. Nothing here was read from IEEE.",
    },
    abstract: null,
    abstractEvidenceIds: [],
    demoNote:
      "This row is a sample paywalled link. No title, authors, or prose were retrieved from IEEE.",
    pageNote: null,
    cards: [],
    mainChartId: null,
    walkthrough: [],
    equations: [],
    equationWarnings: [],
    charts: [],
    chartError: null,
    chunks: [],
    ask: {
      what: "No full text was retrieved for this link.",
      why: "No full text was retrieved for this link.",
      connect: "No full text was retrieved for this link.",
      newcomer: "No full text was retrieved for this link.",
      evidenceIds: [],
    },
  };
}
