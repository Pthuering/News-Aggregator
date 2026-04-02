/**
 * @module prompts
 * @purpose LLM prompts for article classification
 *
 * @dataflow Static prompt templates for Anthropic API
 *
 * @exports prompts - Classification prompts
 */

export const classificationPrompt = `
Du bist ein Experte für ÖPNV-Digitalisierung und analysierst Fachartikel.
Bewerte den folgenden Artikel nach vier Kriterien (0-10):

1. ÖPNV-Direktrelevanz: Wie direkt betrifft dies den öffentlichen Nahverkehr?
2. Tech-Transfer: Kann die Technologie/der Ansatz auf ÖPNV übertragen werden?
3. Förderrelevanz: Ist dies relevant für Förderanträge oder -programme?
4. Marktrelevanz: Wie wichtig ist dies für den Markt/Wettbewerb?

Artikel:
Titel: {{title}}
Quelle: {{source}}
Inhalt: {{content}}

Antworte im folgenden JSON-Format:
{
  "scores": {
    "oepnv_direkt": number,
    "tech_transfer": number,
    "foerder": number,
    "markt": number
  },
  "tags": ["string"],
  "summary_de": "string",
  "reasoning": "string"
}

Regeln:
- Tags: Maximal 5 kurze Themen-Tags auf Deutsch
- Summary_de: 2-3 Sätze auf Deutsch, was der Artikel behandelt
- Reasoning: Kurze Begründung der Scores (2-3 Sätze)
`;

export const synergyPrompt = `
Du analysierst Synergien zwischen einem Artikel und internen Projekten.

Artikel:
Titel: {{title}}
Zusammenfassung: {{summary}}
Tags: {{tags}}

Projekt:
Name: {{projectName}}
Beschreibung: {{projectDescription}}
Technologien: {{technologies}}
Herausforderungen: {{challenges}}

Bewerte die Relevanz (0-10) und erkläre in 1-2 Sätzen, wie der Artikel dem Projekt helfen könnte.

Antworte im JSON-Format:
{
  "score": number,
  "relevance": "string"
}
`;

export const reportPrompt = `
Erstelle einen {{length}}en Report für {{audience}} basierend auf den folgenden Artikeln.
Fokus: {{focus}}

Artikel:
{{articles}}

{{#includeUserNotes}}
Nutzer-Notizen:
{{userNotes}}
{{/includeUserNotes}}

Struktur:
1. Executive Summary
2. Key Findings
3. Empfohlene Maßnahmen
4. Quellen

Format: Markdown
`;

export default {
  classificationPrompt,
  synergyPrompt,
  reportPrompt,
};
