import type { PaperRecord } from "@/lib/api/types";
import { bundledChart } from "@/lib/charts/spec";

/**
 * Demo index for Vaswani et al., 2017, arXiv:1706.03762.
 * Quotes are short passages from that paper. Page numbers follow the arXiv PDF.
 * Explanations only restate those passages.
 */
export const attentionPaper: PaperRecord = {
  summary: {
    id: "arxiv-1706.03762",
    title: "Attention Is All You Need",
    authors: [
      "Ashish Vaswani",
      "Noam Shazeer",
      "Niki Parmar",
      "Jakob Uszkoreit",
      "Llion Jones",
      "Aidan N. Gomez",
      "Łukasz Kaiser",
      "Illia Polosukhin",
    ],
    year: 2017,
    venue: "NeurIPS",
    sourceLabel: "arXiv:1706.03762",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    provider: "arxiv",
    status: "ready",
    statusDetail: "Ready",
    updatedAt: "2017-06-12T00:00:00.000Z",
    equationCount: 7,
    chartCount: 3,
    warnings: [],
    badge: null,
    statusHelp: null,
  },
  abstract:
    "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
  abstractEvidenceIds: ["c-abs"],
  demoNote: null,
  pageNote: "Page numbers follow the arXiv PDF for 1706.03762.",
  cards: [
    {
      id: "problem",
      title: "Problem",
      body: "Translation models at the time read a sentence with recurrence or convolution. Recurrence steps through tokens in order, so training is harder to parallelize and distant words are awkward to connect.",
      evidenceIds: ["c-intro", "c-self-attn"],
    },
    {
      id: "method",
      title: "Method",
      body: "The Transformer keeps an encoder and a decoder, but each layer is self-attention plus a small feed-forward network. Order is added with positional encodings, because the model itself has no recurrence.",
      evidenceIds: ["c-arch", "c-enc-stack", "c-pos"],
    },
    {
      id: "result",
      title: "Result",
      body: "On WMT 2014 English–German, the big Transformer reaches 28.4 BLEU. On English–French it reaches 41.8 BLEU. The paper reports these gains with a model that trains more in parallel than recurrent baselines.",
      evidenceIds: ["c-results-de", "c-results-fr"],
    },
  ],
  mainChartId: "chart-workflow",
  walkthrough: [
    {
      id: "intro",
      heading: "Why they set recurrence aside",
      sectionLabel: "1 Introduction",
      page: 1,
      explanation:
        "Sequence models for tasks like translation usually ran an encoder and a decoder made of recurrent or convolutional layers. Attention was already used as a bridge between them. This paper’s proposal is narrower than it first sounds: build the whole network from attention, and drop recurrence and convolution.",
      whyItMatters:
        "If the network no longer has to wait for a recurrent step, more of the sentence can be computed at once, and a token can depend on another token far away without a long chain of hidden states.",
      deepNotes:
        "The introduction states the practical target directly: better translation quality, more parallel training, and less time to train. Those three claims are what the experiments later measure.",
      analogy:
        "A recurrent net reads a line with a finger moving left to right. Attention lets every word glance at the whole line in one step. The glance is the mechanism; the sentence above is the paper’s claim.",
      evidenceIds: ["c-abs", "c-intro", "c-attn-integral"],
    },
    {
      id: "background",
      heading: "Self-attention, named",
      sectionLabel: "2 Background",
      page: 2,
      explanation:
        "Self-attention (the paper also says intra-attention) relates different positions inside one sequence so the model can build a representation of that sequence. It is not a new task. It is the operation the rest of the architecture repeats.",
      whyItMatters:
        "Once you can relate every position to every other position inside the encoder, and again inside the decoder, you no longer need a recurrent layer to carry the sentence forward.",
      deepNotes:
        "The background section is short on purpose. The authors treat earlier encoder–decoder attention as given, then define self-attention as the piece they will stack.",
      analogy: null,
      evidenceIds: ["c-self-attn"],
    },
    {
      id: "architecture",
      heading: "Encoder stack and decoder stack",
      sectionLabel: "3.1 Encoder and Decoder stacks",
      page: 3,
      explanation:
        "The model still has the familiar shape: an encoder reads the source sentence, a decoder produces the target sentence. Each encoder layer has two sub-layers, multi-head self-attention and a position-wise feed-forward network. The encoder is a stack of $N = 6$ identical layers. Around each sub-layer there is a residual connection, then layer normalization.",
      whyItMatters:
        "Residuals and layer norm are what make a stack of six attention layers trainable. The paper is explicit that the output of each sub-layer is $\\mathrm{LayerNorm}(x + \\mathrm{Sublayer}(x))$.",
      deepNotes:
        "The decoder adds a third sub-layer that attends over the encoder’s output. The decoder’s self-attention is masked so a position cannot look at later target tokens. Figure 1 in the paper draws the encoder on the left and the decoder on the right.",
      analogy: null,
      evidenceIds: ["c-arch", "c-enc-stack", "c-residual"],
    },
    {
      id: "attention",
      heading: "Scaled dot-product attention",
      sectionLabel: "3.2 Attention",
      page: 4,
      explanation:
        "Attention here takes queries, keys, and values. The weight on a value comes from how well its key matches the query. Those match scores are dot products. The paper divides them by $\\sqrt{d_k}$ before the softmax, then multiplies by the values. That is scaled dot-product attention.",
      whyItMatters:
        "Without the scale, large dot products push the softmax into a flat region with tiny gradients. The scale is there to keep learning stable when $d_k$ is large. It is not a new similarity idea.",
      deepNotes:
        "In this model $d_k = d_v = d_{\\mathrm{model}} / h = 64$, with $h = 8$ heads and $d_{\\mathrm{model}} = 512$. Multi-head attention runs that scaled attention several times with different learned projections, concatenates the heads, and applies one more matrix $W^O$.",
      analogy:
        "Each query is a question. Each key is a label on another token. The softmax is how much of the answer (the value) you copy over. Dividing by $\\sqrt{d_k}$ turns the volume down so one label cannot shout the others out. Trust the formula in the equation table if this picture and the text ever disagree.",
      evidenceIds: ["c-attn-scale", "c-attn-why-scale", "c-mha", "c-mha-dims"],
      equationPrefix: "3.2",
    },
    {
      id: "ffn-pos",
      heading: "A small network at each position, then order",
      sectionLabel: "3.3–3.5 Feed-forward and positional encoding",
      page: 5,
      explanation:
        "After attention, every position goes through the same shape of feed-forward network: a linear layer, a ReLU, and another linear layer. Positions do not share the mixing that attention just did; they do share the same transformation inside a layer. Different layers have different weights. Because there is still no recurrence, the paper adds positional encodings to the input embeddings so the model can tell tokens apart by order.",
      whyItMatters:
        "Attention by itself is a bag of interactions. The positional encoding is the only place token order enters. The encodings have the same size as the embeddings, $d_{\\mathrm{model}}$, so they can be added.",
      deepNotes:
        "The feed-forward inner width is $d_{ff} = 2048$. The positional encoding uses sine and cosine at different frequencies. The paper also says the embeddings are multiplied by $\\sqrt{d_{\\mathrm{model}}}$ before they are added to the positional encoding.",
      analogy:
        "Think of attention as a meeting where everyone can hear everyone, and the feed-forward layer as each person writing up their own notes afterward with the same worksheet.",
      evidenceIds: ["c-ffn", "c-pos", "c-pos-sum", "c-embed-scale"],
      equationPrefix: "3",
    },
    {
      id: "training",
      heading: "What they optimized",
      sectionLabel: "5 Training",
      page: 7,
      explanation:
        "They train with Adam ($\\beta_1 = 0.9$, $\\beta_2 = 0.98$, $\\epsilon = 10^{-9}$). The learning rate rises during a warmup and then falls. The exact schedule is in the equation table. They also use label smoothing with $\\epsilon_{ls} = 0.1$.",
      whyItMatters:
        "The schedule is part of the method, not a footnote. The paper varies the learning rate with step number, model width, and a warmup length, instead of picking one constant rate.",
      deepNotes:
        "The base configuration and the big configuration differ in width, dropout, and how long they train. The walkthrough does not invent hardware details beyond the results passage stored below.",
      analogy: null,
      evidenceIds: ["c-train-opt", "c-train-lr", "c-label"],
      equationPrefix: "5.3",
    },
    {
      id: "results",
      heading: "WMT 2014 numbers they report",
      sectionLabel: "6.1 Machine translation",
      page: 8,
      explanation:
        "On WMT 2014 English-to-German, the big Transformer scores 28.4 BLEU, which the paper says is more than 2.0 BLEU above the best previously reported models, including ensembles. On English-to-French, the big model scores 41.8 BLEU.",
      whyItMatters:
        "These are the numbers the abstract is pointing at when it says the models are stronger and more parallelizable. A reading of the method is incomplete if it never returns to this table.",
      deepNotes:
        "The paper compares several of its own smaller variants in a separate table. Those ablations are not all expanded here. The two BLEU figures above are the headline results stored in this index.",
      analogy: null,
      evidenceIds: ["c-results-de", "c-results-fr"],
    },
    {
      id: "conclusion",
      heading: "What they claim at the end",
      sectionLabel: "7 Conclusion",
      page: 10,
      explanation:
        "The conclusion calls the Transformer the first sequence transduction model based entirely on attention, with multi-head self-attention in place of the recurrent layers used in encoder–decoder models. The authors say they plan to try it on modalities other than text.",
      whyItMatters:
        "The claim is architectural, not that attention was unknown. It is that recurrence can be removed from this encoder–decoder and the translation results still hold.",
      deepNotes:
        "Anything about later models (BERT, GPT, and so on) is outside this paper. This workspace does not add that history.",
      analogy: null,
      evidenceIds: ["c-concl"],
    },
  ],
  equations: [
    {
      id: "eq-attn",
      number: 1,
      latex:
        "\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^{T}}{\\sqrt{d_{k}}}\\right)V",
      name: "Scaled dot-product attention",
      section: "3.2.1",
      page: 4,
      warning: null,
      note: {
        what: "This is the attention function used throughout the Transformer. Queries and keys of dimension $d_k$ produce a weight for each value. The weights are a softmax over scaled dot products.",
        why: "The paper scales by $1/\\sqrt{d_k}$ because large dot products drive the softmax into a region with very small gradients. The scale is a fix for that, not a second attention mechanism.",
        connect:
          "Every attention sub-layer in the encoder and decoder is this function, wrapped by the multi-head projections in the next equation. The workflow chart is this block repeated inside the stacks.",
        newcomer:
          "You have a list of vectors (values). You decide how much of each one to mix together by scoring how well a query matches each key. The fraction inside the softmax is that score, turned down by $\\sqrt{d_k}$.",
        evidenceIds: ["c-attn-scale", "c-attn-why-scale"],
      },
    },
    {
      id: "eq-mha",
      number: 2,
      latex:
        "\\mathrm{MultiHead}(Q, K, V) = \\mathrm{Concat}(\\mathrm{head}_{1}, \\ldots, \\mathrm{head}_{h})W^{O}",
      name: "Multi-head attention",
      section: "3.2.2",
      page: 4,
      warning: null,
      note: {
        what: "Multi-head attention runs several attention functions, concatenates their outputs, and multiplies by $W^O$. The paper sets $h = 8$.",
        why: "A single head averages the subspace it can use. Several heads can pick up different relations at the same positions. The paper states that averaging in one head inhibits that.",
        connect:
          "This is the sub-layer drawn inside each encoder and decoder block. Equation (1) is what each head computes after its own projections.",
        newcomer:
          "Instead of one way of looking across the sentence, the layer looks eight ways and then stitches those views together with a learned matrix.",
        evidenceIds: ["c-mha", "c-mha-dims"],
      },
    },
    {
      id: "eq-head",
      number: 3,
      latex:
        "\\mathrm{head}_{i} = \\mathrm{Attention}(QW^{Q}_{i}, KW^{K}_{i}, VW^{V}_{i})",
      name: "One head",
      section: "3.2.2",
      page: 4,
      warning: null,
      note: {
        what: "Head $i$ is scaled dot-product attention applied to queries, keys, and values that have each been multiplied by their own learned matrix.",
        why: "The projections let each head see a different linear view of the same tokens. Without them, the heads would repeat the same computation.",
        connect:
          "Equation (2) concatenates these heads. The dimensions in the paper are $d_k = d_v = 64$ per head when $d_{\\mathrm{model}} = 512$ and $h = 8$.",
        newcomer:
          "Each head gets its own three maps for questions, labels, and content. Then it does the same mixing formula as equation (1).",
        evidenceIds: ["c-mha", "c-mha-dims", "c-attn-scale"],
      },
    },
    {
      id: "eq-ffn",
      number: 4,
      latex: "\\mathrm{FFN}(x) = \\max(0, xW_{1} + b_{1})W_{2} + b_{2}",
      name: "Position-wise feed-forward network",
      section: "3.3",
      page: 5,
      warning: null,
      note: {
        what: "This is the second sub-layer in each encoder and decoder layer. It is two linear maps with a ReLU between them, applied at each position separately.",
        why: "Attention mixes information across positions. This network then transforms each position on its own. The paper says the same transformation is used at every position inside a layer, with different parameters from layer to layer.",
        connect:
          "In the architecture chart, this sits after the residual around multi-head attention. The inner width is $d_{ff} = 2048$ and the outer width is $d_{\\mathrm{model}} = 512$.",
        newcomer:
          "After tokens have looked at each other, each token is passed through a small two-layer network. The $\\max(0, \\cdot)$ is a ReLU: negative numbers become zero.",
        evidenceIds: ["c-ffn"],
      },
    },
    {
      id: "eq-pe-sin",
      number: 5,
      latex:
        "PE_{(pos, 2i)} = \\sin\\left(pos / 10000^{2i/d_{\\mathrm{model}}}\\right)",
      name: "Positional encoding (sine)",
      section: "3.5",
      page: 6,
      warning: null,
      note: {
        what: "Even dimensions of the positional encoding are a sine of the position, with a wavelength that depends on the dimension index $i$.",
        why: "The model has no recurrence and no convolution, so nothing else tells it which token came first. These values are added to the token embeddings.",
        connect:
          "Equation (6) fills the odd dimensions with cosine. Together they have dimension $d_{\\mathrm{model}}$, matching the embeddings.",
        newcomer:
          "Each position gets a unique wiggle pattern. The sine is half of that pattern. The model can use the pattern as a stand-in for “where am I in the sentence?”",
        evidenceIds: ["c-pos", "c-pos-sum"],
      },
    },
    {
      id: "eq-pe-cos",
      number: 6,
      latex:
        "PE_{(pos, 2i+1)} = \\cos\\left(pos / 10000^{2i/d_{\\mathrm{model}}}\\right)",
      name: "Positional encoding (cosine)",
      section: "3.5",
      page: 6,
      warning: null,
      note: {
        what: "Odd dimensions of the positional encoding are a cosine of the same frequencies used for the sine terms.",
        why: "Sine and cosine together give a fixed encoding the paper can add to embeddings. The authors chose this so a model might attend to relative offsets, though that motive is their hypothesis, stated as such.",
        connect:
          "This pair is applied at the bottom of both the encoder and the decoder, before the stacks drawn in the workflow chart.",
        newcomer:
          "Cosine is the partner of the sine above. You do not need to memorize the frequency. You need to see that order is injected as a vector added to the word vector.",
        evidenceIds: ["c-pos", "c-pos-sum"],
      },
    },
    {
      id: "eq-lr",
      number: 7,
      latex:
        "lrate = d_{\\mathrm{model}}^{-0.5} \\cdot \\min\\left(step\\_num^{-0.5},\\ step\\_num \\cdot warmup\\_steps^{-1.5}\\right)",
      name: "Learning-rate schedule",
      section: "5.3",
      page: 7,
      warning: null,
      note: {
        what: "The learning rate grows linearly with the step during warmup, then decays as the inverse square root of the step. It is also scaled down for larger $d_{\\mathrm{model}}$.",
        why: "The paper does not use a constant learning rate. This formula is the one they optimize with, together with Adam settings $\\beta_1 = 0.9$, $\\beta_2 = 0.98$, and $\\epsilon = 10^{-9}$.",
        connect:
          "The training chart’s update step is this schedule plus label smoothing $\\epsilon_{ls} = 0.1$. It is not part of the encoder diagram.",
        newcomer:
          "Early in training the step size increases. After warmup it shrinks. Wider models get a smaller rate because of the $d_{\\mathrm{model}}^{-0.5}$ factor.",
        evidenceIds: ["c-train-lr", "c-train-opt", "c-label"],
      },
    },
  ],
  equationWarnings: [],
  charts: [
    bundledChart({
      id: "chart-workflow",
      title: "Transformer method",
      caption:
        "The Transformer uses an encoder stack and a decoder stack of self-attention and position-wise feed-forward layers. Positional encodings are added to the input embeddings.",
      kind: "methodology_workflow",
      nodes: [
        { id: "emb", label: "Input embeddings", role: "input", evidence_ids: ["c-pos"] },
        { id: "pos", label: "Positional encodings", role: "process", evidence_ids: ["c-pos"] },
        { id: "enc", label: "Encoder stack N=6", role: "model", evidence_ids: ["c-enc-stack"] },
        { id: "attn", label: "Multi-head self-attention", role: "process", evidence_ids: ["c-enc-stack"] },
        { id: "ffn", label: "Position-wise feed-forward", role: "process", evidence_ids: ["c-ffn"] },
        { id: "dec", label: "Decoder stack", role: "model", evidence_ids: ["c-arch"] },
      ],
      edges: [
        { from: "emb", to: "pos", label: "added" },
        { from: "pos", to: "enc", label: null },
        { from: "enc", to: "attn", label: null },
        { from: "attn", to: "ffn", label: null },
        { from: "ffn", to: "dec", label: null },
        { from: "pos", to: "dec", label: null },
      ],
      evidence_ids: ["c-pos", "c-enc-stack", "c-ffn", "c-arch"],
      note: {
        what: "Section 3 builds the Transformer from stacked self-attention and point-wise fully connected layers for both the encoder and the decoder. The encoder is N = 6 identical layers. Positional encodings are added to the input embeddings at the bottoms of the encoder and decoder stacks.",
        why: "The abstract drops recurrence and convolutions. The position signal is added because the model otherwise has no recurrence and no convolution to carry token order.",
        connect:
          "Each encoder layer is multi-head self-attention, then a position-wise feed-forward network. A residual and layer norm wrap each sub-layer. That inner layout is the architecture chart.",
        newcomer:
          "One stack reads the sequence. The other stack is the decoder. Both use attention and a small feed-forward network, and a position signal is added to the embeddings.",
        evidenceIds: ["c-arch", "c-enc-stack", "c-pos", "c-ffn"],
      },
    }),
    bundledChart({
      id: "chart-encoder",
      title: "One encoder layer",
      caption:
        "Each encoder layer is multi-head self-attention, a residual and layer norm, then a position-wise feed-forward network and another residual and layer norm.",
      kind: "model_architecture",
      nodes: [
        { id: "mha", label: "Multi-head self-attention", role: "process", evidence_ids: ["c-enc-stack"] },
        { id: "res1", label: "Residual connection", role: "process", evidence_ids: ["c-residual"] },
        { id: "norm1", label: "Layer normalization", role: "process", evidence_ids: ["c-residual"] },
        { id: "ffn", label: "Position-wise feed-forward", role: "process", evidence_ids: ["c-ffn"] },
        { id: "res2", label: "Residual connection", role: "process", evidence_ids: ["c-residual"] },
        { id: "norm2", label: "Layer normalization", role: "output", evidence_ids: ["c-residual"] },
      ],
      edges: [
        { from: "mha", to: "res1", label: null },
        { from: "res1", to: "norm1", label: null },
        { from: "norm1", to: "ffn", label: null },
        { from: "ffn", to: "res2", label: null },
        { from: "res2", to: "norm2", label: null },
      ],
      evidence_ids: ["c-enc-stack", "c-residual", "c-ffn"],
      note: {
        what: "Each of the N = 6 encoder layers has two sub-layers: multi-head self-attention, then a position-wise feed-forward network. The output of each sub-layer is LayerNorm(x + Sublayer(x)).",
        why: "The residual and layer norm sit on both sub-layers. The feed-forward network is applied to each position separately and identically.",
        connect:
          "The attention sub-layer is scaled dot-product attention, run as h = 8 heads. The feed-forward sub-layer is two linear transformations with a ReLU between them.",
        newcomer:
          "Tokens look at each other, the layer adds that result back and normalizes, then each position goes through the same small network and the add-and-norm happens again.",
        evidenceIds: ["c-enc-stack", "c-residual", "c-ffn", "c-mha"],
      },
    }),
    bundledChart({
      id: "chart-train",
      title: "Training and reported score",
      caption:
        "Training uses Adam, a warmup learning rate, and label smoothing. The stored results are BLEU on WMT 2014.",
      kind: "training_or_inference_loop",
      nodes: [
        { id: "adam", label: "Adam optimizer", role: "process", evidence_ids: ["c-train-opt"] },
        { id: "lr", label: "Warmup learning rate", role: "process", evidence_ids: ["c-train-lr"] },
        { id: "smooth", label: "Label smoothing", role: "loss", evidence_ids: ["c-label"] },
        { id: "bleu", label: "WMT 2014 BLEU", role: "output", evidence_ids: ["c-results-de"] },
      ],
      edges: [
        { from: "lr", to: "adam", label: null },
        { from: "adam", to: "smooth", label: null },
        { from: "smooth", to: "bleu", label: null },
      ],
      evidence_ids: ["c-train-opt", "c-train-lr", "c-label", "c-results-de"],
      note: {
        what: "Training uses Adam (beta_1 = 0.9, beta_2 = 0.98, epsilon = 10^-9) and a learning rate that increases linearly for warmup_steps, then decreases. Label smoothing is epsilon_ls = 0.1. The big model’s stored scores are 28.4 BLEU on WMT 2014 English-to-German and 41.8 on English-to-French.",
        why: "The schedule and the smoothing are part of how those BLEU scores were obtained. They are not inside the encoder-layer diagram.",
        connect:
          "The learning-rate formula scales with d_model and the step number. The 28.4 and 41.8 figures are the big model’s reported BLEU, not a hardware log.",
        newcomer:
          "Adam updates the model. The step size rises during warmup and then shrinks. Label smoothing softens the training targets. BLEU is the score the paper reports on WMT 2014.",
        evidenceIds: ["c-train-opt", "c-train-lr", "c-label", "c-results-de", "c-results-fr"],
      },
    }),
  ],
  chartError: null,
  chunks: [
    {
      id: "c-abs",
      section: "Abstract",
      page: 1,
      text: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
    },
    {
      id: "c-intro",
      section: "1 Introduction",
      page: 1,
      text: "Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation.",
    },
    {
      id: "c-attn-integral",
      section: "1 Introduction",
      page: 2,
      text: "Attention mechanisms have become an integral part of compelling sequence modeling and transduction models in various tasks, allowing modeling of dependencies without regard to their distance in the input or output sequences.",
    },
    {
      id: "c-self-attn",
      section: "2 Background",
      page: 2,
      text: "Self-attention, sometimes called intra-attention is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence.",
    },
    {
      id: "c-arch",
      section: "3 Model Architecture",
      page: 2,
      text: "The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder, shown in the left and right halves of Figure 1, respectively.",
    },
    {
      id: "c-enc-stack",
      section: "3.1 Encoder and Decoder Stacks",
      page: 3,
      text: "The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network.",
    },
    {
      id: "c-residual",
      section: "3.1 Encoder and Decoder Stacks",
      page: 3,
      text: "We employ a residual connection around each of the two sub-layers, followed by layer normalization. That is, the output of each sub-layer is LayerNorm(x + Sublayer(x)).",
    },
    {
      id: "c-attn-scale",
      section: "3.2.1 Scaled Dot-Product Attention",
      page: 4,
      text: "We call our particular attention Scaled Dot-Product Attention. The input consists of queries and keys of dimension d_k, and values of dimension d_v. We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.",
    },
    {
      id: "c-attn-why-scale",
      section: "3.2.1 Scaled Dot-Product Attention",
      page: 4,
      text: "We suspect that for large values of d_k, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1/sqrt(d_k).",
    },
    {
      id: "c-mha",
      section: "3.2.2 Multi-Head Attention",
      page: 4,
      text: "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.",
    },
    {
      id: "c-mha-dims",
      section: "3.2.2 Multi-Head Attention",
      page: 5,
      text: "We employ h = 8 parallel attention layers, or heads. For each of these we use d_k = d_v = d_model / h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.",
    },
    {
      id: "c-ffn",
      section: "3.3 Position-wise Feed-Forward Networks",
      page: 5,
      text: "In addition to attention sub-layers, each of the layers in our encoder and decoder contains a fully connected feed-forward network, which is applied to each position separately and identically. This consists of two linear transformations with a ReLU activation in between. The dimensionality of input and output is d_model = 512, and the inner-layer has dimensionality d_ff = 2048.",
    },
    {
      id: "c-embed-scale",
      section: "3.4 Embeddings and Softmax",
      page: 5,
      text: "In the embedding layers, we multiply those weights by sqrt(d_model).",
    },
    {
      id: "c-pos",
      section: "3.5 Positional Encoding",
      page: 6,
      text: "Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. To this end, we add positional encodings to the input embeddings at the bottoms of the encoder and decoder stacks.",
    },
    {
      id: "c-pos-sum",
      section: "3.5 Positional Encoding",
      page: 6,
      text: "The positional encodings have the same dimension d_model as the embeddings, so that the two can be summed. We use sine and cosine functions of different frequencies.",
    },
    {
      id: "c-train-opt",
      section: "5.3 Optimizer",
      page: 7,
      text: "We used the Adam optimizer with beta_1 = 0.9, beta_2 = 0.98 and epsilon = 10^-9.",
    },
    {
      id: "c-train-lr",
      section: "5.3 Optimizer",
      page: 7,
      text: "We varied the learning rate over the course of training, according to the formula lrate = d_model^-0.5 * min(step_num^-0.5, step_num * warmup_steps^-1.5). This corresponds to increasing the learning rate linearly for the first warmup_steps training steps, and decreasing it thereafter proportionally to the inverse square root of the step number.",
    },
    {
      id: "c-label",
      section: "5.4 Regularization",
      page: 7,
      text: "During training, we employed label smoothing of value epsilon_ls = 0.1.",
    },
    {
      id: "c-results-de",
      section: "6.1 Machine Translation",
      page: 8,
      text: "On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4.",
    },
    {
      id: "c-results-fr",
      section: "6.1 Machine Translation",
      page: 8,
      text: "On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.8.",
    },
    {
      id: "c-concl",
      section: "7 Conclusion",
      page: 10,
      text: "In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention.",
    },
  ],
  ask: {
    what: "This paper proposes the Transformer: an encoder–decoder for sequence transduction that uses attention only, with no recurrence and no convolution. The stored experiments are WMT 2014 English–German (28.4 BLEU for the big model) and English–French (41.8 BLEU).",
    why: "The introduction starts from recurrent sequence models and from attention already used between encoder and decoder. The authors’ reason for a new architecture is to model dependencies without a recurrent path, and to train with more parallelism.",
    connect:
      "The method stack is $N = 6$ layers of multi-head self-attention and a position-wise feed-forward network, plus positional encodings so order is not lost. The learning-rate schedule and label smoothing sit in the training section, not in the layer diagram.",
    newcomer:
      "A translation model reads a sentence and writes another. Older models walked the sentence in order. This one lets every word look at the other words through attention, adds a position signal so order still exists, and the paper reports higher BLEU on two WMT 2014 tasks.",
    evidenceIds: ["c-abs", "c-intro", "c-arch", "c-results-de", "c-results-fr"],
  },
};
