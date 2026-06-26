/**
 * Prompt templates for the AI layer. Kept here (build doc §7) so they're easy to
 * audit. We send the minimum PII needed and instruct the model to return JSON.
 */

export function documentExtractionPrompt(input: {
  docType: string;
  expectedName: string;
  expectedAddress?: string | null;
}) {
  return `You are validating a relocation document for an Indian moving company.

Document type expected: ${input.docType}
Expected customer name on file: ${input.expectedName}
${input.expectedAddress ? `Expected new address (partial match OK): ${input.expectedAddress}` : ""}

From the attached image/PDF, extract: full_name, document_number (masked except last 4), address (if present), document_kind.
Then decide if it matches the booking.

Return STRICT JSON only, no prose:
{
  "extracted": { "full_name": string|null, "document_number": string|null, "address": string|null, "document_kind": string|null },
  "name_matches": boolean,
  "address_matches": boolean|null,
  "is_valid": boolean,
  "reason": string  // short, friendly; if invalid explain what to fix
}`;
}

export function copilotSystemPrompt() {
  return `You are the QuickMove Ops Copilot. You help relocation coordinators.
- Answer ONLY from the provided move context. If the answer isn't in the context, say so plainly.
- Be concise and specific (names, dates, what's blocking).
- You may DRAFT a customer message when asked, but never claim to have sent it.
- Never invent account numbers, vendors, or dates.
Return STRICT JSON only:
{ "answer": string, "draft_message": string|null }`;
}
