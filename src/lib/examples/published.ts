import type { ExampleSummary, Keypoint } from "../schemas";

export interface PublishedExample extends ExampleSummary {
  origin: "published";
  supports_demo: false;
  doi: string;
  figure_number: string;
  image_source_url: string;
  license_url: string;
  caption_summary: string;
  changes: string;
}
const reference = (id: string, text: string): Keypoint => ({ id, text, claim: null, author_confirmed: false });
const imageUrl = (doi: string, figure: string) => `https://journals.plos.org/plosone/article/figure/image?download=&id=10.1371%2Fjournal.pone.${doi}.g${figure}&size=large`;
const shared = { origin: "published" as const, supports_demo: false as const, license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/", changes: "Original publisher PNG; no scientific content edits. Display scaling only." };

export const PUBLISHED_EXAMPLES: PublishedExample[] = [
  {
    ...shared, id: "published-physics-nonlinear-system", title: "Nonlinear mechanical system", domain: "physics", figure_type: "mixed", split: "dev",
    description: "Published mechanical schematic and restoring-force analysis. Reference checkpoints require your review; no scripted AI results.",
    doi: "10.1371/journal.pone.0194452", figure_number: "1", figure_label: "Detroux et al. · 2018 · Fig. 1",
    paper_url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0194452",
    source: "Detroux T, Noël J-P, Virgin LN, Kerschen G (2018), PLOS ONE 13(3): e0194452, Fig. 1.",
    attribution: "© 2018 Detroux et al. Reproduced under CC BY 4.0. Original publisher figure, no content edits.",
    caption_summary: "Panel (a) draws the coupled mechanical setup; panel (b) shows the transverse connection's calculated restoring-force curve.",
    image_source_url: imageUrl("0194452", "001"),
    versions: [{ id: "clear", label: "Original published figure", image_url: "/published/physics-nonlinear-system.png", change: "Publisher original; the label 'clear' is an internal version ID, not a quality rating." }],
    keypoints: [
      reference("published-physics-k1", "In panel (a), spring k₂ connects masses m₁ and m₂."),
      reference("published-physics-k2", "In panel (a), the upper and lower transverse springs kᵤ and k_d are attached to m₁."),
      reference("published-physics-k3", "The transverse support motion is labelled d sin(ωt)."),
      reference("published-physics-k4", "Panel (b) plots restoring force f_nl in newtons against relative displacement x in metres."),
    ],
  },
  {
    ...shared, id: "published-materials-lattice-design", title: "Lattice topology to porous structure", domain: "materials", figure_type: "structure", split: "dev",
    description: "A published lattice-design figure linking topology, porosity and pore size. Geometry-rich input rather than a generic flowchart.",
    doi: "10.1371/journal.pone.0182902", figure_number: "2", figure_label: "Egan et al. · 2017 · Fig. 2",
    paper_url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0182902",
    source: "Egan PF, Gonella VC, Engensperger M, Ferguson SJ, Shea K (2017), PLOS ONE 12(8): e0182902, Fig. 2.",
    attribution: "© 2017 Egan et al. Reproduced under CC BY 4.0. Original publisher figure, no content edits.",
    caption_summary: "A cell topology is turned into a porous unit cell, then repeated into a lattice with a selected pore size.",
    image_source_url: imageUrl("0182902", "002"),
    versions: [{ id: "clear", label: "Original published figure", image_url: "/published/materials-lattice-design.png", change: "Unmodified publisher original. No reference quality label is assigned." }],
    keypoints: [
      reference("published-materials-k1", "Panel A represents the unit-cell topology, before beam thickness is specified."),
      reference("published-materials-k2", "Panel B represents a unit cell with specified porosity."),
      reference("published-materials-k3", "Panel C shows a repeated lattice associated with the desired pore size."),
      reference("published-materials-k4", "The figure links A to B and then B to C, in that order."),
    ],
  },
  {
    ...shared, id: "published-mathematics-network-permutation", title: "Network permutations and matrix analysis", domain: "mathematics", figure_type: "mixed", split: "holdout",
    description: "Published graph, adjacency-matrix and statistical schematic. Checkpoints describe what the figure labels, not validation of its mathematical claims.",
    doi: "10.1371/journal.pone.0309005", figure_number: "1", figure_label: "Salbanya et al. · 2024 · Fig. 1",
    paper_url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309005",
    source: "Salbanya B, Carrasco-Farré C, Nin J (2024), PLOS ONE 19(10): e0309005, Fig. 1.",
    attribution: "© 2024 Salbanya et al. Reproduced under CC BY 4.0. Original publisher figure, no content edits.",
    caption_summary: "The panels connect a relabelled network, its adjacency matrix, an objective function, and the figure's displayed p-value summaries.",
    image_source_url: imageUrl("0309005", "001"),
    versions: [{ id: "clear", label: "Original published figure", image_url: "/published/mathematics-network-permutation.png", change: "Unmodified publisher original. Reference checkpoints are curated, not supplied by the authors." }],
    keypoints: [
      reference("published-mathematics-k1", "Panel (a) swaps the node labels 4 and 6 while retaining the drawn connection pattern."),
      reference("published-mathematics-k2", "Panel (b) compares the original and permuted adjacency matrices."),
      reference("published-mathematics-k3", "In panel (d), the individual calculation is labelled p = 1."),
      reference("published-mathematics-k4", "In panel (d), the aggregate curve is labelled p = 1/n and is compared with α = 0.05."),
    ],
  },
  {
    ...shared, id: "published-mathematics-metric-rewiring", title: "Metric value and p-value versus rewiring steps", domain: "mathematics", figure_type: "plot", split: "dev",
    description: "A published two-panel analysis figure. Added as a development example after the multi-panel network figure was not extracted by the 4B reader; it is not a holdout result.",
    doi: "10.1371/journal.pone.0309005", figure_number: "3", figure_label: "Salbanya et al. · 2024 · Fig. 3",
    paper_url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0309005",
    source: "Salbanya B, Carrasco-Farré C, Nin J (2024), PLOS ONE 19(10): e0309005, Fig. 3.",
    attribution: "© 2024 Salbanya et al. Reproduced under CC BY 4.0. Original publisher figure, no content edits.",
    caption_summary: "Panel (a) compares metric values across rewiring counts for original, random and controlled rewiring; panel (b) shows the corresponding p-values with an alpha reference line.",
    image_source_url: imageUrl("0309005", "003"),
    versions: [{ id: "clear", label: "Original published figure", image_url: "/published/mathematics-metric-rewiring.png", change: "Unmodified publisher original. Added to the development split after a separate figure failed extraction." }],
    keypoints: [
      reference("published-mathematics-rewiring-k1", "Panel (a) plots Metric Value against the number of rewirings from 0 to 3."),
      reference("published-mathematics-rewiring-k2", "Panel (a) compares the Original, Random Rewiring and Controlled Rewiring series."),
      reference("published-mathematics-rewiring-k3", "Panel (b) plots p-value against the number of rewirings."),
      reference("published-mathematics-rewiring-k4", "Panel (b) includes a reference line labelled alpha = 0.05."),
    ],
  },
];
export const getPublishedExample = (id: string) => PUBLISHED_EXAMPLES.find(e => e.id === id);
export function listPublishedExamples(): ExampleSummary[] { return PUBLISHED_EXAMPLES; }
