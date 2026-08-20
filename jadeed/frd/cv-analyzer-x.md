# Feature Requirements Document — CV Analyzer X

---

## Feature Requirements

### 1. CV Upload

**Description:** Users can upload a CV document for analysis. The system accepts PDF and DOCX file formats. The uploaded file is parsed into plain text before being passed to the LLM.

**Acceptance Criteria:**
- The upload endpoint accepts files with MIME types `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` only.
- Files exceeding 5 MB are rejected with a `413` error response and a human-readable error message.
- Files of unsupported formats are rejected with a `415` error response and a human-readable error message.
- On successful upload, the system returns a unique `cv_id` and a `status: parsed` confirmation.
- Parsed text is stored and associated with the `cv_id` before any LLM call is made.

---

### 2. LLM-Based CV Analysis

**Description:** The system sends the parsed CV text to an LLM and retrieves a structured analysis covering key professional dimensions.

**Acceptance Criteria:**
- The LLM is prompted to extract and return all of the following fields: `summary`, `skills`, `work_experience`, `education`, `certifications`, `languages`, `strengths`, `weaknesses`, `overall_score` (integer 0–100), and `recommendations`.
- The LLM response is parsed into a structured JSON object matching the schema defined in Data & Entities.
- If the LLM returns a malformed or incomplete response, the system retries up to 2 times before returning a `502` error with the message `"Analysis failed. Please try again."`.
- Analysis is triggered automatically upon successful CV parsing — no additional user action is required.
- Analysis completes and the result is stored within 30 seconds of upload under normal operating conditions.

---

### 3. Analysis Results Retrieval

**Description:** Users retrieve the structured analysis result for a previously uploaded and analyzed CV.

**Acceptance Criteria:**
- A `GET /cv/{cv_id}/analysis` endpoint returns the full structured analysis JSON for the given `cv_id`.
- If analysis is still in progress, the endpoint returns `status: processing` with HTTP `202`.
- If analysis has completed, the endpoint returns `status: complete` with HTTP `200` and the full analysis payload.
- If the `cv_id` does not exist, the endpoint returns HTTP `404`.
- If analysis failed definitively, the endpoint returns `status: failed` with HTTP `200` and an `error_message` field.

---

### 4. Skills Extraction

**Description:** As part of the analysis, the system identifies and categorizes individual skills mentioned in the CV.

**Acceptance Criteria:**
- The `skills` field in the analysis result contains an array of objects, each with `name` (string) and `category` (one of: `technical`, `soft`, `domain`, `tool`, `language`).
- A minimum of one skill is extracted if any skills-related content is present in the CV text.
- Skills are deduplicated — no skill name appears more than once in the array.

---

### 5. Overall Scoring

**Description:** The LLM produces a single overall quality score for the CV on a scale of 0 to 100, reflecting completeness, clarity, and professional relevance.

**Acceptance Criteria:**
- The `overall_score` field is an integer between 0 and 100 inclusive.
- A `score_rationale` string field accompanies the score, providing a one-to-three sentence explanation.
- If the LLM returns a score outside the 0–100 range, the system clamps it to the nearest boundary and logs a warning.

---

### 6. Recommendations

**Description:** The LLM generates actionable improvement recommendations for the CV.

**Acceptance Criteria:**
- The `recommendations` field is an array of strings, each representing a distinct, actionable suggestion.
- The array contains between 1 and 10 items.
- Each recommendation string is non-empty and does not exceed 500 characters.

---

### 7. Analysis History

**Description:** The system persists all analysis results, allowing retrieval of past analyses for a given session or user identifier.

**Acceptance Criteria:**
- A `GET /cv/history` endpoint returns a paginated list of past analyses, ordered by `created_at` descending.
- Each list item includes: `cv_id`, `file_name`, `created_at`, `status`, and `overall_score`.
- Pagination is supported via `page` and `page_size` query parameters. Default `page_size` is 20; maximum is 100.
- The endpoint returns an empty array (not an error) when no history exists.

---

## Data & Entities

### CVDocument

| Field | Type | Constraints |
|---|---|---|
| `cv_id` | UUID | Primary key, auto-generated |
| `file_name` | String | Max 255 characters, not null |
| `file_size_bytes` | Integer | Not null |
| `mime_type` | String | Enum: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `parsed_text` | Text | Not null after parsing |
| `status` | Enum | `uploaded`, `parsing`, `parsed`, `processing`, `complete`, `failed` |
| `created_at` | Timestamp | Auto-set on creation |
| `updated_at` | Timestamp | Auto-updated on change |

---

### CVAnalysis

| Field | Type | Constraints |
|---|---|---|
| `analysis_id` | UUID | Primary key, auto-generated |
| `cv_id` | UUID | Foreign key → CVDocument, not null |
| `summary` | Text | Nullable |
| `skills` | JSON Array | Array of `{name: string, category: enum}` |
| `work_experience` | JSON Array | Array of `{title, company, start_date, end_date, description}` |
| `education` | JSON Array | Array of `{degree, institution, year}` |
| `certifications` | JSON Array | Array of `{name, issuer, year}` |
| `languages` | JSON Array | Array of `{language, proficiency}` |
| `strengths` | JSON Array | Array of strings |
| `weaknesses` | JSON Array | Array of strings |
| `overall_score` | Integer | 0–100 inclusive |
| `score_rationale` | String | Max 1000 characters |
| `recommendations` | JSON Array | Array of strings, 1–10 items, each max 500 characters |
| `raw_llm_response` | Text | Stored for debugging and retry logic |
| `error_message` | String | Nullable; populated on failure |
| `created_at` | Timestamp | Auto-set on creation |
| `updated_at` | Timestamp | Auto-updated on change |

---

## Dependencies

- **LLM Provider API** — An external LLM API (e.g. OpenAI GPT-4o, Anthropic Claude, or equivalent) capable of structured JSON output. The system must support configurable model selection via environment variable.
- **PDF Parser Library** — A server-side library (e.g. `pdfplumber`, `PyMuPDF`, or equivalent) to extract plain text from PDF files.
- **DOCX Parser Library** — A server-side library (e.g. `python-docx` or equivalent) to extract plain text from DOCX files.
- **Persistent Database** — A relational database (PostgreSQL recommended) for storing CVDocument and CVAnalysis records.
- **File Storage** — Temporary or persistent object storage (local filesystem acceptable for MVP) to hold uploaded files during parsing.
- **Background Task Queue** — An async task runner (e.g. Celery, BullMQ, or equivalent) to handle LLM analysis asynchronously and prevent request timeouts.

---

## Out of Scope

- User authentication, authorization, or multi-tenancy — no login, session management, or access control is part of this feature.
- Job description matching or candidate-to-role fit scoring.
- CV editing, rewriting, or generation.
- Bulk CV upload or batch processing.
- Email or notification delivery of analysis results.
- CV template detection or formatting assessment.
- Support for file formats other than PDF and DOCX (e.g. `.txt`, `.rtf`, `.odt`, images).
- Real-time streaming of LLM responses to the client.
- Localization or multi-language UI — analysis output is in English regardless of CV language.