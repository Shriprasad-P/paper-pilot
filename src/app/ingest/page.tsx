import type { Metadata } from "next";
import { IngestDropzone } from "@/components/ingest-dropzone";

export const metadata: Metadata = {
  title: "Add a paper",
};

export default function IngestPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Ingest</p>
      <h1 className="mt-1 font-serif text-4xl">Add a paper</h1>
      <p className="mt-2 mb-8 max-w-xl text-sm leading-6 text-muted-foreground">
        Upload PDFs or paste an arXiv, IEEE, or Springer link. Paywalled pages stop at fetch and ask for a PDF. They do not invent the article.
      </p>
      <IngestDropzone />
    </div>
  );
}
