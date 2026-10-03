# Offline binary Word compatibility fixture

`word-simple.doc` is the small `test09.doc` regression document from
[node-word-extractor](https://github.com/morungos/node-word-extractor/blob/develop/__tests__/data/test09.doc).
It contains simple bracket-handling test text, not applicant data.
Git blob SHA: `1d4a0741e272952be856e5a9624eabf332361e50`.
The upstream MIT license is retained in `word-extractor-LICENSE.txt`.

Tests read the committed bytes offline and never download this file at runtime.
