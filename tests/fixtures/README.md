# Recorded model responses

`gemini_invoice_response.txt` is what the extractor receives back from Gemini for
`examples/invoice/sample_invoice.pdf`. The JSON body is the genuine committed extraction
(`examples/invoice/sample_invoice_output.json`), minus `document_type`: that key is added by
`pipeline.py` after validation and is never part of a model response. It is wrapped in the
```json fence the model commonly emits, which `parse_response` has to strip.

`gemini_invoice_truncated.txt` is the same response cut off mid-string inside the third line item,
standing in for a run that hit `max_output_tokens`. Both the unclosed string and the unclosed
objects and arrays have to be repaired for it to parse.

Using these instead of a live call is what keeps the suite runnable with no API key and no network.
