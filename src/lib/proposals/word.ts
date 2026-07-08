// Wrap the proposal HTML so Microsoft Word opens it as an editable document.
// Word natively renders HTML saved as a .doc; adding the Office namespaces + a
// WordDocument setup block makes it open cleanly (Print view, A4). Reuses the same
// HTML builders as the PDF, so the Word file always matches the PDF content.

export function proposalHtmlToWord(html: string): string {
  const ns =
    'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"';
  const wordSetup =
    "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->" +
    "<style>@page { size: A4; margin: 16mm 15mm 20mm; }</style>";
  return html.replace(/<html([^>]*)>/i, `<html$1 ${ns}>`).replace(/<head>/i, `<head>${wordSetup}`);
}

/** Sanitised, extension-less base filename for a proposal download. */
export function proposalFileBase(clientName: string): string {
  return clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client";
}
