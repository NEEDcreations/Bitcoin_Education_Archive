# Private exam bank

This directory is not committed except for this note. The question file is copied in at deploy time and must not be added to the repo.

Place the bank at:

`functions/private-bank/scholar-questions.json`

It is a JSON object with two arrays, `properties` (213 questions) and `technical` (165 questions). Each question has `id`, `q`, `a`, and `w`. `a` is the correct text. `w` is the four other choices. Question ids are `p###` or `t###`. Leave placeholder questions out.

Check the file before deploy:

`node functions/scripts/check-bank.js`

The command prints the two counts. It does not print questions.
